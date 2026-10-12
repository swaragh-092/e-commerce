import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const OrderService = require('../../src/modules/order/order.service');
const { events } = require('../../src/utils/events');
const AuditService = require('../../src/modules/audit/audit.service');

describe('customer order cancellation row locking', () => {
    afterEach(() => vi.restoreAllMocks());

    it('locks the order row without applying FOR UPDATE to the nullable items join', async () => {
        const order = {
            id: 'order-1',
            status: 'processing',
            inventoryReleasedAt: new Date(),
            items: [],
            orderNumber: 'ORD-1',
            total: 10,
            update: vi.fn().mockResolvedValue(undefined),
        };
        const transaction = {};

        vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(transaction));
        const findOrder = vi.spyOn(db.Order, 'findOne').mockResolvedValue(order);
        vi.spyOn(db.Order, 'findByPk').mockResolvedValue(order);
        vi.spyOn(db.Shipment, 'count').mockResolvedValue(0);
        vi.spyOn(db.OrderStatusHistory, 'create').mockResolvedValue({});
        vi.spyOn(db.OrderHistory, 'create').mockResolvedValue({});
        vi.spyOn(db.Payment, 'findOne').mockResolvedValue(null);
        vi.spyOn(db.User, 'findByPk').mockResolvedValue(null);
        vi.spyOn(AuditService, 'log').mockResolvedValue(undefined);
        vi.spyOn(events, 'emit').mockReturnValue(true);

        await OrderService.cancelOrder('order-1', 'user-1', {
            reason: 'changed_mind',
            reasonDetails: '',
        });

        expect(findOrder).toHaveBeenCalledWith(expect.objectContaining({
            include: [{ model: db.OrderItem, as: 'items' }],
            transaction,
            lock: { level: db.Sequelize.Transaction.LOCK.UPDATE, of: db.Order },
        }));
    });
});
