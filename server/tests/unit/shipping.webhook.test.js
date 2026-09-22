import { createRequire } from 'node:module';
import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const ShiprocketProvider = require('../../src/modules/shipping/providers/shiprocket.provider');
const ShippingWebhookService = require('../../src/modules/shipping/shipping.webhook.service');
const NotificationService = require('../../src/modules/notification/notification.service');
const {
    sequelize,
    Shipment,
    ShipmentEvent,
    ShippingProvider,
    Order,
    Fulfillment,
} = require('../../src/modules');

describe('Shiprocket Provider Webhook Adapter', () => {
    let provider;

    beforeEach(() => {
        provider = new ShiprocketProvider({
            settings: { webhookSecret: 'test-secret-key-123' },
            credentials: {},
        });
    });

    it('normalizes various Shiprocket webhook payload formats and statuses', async () => {
        const payload1 = {
            awb: 'SR123456789',
            current_status: 'PICKED UP',
            current_timestamp_location: 'Mumbai Hub',
            scan_id: 'SCAN-001',
            current_timestamp: '2026-03-22T10:00:00Z',
        };

        const event1 = await provider.handleWebhook(payload1);
        expect(event1.awbCode).toBe('SR123456789');
        expect(event1.status).toBe('in_transit');
        expect(event1.location).toBe('Mumbai Hub');
        expect(event1.providerEventId).toBe('SCAN-001');

        const payload2 = {
            awb_code: 'SR123456789',
            status: 'OUT FOR DELIVERY',
            location: 'Bengaluru South',
            id: 'SCAN-002',
        };

        const event2 = await provider.handleWebhook(payload2);
        expect(event2.status).toBe('out_for_delivery');
        expect(event2.location).toBe('Bengaluru South');
        expect(event2.providerEventId).toBe('SCAN-002');

        const payload3 = {
            awb: 'SR123456789',
            current_status: 'DELIVERED',
            scan_id: 'SCAN-003',
        };

        const event3 = await provider.handleWebhook(payload3);
        expect(event3.status).toBe('delivered');

        const payload4 = {
            awb: 'SR123456789',
            current_status: 'RTO INITIATED',
        };

        const event4 = await provider.handleWebhook(payload4);
        expect(event4.status).toBe('rto');
    });

    it('verifies HMAC-SHA256 webhook signatures with timing safety', async () => {
        const secret = 'super-secret-key';
        const payload = { awb: 'SR999', current_status: 'IN TRANSIT' };
        const rawBody = Buffer.from(JSON.stringify(payload));
        const validSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        const invalidSignature = crypto.createHmac('sha256', 'wrong-secret').update(rawBody).digest('hex');

        const isValid = await provider.verifySignature(rawBody, validSignature, secret);
        expect(isValid).toBe(true);

        const isInvalid = await provider.verifySignature(rawBody, invalidSignature, secret);
        expect(isInvalid).toBe(false);

        // Bypasses when secret is null or empty
        const allowsWithoutSecret = await provider.verifySignature(rawBody, null, null);
        expect(allowsWithoutSecret).toBe(true);
    });
});

