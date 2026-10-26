import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PaymentService = require('../../src/modules/payment/payment.service');
const { sequelize, Order, Payment, OrderStatusHistory } = require('../../src/modules');
const AuditService = require('../../src/modules/audit/audit.service');

afterEach(() => vi.restoreAllMocks());

describe('Payment attempt expiry', () => {
    it('rejects a new gateway session after its persisted payment deadline', async () => {
        const order = {
            id: 'order-1',
            userId: 'user-1',
            status: 'pending_payment',
            paymentMethod: 'stripe',
            total: 100,
            createdAt: new Date(),
        };
        const payment = {
            status: 'payment_pending',
            expiresAt: new Date(Date.now() - 1000),
            metadata: { retryStartedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
        };
        vi.spyOn(Order, 'findOne').mockResolvedValue(order);
        vi.spyOn(Payment, 'findOne').mockResolvedValue(payment);
        vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));

        await expect(PaymentService.createOrder(order.userId, order.id)).rejects.toMatchObject({
            code: 'PAYMENT_EXPIRED',
            statusCode: 410,
        });
    });

    it('records a late captured payment on a cancelled order without reopening it', async () => {
        const cancelledOrder = {
            id: 'order-cancelled', userId: 'user-1', status: 'cancelled', total: 50,
            update: vi.fn(),
        };
        const expiredPayment = {
            id: 'payment-1', status: 'payment_expired', expiresAt: new Date(Date.now() - 60_000),
            metadata: { expiredAt: new Date(Date.now() - 30_000).toISOString() },
            update: vi.fn(async (values) => { expiredPayment.lastUpdate = values; }),
        };
        vi.spyOn(Order, 'findByPk').mockResolvedValue(cancelledOrder);
        vi.spyOn(Payment, 'findOne').mockResolvedValue(expiredPayment);
        vi.spyOn(OrderStatusHistory, 'create').mockResolvedValue({});
        vi.spyOn(AuditService, 'log').mockResolvedValue(undefined);
        vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));

        const result = await PaymentService.markOrderPaid({
            orderId: cancelledOrder.id,
            provider: 'stripe',
            transactionId: 'pi-late',
            metadata: { verifiedBy: 'test' },
        });

        expect(result).toEqual({ lateSettlement: true });
        expect(cancelledOrder.update).not.toHaveBeenCalled();
        expect(expiredPayment.lastUpdate).toMatchObject({
            status: 'paid_online',
            transactionId: 'pi-late',
            metadata: { lateSettlement: { reason: 'payment_captured_after_order_cancelled', previousOrderStatus: 'cancelled' } },
        });
        expect(OrderStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
            fromStatus: 'payment_expired', toStatus: 'paid_online',
            metadata: expect.objectContaining({ lateSettlement: true, previousOrderStatus: 'cancelled' }),
        }), expect.any(Object));
    });
});
