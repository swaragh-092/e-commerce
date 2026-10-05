import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ShiprocketProvider = require('../../src/modules/shipping/providers/shiprocket.provider');

const createProvider = () => new ShiprocketProvider({
    credentials: { email: 'api@example.com', password: 'test' },
    settings: { mockShiprocket: false, pickupPincode: '560064' },
});

afterEach(() => vi.restoreAllMocks());

describe('Shiprocket audited booking fixes', () => {
    it('bounds long channel order IDs to a stable numeric value under Shiprocket\'s 50-character maximum', () => {
        const internalReference = `ORD-20261005-${'a'.repeat(40)}-${'b'.repeat(36)}`;
        const carrierReference = ShiprocketProvider.toShiprocketOrderId(internalReference);

        expect(carrierReference).toMatch(/^\d{1,50}$/);
        expect(ShiprocketProvider.toShiprocketOrderId(internalReference)).toBe(carrierReference);
        expect(ShiprocketProvider.toShiprocketOrderId('ORD-123')).toBe('ORD-123');
    });

    it('prints the generated manifest using Shiprocket order IDs and keeps the returned print URL', async () => {
        const provider = createProvider();
        vi.spyOn(provider, 'checkShipmentExists').mockResolvedValue(null);
        const requestSpy = vi.spyOn(provider, '_request').mockImplementation(async ({ url, data }) => {
            if (url === '/orders/create/adhoc') {
                expect(data.order_id).toMatch(/^\d{1,50}$/);
                return { data: { order_id: 12345, shipment_id: 456 } };
            }
            if (url === '/courier/assign/awb') return { data: { awb_code: 'AWB-123', courier_name: 'Pinned' } };
            if (url === '/orders/print/invoice') return { data: { invoice_url: 'https://docs.example/invoice.pdf' } };
            if (url === '/manifests/generate') return { data: { manifest_url: 'https://docs.example/generated.pdf' } };
            if (url === '/manifests/print') {
                expect(data).toEqual({ order_ids: ['12345'] });
                return { data: { manifest_url: 'https://docs.example/printable.pdf' } };
            }
            return { data: {} };
        });

        const result = await provider.createShipment({
            order: {
                orderNumber: 'ORD-123', createdAt: new Date('2026-10-05T00:00:00Z'),
                subtotal: 100, total: 100, paymentMethod: 'stripe', user: { email: 'buyer@example.com' },
            },
            shipment: {
                providerRequestId: `ORD-20261005-${'f'.repeat(40)}`, actualWeightGrams: 500,
                lengthCm: 10, breadthCm: 10, heightCm: 10, courierCompanyId: 19,
            },
            address: {
                fullName: 'Test Buyer', addressLine1: '1 Main Road', city: 'Bengaluru',
                state: 'Karnataka', postalCode: '560001', phone: '9876543210', email: 'buyer@example.com',
            },
            items: [{ snapshotName: 'Item', sku: 'SKU', quantity: 1, unitPrice: 100 }],
        });

        expect(result.manifest).toBe('https://docs.example/printable.pdf');
        expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({
            url: '/courier/assign/awb',
            data: { shipment_id: 456, courier_id: 19 },
        }));
        expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({
            url: '/manifests/print', data: { order_ids: ['12345'] },
        }));
    });

    it('does not silently switch a pinned COD courier when only another courier supports COD', async () => {
        const provider = createProvider();
        vi.spyOn(provider, '_request').mockResolvedValue({
            data: { data: { available_courier_companies: [
                { courier_company_id: 7, courier_name: 'Pinned', cod: 0, is_recommended: true },
                { courier_company_id: 8, courier_name: 'Alternative', cod: 1 },
            ] } },
        });

        const result = await provider.getServiceability({
            pincode: '560001', pickupPincode: '560064', weightGrams: 500,
            paymentMode: 'cod', courierCompanyId: 7,
        });

        expect(result.serviceable).toBe(false);
        expect(result.codAvailable).toBe(false);
        expect(result.reason).toMatch(/courier selected.*supports COD/i);
    });

    it('pins the selected courier on recovery AWB assignment after revalidation', async () => {
        const provider = createProvider();
        const requestSpy = vi.spyOn(provider, '_request').mockImplementation(async ({ method, url }) => {
            if (method === 'get' && url.startsWith('/orders?search=')) {
                return { data: { data: [{ id: 123, channel_order_id: 'ORD-123', shipments: [{ id: 456 }] }] } };
            }
            if (method === 'get' && url === '/courier/serviceability/') {
                return { data: { data: { available_courier_companies: [{ courier_company_id: 19, courier_name: 'Pinned', cod: 1 }] } } };
            }
            if (url === '/courier/assign/awb') return { data: { awb_code: 'AWB-123', courier_name: 'Pinned' } };
            if (url === '/courier/generate/label') return { data: { label_url: 'https://labels.example/123' } };
            return { data: {} };
        });

        const result = await provider.checkShipmentExists({
            orderNumber: 'ORD-123', courierCompanyId: 19, pincode: '560001',
            pickupPincode: '560064', weightGrams: 500, paymentMode: 'cod',
        });

        expect(result.awbCode).toBe('AWB-123');
        expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({
            url: '/courier/assign/awb',
            data: { shipment_id: '456', courier_id: 19 },
        }));
    });

    it('accepts Shiprocket cancellation HTTP 204 with no body as confirmed', async () => {
        const provider = createProvider();
        const requestSpy = vi.spyOn(provider, '_request').mockResolvedValue({ status: 204 });

        const result = await provider.cancelShipment({ awbCode: 'AWB-123' });

        expect(result.success).toBe(true);
        expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({
            method: 'post',
            url: '/orders/cancel/shipment/awbs',
            data: { awbs: ['AWB-123'] },
        }));
    });

    it('uses documented cancel-order API only when shipment cancellation endpoint is unavailable', async () => {
        const provider = createProvider();
        const requestSpy = vi.spyOn(provider, '_request')
            .mockRejectedValueOnce({ response: { status: 404 }, message: 'route not found' })
            .mockResolvedValueOnce({ status: 204 });

        const result = await provider.cancelShipment({ awbCode: 'AWB-123', providerOrderId: '12345' });

        expect(result.success).toBe(true);
        expect(requestSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
            method: 'post', url: '/orders/cancel', data: { ids: ['12345'] },
        }));
    });

    it('does not issue an order cancellation after an AWB cancellation business error', async () => {
        const provider = createProvider();
        const requestSpy = vi.spyOn(provider, '_request').mockRejectedValue({ response: { status: 400 }, message: 'already dispatched' });

        await expect(provider.cancelShipment({ awbCode: 'AWB-123', providerOrderId: '12345' })).rejects.toMatchObject({ response: { status: 400 } });
        expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it('does not treat an AWB not-found response as proof the cancel route is missing', async () => {
        const provider = createProvider();
        const requestSpy = vi.spyOn(provider, '_request').mockRejectedValue({
            response: { status: 404, data: { message: 'AWB not found' } }, message: 'Request failed with status 404',
        });

        await expect(provider.cancelShipment({ awbCode: 'AWB-unknown', providerOrderId: '12345' })).rejects.toMatchObject({ response: { status: 404 } });
        expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it('includes parcel dimensions in the carrier rate request when supplied', async () => {
        const provider = createProvider();
        const requestSpy = vi.spyOn(provider, '_request').mockResolvedValue({
            data: { data: { available_courier_companies: [{ rate: 42, estimated_delivery_days: 3, is_recommended: true }] } },
        });

        const result = await provider.calculateRate({
            pincode: '560001', pickupPincode: '560064', weightGrams: 500,
            lengthCm: 10.2, breadthCm: 8, heightCm: 4.1,
        });

        expect(result.rate).toBe(42);
        expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({
            params: expect.objectContaining({ length: 11, breadth: 8, height: 5 }),
        }));
    });
});
