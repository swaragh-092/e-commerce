import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PaymentService = require('../../src/modules/payment/payment.service');
const AuditService = require('../../src/modules/audit/audit.service');
const { sequelize, Order, Payment, OrderItem, Shipment, OrderStatusHistory, OrderHistory } = require('../../src/modules');

afterEach(() => vi.restoreAllMocks());

describe('COD collection and order closure', () => {
    it.each([
        ['processing', 2, 100, 'closed', 'paid_cod'],
        ['ready_for_shipment', 2, 100, 'closed', 'paid_cod'],
        ['processing', 1, 100, 'processing', 'paid_cod'],
        ['processing', 2, 50, 'processing', 'pending_cod'],
    ])('handles %s with %i delivered items and collection %i', async (status, deliveredQuantity, amount, expectedOrderStatus, expectedPaymentStatus) => {
        const order = { id: 'order-1', paymentMethod: 'cod', status, total: 100 };
        order.update = vi.fn(async (values) => Object.assign(order, values));
        const payment = { id: 'payment-1', status: 'pending_cod', provider: 'cod', amount: 100, metadata: {} };
        payment.update = vi.fn(async (values) => Object.assign(payment, values));
        vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
        vi.spyOn(Order, 'findByPk').mockResolvedValue(order);
        vi.spyOn(Payment, 'findOne').mockResolvedValue(payment);
        vi.spyOn(OrderItem, 'findAll').mockResolvedValue([{ id: 'item-1', quantity: 2, total: 100 }]);
        vi.spyOn(Shipment, 'findAll').mockResolvedValue([{ status: 'delivered', items: [{ orderItemId: 'item-1', quantity: deliveredQuantity }] }]);
        vi.spyOn(OrderStatusHistory, 'create').mockResolvedValue({});
        vi.spyOn(OrderHistory, 'create').mockResolvedValue({});
        vi.spyOn(AuditService, 'log').mockResolvedValue({});

        const result = await PaymentService.confirmCodPayment('admin-1', order.id, { amount });
        expect(result.status).toBe(expectedOrderStatus);
        expect(result.paymentStatus).toBe(expectedPaymentStatus);
        expect(order.status).toBe(expectedOrderStatus);
    });
});
