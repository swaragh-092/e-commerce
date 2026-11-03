import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const payment = require('../../src/modules/payment/payment.service');
const audit = require('../../src/modules/audit/audit.service');
const transaction = { LOCK: { UPDATE: 'UPDATE' }, afterCommit: vi.fn() };
const raw = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: {
  order: { order_id: 'cashfree-order', order_status: 'PAID' },
  payment: { cf_payment_id: 'capture-1', payment_status: 'SUCCESS' },
} });
const timestamp = 'test-timestamp';
const headers = { 'x-webhook-timestamp': timestamp,
  'x-webhook-signature': crypto.createHmac('sha256', 'test-secret').update(timestamp + raw).digest('base64') };
beforeEach(() => {
  transaction.afterCommit.mockClear();
  vi.spyOn(db.Setting, 'findOne').mockImplementation(async ({ where }) => ({ value: where.key.endsWith('appId') ? 'test-app' : 'test-secret' }));
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(transaction));
  vi.spyOn(db.WebhookEvent, 'create').mockResolvedValue({});
  vi.spyOn(db.Payment, 'findOne').mockResolvedValue({ id: 'payment-1', orderId: 'order-1', status: 'paid_online' });
  vi.spyOn(audit, 'log').mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
describe('Atomic webhook processing', () => {
  it('uses one transaction for the event marker and settlement, deferring side effects', async () => {
    vi.spyOn(db.Order, 'findByPk').mockResolvedValue({ id: 'order-1', status: 'cancelled' });
    await expect(payment.handleCashfreeWebhook(raw, headers)).resolves.toEqual({ received: true });
    expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(db.WebhookEvent.create).toHaveBeenCalledWith(expect.any(Object), { transaction });
    expect(db.Order.findByPk).toHaveBeenCalledWith('order-1', { transaction, lock: 'UPDATE' });
    expect(transaction.afterCommit).toHaveBeenCalledWith(expect.any(Function));
  });
  it('propagates settlement failure so the event transaction rolls back and can be retried', async () => {
    const failure = new Error('settlement unavailable');
    vi.spyOn(db.Order, 'findByPk').mockRejectedValueOnce(failure).mockResolvedValue({ id: 'order-1', status: 'cancelled' });
    await expect(payment.handleCashfreeWebhook(raw, headers)).rejects.toBe(failure);
    expect(transaction.afterCommit).not.toHaveBeenCalled();
    await expect(payment.handleCashfreeWebhook(raw, headers)).resolves.toEqual({ received: true });
    expect(db.WebhookEvent.create).toHaveBeenCalledTimes(2);
  });
  it('acknowledges a duplicate marker without applying settlement again', async () => {
    const duplicate = Object.assign(new Error('duplicate marker'), { name: 'SequelizeUniqueConstraintError' });
    db.WebhookEvent.create.mockRejectedValue(duplicate);
    const order = vi.spyOn(db.Order, 'findByPk');
    await expect(payment.handleCashfreeWebhook(raw, headers)).resolves.toEqual({ received: true, duplicate: true });
    expect(order).not.toHaveBeenCalled();
  });
  it('does not mistake a settlement constraint failure for a duplicate event', async () => {
    const failure = Object.assign(new Error('settlement constraint'), { name: 'SequelizeUniqueConstraintError' });
    vi.spyOn(db.Order, 'findByPk').mockRejectedValue(failure);
    await expect(payment.handleCashfreeWebhook(raw, headers)).rejects.toBe(failure);
  });
  it('requests a provider retry when a paid event has no local payment yet', async () => {
    db.Payment.findOne.mockResolvedValue(null);
    await expect(payment.handleCashfreeWebhook(raw, headers)).rejects.toMatchObject({ statusCode: 503 });
    expect(transaction.afterCommit).not.toHaveBeenCalled();
  });
});