describe('ShippingWebhookService Lifecycle & Idempotency', () => {
    let mockProviderRecord;
    let mockShipmentRecord;
    let mockFulfillmentRecord;
    let mockOrderRecord;

    beforeEach(() => {
        vi.restoreAllMocks();

        mockProviderRecord = {
            id: 'provider-shiprocket-id',
            code: 'shiprocket',
            name: 'Shiprocket',
            enabled: true,
            webhookSecret: null,
            settings: {},
            credentials: {},
        };

        mockFulfillmentRecord = {
            id: 'fulfillment-1',
            status: 'pending',
            update: vi.fn().mockImplementation(function (data) {
                Object.assign(this, data);
                return Promise.resolve(this);
            }),
        };

        mockOrderRecord = {
            id: 'order-1',
            userId: 'user-1',
            status: 'ready_for_shipment',
            orderShippingStatus: 'not_shipped',
            shipmentStatus: 'not_shipped',
            fulfillments: [mockFulfillmentRecord],
            update: vi.fn().mockImplementation(function (data) {
                Object.assign(this, data);
                return Promise.resolve(this);
            }),
        };

        mockShipmentRecord = {
            id: 'shipment-1',
            awb: 'SR123456789',
            status: 'created',
            statusHistory: [],
            orderId: 'order-1',
            order: mockOrderRecord,
            fulfillment: mockFulfillmentRecord,
            update: vi.fn().mockImplementation(function (data) {
                Object.assign(this, data);
                return Promise.resolve(this);
            }),
        };

        vi.spyOn(sequelize, 'transaction').mockImplementation(async (cb) => cb({}));
        vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue(mockProviderRecord);
        vi.spyOn(Shipment, 'findOne').mockResolvedValue(mockShipmentRecord);
        vi.spyOn(Order, 'findByPk').mockResolvedValue(mockOrderRecord);
        vi.spyOn(ShipmentEvent, 'create').mockResolvedValue({ id: 'event-1' });
        vi.spyOn(NotificationService, 'sendDeliveryUpdate').mockResolvedValue(true);
    });

    it('progresses shipment lifecycle from created -> in_transit -> out_for_delivery -> delivered', async () => {
        // Step 1: PICKED UP / IN TRANSIT
        vi.spyOn(ShipmentEvent, 'findOne').mockResolvedValue(null);

        await ShippingWebhookService.processWebhook('shiprocket', {
            awb: 'SR123456789',
            current_status: 'PICKED UP',
            scan_id: 'SCAN-101',
            location: 'Delhi Hub',
        }, {});

        expect(mockShipmentRecord.status).toBe('in_transit');
        expect(mockFulfillmentRecord.status).toBe('shipped');
        expect(mockOrderRecord.orderShippingStatus).toBe('shipped');
        expect(mockShipmentRecord.statusHistory).toHaveLength(1);
        expect(mockShipmentRecord.statusHistory[0].location).toBe('Delhi Hub');

        // Step 2: OUT FOR DELIVERY
        await ShippingWebhookService.processWebhook('shiprocket', {
            awb: 'SR123456789',
            current_status: 'OUT FOR DELIVERY',
            scan_id: 'SCAN-102',
            location: 'Noida Delivery Center',
        }, {});

        expect(mockShipmentRecord.status).toBe('out_for_delivery');
        expect(mockOrderRecord.orderShippingStatus).toBe('out_for_delivery');
        expect(NotificationService.sendDeliveryUpdate).toHaveBeenCalledWith('user-1', 'order-1', 'out_for_delivery');

        // Step 3: DELIVERED
        await ShippingWebhookService.processWebhook('shiprocket', {
            awb: 'SR123456789',
            current_status: 'DELIVERED',
            scan_id: 'SCAN-103',
            location: 'Delivered to recipient',
        }, {});

        expect(mockShipmentRecord.status).toBe('delivered');
        expect(mockFulfillmentRecord.status).toBe('delivered');
        expect(mockOrderRecord.orderShippingStatus).toBe('delivered');
        expect(NotificationService.sendDeliveryUpdate).toHaveBeenCalledWith('user-1', 'order-1', 'delivered');
    });

    it('skips duplicate webhook events via providerEventId idempotency check', async () => {
        const existingEvent = {
            id: 'event-prev',
            providerEventId: 'SCAN-DUP-01',
        };
        const eventFindOneSpy = vi.spyOn(ShipmentEvent, 'findOne').mockResolvedValue(existingEvent);

        const initialStatus = mockShipmentRecord.status;
        await ShippingWebhookService.processWebhook('shiprocket', {
            awb: 'SR123456789',
            current_status: 'IN TRANSIT',
            scan_id: 'SCAN-DUP-01',
        }, {});

        expect(mockShipmentRecord.update).not.toHaveBeenCalled();
        expect(mockShipmentRecord.status).toBe(initialStatus);
        expect(ShipmentEvent.create).not.toHaveBeenCalled();

        eventFindOneSpy.mockRestore();
    });

    it('guards against regression from terminal delivered status when an out-of-order event arrives', async () => {
        mockShipmentRecord.status = 'delivered';
        vi.spyOn(ShipmentEvent, 'findOne').mockResolvedValue(null);

        // Out-of-order delayed 'IN TRANSIT' webhook arrives after package is already delivered
        await ShippingWebhookService.processWebhook('shiprocket', {
            awb: 'SR123456789',
            current_status: 'IN TRANSIT',
            scan_id: 'SCAN-DELAYED-01',
            location: 'Delayed transit update',
        }, {});

        expect(mockShipmentRecord.update).not.toHaveBeenCalled();
        expect(mockShipmentRecord.status).toBe('delivered');
    });
});
