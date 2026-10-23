import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { Order, OrderHistory, GuestOrderClaimToken, User, sequelize } = require('../../src/modules');
const NotificationService = require('../../src/modules/notification/notification.service');
const OrderService = require('../../src/modules/order/order.service');

afterEach(() => vi.restoreAllMocks());

describe('verified guest order claims', () => {
    it('requires verified account email before sending a claim link', async () => {
        vi.spyOn(User, 'findByPk').mockResolvedValue({ id: 'user-1', emailVerified: false, status: 'active' });
        const createToken = vi.spyOn(GuestOrderClaimToken, 'create');
        await expect(OrderService.requestGuestOrderClaim('user-1')).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
        expect(createToken).not.toHaveBeenCalled();
    });

    it('links only unowned orders that match the verified account email and consumes the token once', async () => {
        const transaction = { LOCK: { UPDATE: 'UPDATE' } };
        const order = { id: 'order-1', orderNumber: 'ORD-1', update: vi.fn() };
        const token = { update: vi.fn() };
        vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback(transaction));
        vi.spyOn(GuestOrderClaimToken, 'findOne').mockResolvedValue(token);
        vi.spyOn(User, 'findByPk').mockResolvedValue({ id: 'user-1', email: 'Buyer@Example.com', emailVerified: true, status: 'active' });
        vi.spyOn(Order, 'findAll').mockResolvedValue([order]);
        vi.spyOn(OrderHistory, 'create').mockResolvedValue({});

        await expect(OrderService.claimGuestOrders('user-1', 'a'.repeat(64))).resolves.toEqual({ linkedCount: 1 });
        expect(Order.findAll).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId: null, guestEmail: 'buyer@example.com' },
            transaction,
            lock: 'UPDATE',
        }));
        expect(order.update).toHaveBeenCalledWith({ userId: 'user-1', guestSessionId: null }, { transaction });
        expect(OrderHistory.create).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'guest_order_linked', actorId: 'user-1', actorType: 'customer',
        }), { transaction });
        expect(token.update).toHaveBeenCalledWith(expect.objectContaining({ usedAt: expect.any(Date) }), { transaction });
    });

    it('rejects invalid or expired claim tokens without looking up guest orders', async () => {
        const transaction = { LOCK: { UPDATE: 'UPDATE' } };
        vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback(transaction));
        vi.spyOn(GuestOrderClaimToken, 'findOne').mockResolvedValue(null);
        const findOrders = vi.spyOn(Order, 'findAll');
        await expect(OrderService.claimGuestOrders('user-1', 'a'.repeat(64))).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_TOKEN' });
        expect(findOrders).not.toHaveBeenCalled();
    });
});
