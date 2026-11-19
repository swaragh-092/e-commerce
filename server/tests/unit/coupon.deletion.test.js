import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sequelize, Coupon, Order } = require('../../src/modules');
const service = require('../../src/modules/coupon/coupon.service');
const audit = require('../../src/modules/audit/audit.service');
let transaction, order, destroy;
beforeEach(() => {
  transaction = { LOCK: { UPDATE: 'UPDATE' } };
  order = { couponId: 'coupon', discountAmount: '50.00', total: '450.00', appliedDiscounts: [{ code: 'SAVE10', amount: 50 }] };
  vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback(transaction));
  destroy = vi.fn(async () => {
    if (order.couponId === 'coupon') throw new Error('orders_coupon_id_fkey');
  });
  vi.spyOn(Coupon, 'findByPk').mockResolvedValue({ id: 'coupon', destroy });
  vi.spyOn(Order, 'update').mockImplementation(async (values) => {
    Object.assign(order, values);
    return [1];
  });
  vi.spyOn(audit, 'log').mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
describe('coupon deletion', () => {
  it('deletes a used coupon while preserving order totals and discount snapshots', async () => {
    await service.remove('coupon', 'admin');
    expect(order).toEqual({ couponId: null, discountAmount: '50.00', total: '450.00', appliedDiscounts: [{ code: 'SAVE10', amount: 50 }] });
    expect(Order.update).toHaveBeenCalledWith({ couponId: null }, { where: { couponId: 'coupon' }, transaction, silent: true });
    expect(destroy).toHaveBeenCalledWith({ transaction });
  });
  it('also deletes coupons with no linked orders', async () => {
    order.couponId = null;
    await expect(service.remove('coupon', 'admin')).resolves.toBeUndefined();
    expect(destroy).toHaveBeenCalledOnce();
  });
  it('returns 404 without changing orders when the coupon is missing', async () => {
    Coupon.findByPk.mockResolvedValue(null);
    await expect(service.remove('missing', 'admin')).rejects.toMatchObject({ statusCode: 404 });
    expect(Order.update).not.toHaveBeenCalled();
  });
  it('does not delete the coupon if unlinking orders fails', async () => {
    Order.update.mockRejectedValue(new Error('database unavailable'));
    await expect(service.remove('coupon', 'admin')).rejects.toThrow('database unavailable');
    expect(destroy).not.toHaveBeenCalled();
  });
});
