import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { Order, Shipment, ShippingOperation, sequelize } = require('../../src/modules');
const OrderService = require('../../src/modules/order/order.service');
const { placeOrderSchema } = require('../../src/modules/order/order.validation');
const ShiprocketProvider = require('../../src/modules/shipping/providers/shiprocket.provider');

afterEach(() => vi.restoreAllMocks());

describe('Guest order ownership and Shiprocket contact', () => {
    it('reads only the guest order belonging to the browser session', async () => {
        const guestOrder = { id: 'order-1', status: 'cancelled', guestSessionId: 'browser-session', checkoutSessionId: 'different-checkout-id' };
        vi.spyOn(Order, 'findOne').mockImplementation(async ({ where }) => (
            where.id === guestOrder.id && where.userId === null && where.guestSessionId === guestOrder.guestSessionId ? guestOrder : null
        ));
        vi.spyOn(sequelize, 'transaction').mockResolvedValue(undefined);

        await expect(OrderService.getOrderById('order-1', null, false, 'browser-session')).resolves.toBe(guestOrder);
        await expect(OrderService.getOrderById('order-1', null, false, 'different-checkout-id')).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(OrderService.getOrderById('order-1', null, false)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('validates and trims the email supplied at guest checkout', () => {
        expect(placeOrderSchema.validate({ guestEmail: '  buyer@example.com  ' }).value.guestEmail).toBe('buyer@example.com');
        expect(placeOrderSchema.validate({ guestEmail: 'invalid-email' }).error).toBeDefined();
    });

    it('saves a real guest email and repairs queued booking contact data without changing parcel amounts', async () => {
        const order = { userId: null, shippingAddressSnapshot: { city: 'Mumbai' }, update: vi.fn() };
        const operation = {
            requestPayload: {
                order: { total: 1118, subtotal: 1000, user: { email: '' } },
                shipment: { providerRequestId: 'GUEST-1-PARCEL-1' },
                address: { postalCode: '400001' },
            },
            update: vi.fn(),
        };
        vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback({}));
        vi.spyOn(Order, 'findByPk').mockResolvedValue(order);
        vi.spyOn(Shipment, 'findAll').mockResolvedValue([{ id: 'shipment-1' }]);
        vi.spyOn(ShippingOperation, 'findAll').mockResolvedValue([operation]);

        await OrderService.updateContactEmail('order-1', ' buyer@example.com ');

        expect(order.update).toHaveBeenCalledWith({ shippingAddressSnapshot: { city: 'Mumbai', email: 'buyer@example.com' }, guestEmail: 'buyer@example.com' }, expect.any(Object));
        expect(operation.update).toHaveBeenCalledWith({ requestPayload: {
            order: { total: 1118, subtotal: 1000, user: { email: 'buyer@example.com' } },
            shipment: { providerRequestId: 'GUEST-1-PARCEL-1' },
            address: { postalCode: '400001', email: 'buyer@example.com' },
        } }, expect.any(Object));
    });

    it('does not let the guest contact editor change an account order', async () => {
        vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback({}));
        const update = vi.fn();
        vi.spyOn(Order, 'findByPk').mockResolvedValue({ userId: 'user-1', update });
        await expect(OrderService.updateContactEmail('order-1', 'buyer@example.com')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(update).not.toHaveBeenCalled();
    });

    const bookingInput = () => ({
        order: { orderNumber: 'GUEST-1', createdAt: new Date(), paymentMethod: 'cod', subtotal: 100, total: 100 },
        shipment: { providerRequestId: 'GUEST-1-PARCEL-1', actualWeightGrams: 200, lengthCm: 10, breadthCm: 10, heightCm: 10 },
        address: { fullName: 'Guest Buyer', line1: 'Test Road', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', phone: '9876543210', email: 'buyer@example.com' },
        items: [{ snapshotName: 'Item', sku: 'ITEM-1', quantity: 1, unitPrice: 100 }],
    });

    it('sends the real guest contact email when booking Shiprocket', async () => {
        const provider = new ShiprocketProvider({ credentials: { email: 'api@example.com', password: 'test' } });
        vi.spyOn(provider, 'checkShipmentExists').mockResolvedValue(null);
        const request = vi.spyOn(provider, '_request').mockImplementation(async ({ url }) => {
            if (url === '/orders/create/adhoc') return { data: { order_id: 1, shipment_id: 2 } };
            if (url === '/courier/assign/awb') return { data: { awb_code: 'AWB-1' } };
            return { data: {} };
        });

        await provider.createShipment(bookingInput());
        expect(request).toHaveBeenCalledWith(expect.objectContaining({
            url: '/orders/create/adhoc',
            data: expect.objectContaining({ billing_email: 'buyer@example.com' }),
        }));
    });

    it('blocks a new carrier booking without a valid customer email before creating the order', async () => {
        const provider = new ShiprocketProvider({ credentials: { email: 'api@example.com', password: 'test' } });
        vi.spyOn(provider, 'checkShipmentExists').mockResolvedValue(null);
        const request = vi.spyOn(provider, '_request');
        const input = bookingInput();
        delete input.address.email;

        await expect(provider.createShipment(input)).rejects.toThrow("customer's valid email address");
        expect(request).not.toHaveBeenCalled();
    });
});

describe('Admin order details edit', () => {
    const mockTx = () => vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback({}));

    it('updates the address and notes and records an order_edited event', async () => {
        const order = { id: 'order-1', status: 'processing', userId: 'user-1', notes: null, shippingAddressSnapshot: { fullName: 'A', city: 'Mumbai', state: 'MH', country: 'India' }, update: vi.fn() };
        mockTx();
        vi.spyOn(Order, 'findByPk').mockResolvedValue(order);
        vi.spyOn(Shipment, 'findAll').mockResolvedValue([]);
        const history = vi.spyOn(require('../../src/modules').OrderHistory, 'create').mockResolvedValue({});

        await OrderService.updateOrderDetails('order-1', { shippingAddress: { city: 'Pune' }, notes: 'Leave at gate' }, 'admin-1');

        expect(order.update).toHaveBeenCalledWith({ shippingAddressSnapshot: { fullName: 'A', city: 'Pune', state: 'MH', country: 'India' }, notes: 'Leave at gate' }, expect.any(Object));
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'order_edited', actorId: 'admin-1' }), expect.any(Object));
    });

    it('rejects edits on closed orders, shipped orders and tax-relevant state changes', async () => {
        mockTx();
        const find = vi.spyOn(Order, 'findByPk');
        find.mockResolvedValueOnce({ status: 'closed', update: vi.fn() });
        await expect(OrderService.updateOrderDetails('o', { notes: 'x' }, 'a')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

        find.mockResolvedValueOnce({ status: 'processing', shippingAddressSnapshot: { city: 'A' }, update: vi.fn() });
        vi.spyOn(Shipment, 'findAll').mockResolvedValue([{ id: 's', status: 'created' }]);
        await expect(OrderService.updateOrderDetails('o', { shippingAddress: { city: 'B' } }, 'a')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

        find.mockResolvedValueOnce({ status: 'processing', shippingAddressSnapshot: { state: 'MH' }, update: vi.fn() });
        await expect(OrderService.updateOrderDetails('o', { shippingAddress: { state: 'KA' } }, 'a')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
});


describe('Admin order edit edge cases', () => {
    const setup = (overrides = {}) => {
        const order = { id: 'order-1', status: 'processing', userId: null, notes: null,
            guestEmail: 'old@example.com', shippingAddressSnapshot: { city: 'Mumbai', email: 'old@example.com' },
            update: vi.fn(), ...overrides };
        vi.spyOn(sequelize, 'transaction').mockImplementation(async callback => callback({}));
        vi.spyOn(Order, 'findByPk').mockResolvedValue(order);
        vi.spyOn(Shipment, 'findAll').mockResolvedValue([]);
        const history = vi.spyOn(require('../../src/modules').OrderHistory, 'create').mockResolvedValue({});
        return { order, history };
    };

    it('keeps the guest claim email in sync with the corrected contact address', async () => {
        const { order } = setup();
        await OrderService.updateOrderDetails('order-1', { shippingAddress: { email: ' Corrected@Example.com ' } }, 'admin-1');
        expect(order.update).toHaveBeenCalledWith({
            shippingAddressSnapshot: { city: 'Mumbai', email: 'corrected@example.com' },
            guestEmail: 'corrected@example.com',
        }, expect.any(Object));
    });

    it('rejects shipping address edits on digital orders', async () => {
        const { order } = setup({ shippingAddressSnapshot: { digital: true } });
        await expect(OrderService.updateOrderDetails('order-1', { shippingAddress: { city: 'Pune' } }, 'admin-1'))
            .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(order.update).not.toHaveBeenCalled();
    });

    it('allows notes-only changes when a shipment exists', async () => {
        const { order } = setup();
        Shipment.findAll.mockResolvedValue([{ status: 'created' }]);
        await OrderService.updateOrderDetails('order-1', { notes: '  Gate 2  ' }, 'admin-1');
        expect(order.update).toHaveBeenCalledWith({ notes: 'Gate 2' }, expect.any(Object));
    });

    it('does not write or audit unchanged values', async () => {
        const { order, history } = setup();
        await OrderService.updateOrderDetails('order-1', { shippingAddress: { city: 'Mumbai' }, notes: '' }, 'admin-1');
        expect(order.update).not.toHaveBeenCalled();
        expect(history).not.toHaveBeenCalled();
    });

    it('rejects changes to the tax destination country', async () => {
        const { order } = setup({ shippingAddressSnapshot: { country: 'India' } });
        await expect(OrderService.updateOrderDetails('order-1', { shippingAddress: { country: 'UK' } }, 'admin-1'))
            .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(order.update).not.toHaveBeenCalled();
    });
});
