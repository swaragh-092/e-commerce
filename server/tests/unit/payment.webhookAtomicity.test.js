import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const payment = require('../../src/modules/payment/payment.service');
const audit = require('../../src/modules/audit/audit.service');
const transaction = { LOCK: { UPDATE: 'UPDATE' }, afterCommit: vi.fn() };
const providerOrder = { order_id: 'cashfree-order', order_status: 'PAID', order_amount: 100, order_currency: 'INR' };
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
  vi.spyOn(db.Payment, 'findOne').mockResolvedValue({ id: 'payment-1', orderId: 'order-1', status: 'paid_online', currency: 'INR', update: vi.fn() });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(providerOrder));
  vi.spyOn(audit, 'log').mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
describe('Atomic webhook processing', () => {
  it('uses one transaction for the event marker and settlement, deferring side effects', async () => {
    vi.spyOn(db.Order, 'findByPk').mockResolvedValue({ id: 'order-1', status: 'cancelled', total: 100 });
    await expect(payment.handleCashfreeWebhook(raw, headers)).resolves.toEqual({ received: true });
    expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(db.WebhookEvent.create).toHaveBeenCalledWith(expect.any(Object), { transaction });
    expect(db.Order.findByPk).toHaveBeenCalledWith('order-1', { transaction, lock: 'UPDATE' });
    expect(transaction.afterCommit).toHaveBeenCalledWith(expect.any(Function));
  });
  it('propagates settlement failure so the event transaction rolls back and can be retried', async () => {
    const failure = new Error('settlement unavailable');
    vi.spyOn(db.Order, 'findByPk').mockRejectedValueOnce(failure).mockResolvedValue({ id: 'order-1', status: 'cancelled', total: 100 });
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
  it.each([{ order_amount: 99 }, { order_currency: 'USD' }, { order_amount: null }])('rejects unverified provider totals: %j', async (override) => {
    globalThis.fetch.mockImplementation(async () => Response.json({ ...providerOrder, ...override }));
    const update = vi.fn();
    vi.spyOn(db.Order, 'findByPk').mockResolvedValue({ id: 'order-1', status: 'pending_payment', total: 100, update });
    await expect(payment.handleCashfreeWebhook(raw, headers)).rejects.toMatchObject({ statusCode: 400 });
    expect(update).not.toHaveBeenCalled();
    expect(transaction.afterCommit).not.toHaveBeenCalled();
  });
  it.each([{ order_id: 'different-order' }, { order_status: 'ACTIVE' }])('does not settle a mismatched or unpaid provider order: %j', async (override) => {
    globalThis.fetch.mockImplementation(async () => Response.json({ ...providerOrder, ...override }));
    const readOrder = vi.spyOn(db.Order, 'findByPk');
    await expect(payment.handleCashfreeWebhook(raw, headers)).rejects.toMatchObject({ statusCode: 503 });
    expect(readOrder).not.toHaveBeenCalled();
  });
  it('looks up an existing Cashfree refund by merchant ID without issuing a POST', async () => {
    globalThis.fetch.mockImplementation(async () => Response.json({
      order_id: 'cashfree-order', refund_id: 'local-refund', cf_refund_id: 'provider-refund', refund_status: 'SUCCESS',
    }));
    await expect(payment.fetchProviderRefundStatus({
      payment: { provider: 'cashfree', transactionId: 'cashfree-order' },
      refund: { id: 'local-refund', providerRefundId: 'provider-refund' },
    })).resolves.toEqual({ status: 'succeeded', providerRefundId: 'provider-refund' });
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/orders\/cashfree-order\/refunds\/local-refund$/), expect.objectContaining({ method: 'GET' }));
  });

  it('does not match an unrelated PayU refund with no provider reference', async () => {
    globalThis.fetch.mockImplementation(async () => Response.json({
      status: 1, refunds: [{ refund_token: 'unrelated', Status: 'SUCCESS' }],
    }));
    await expect(payment.fetchProviderRefundStatus({
      payment: { provider: 'payu', metadata: { payuId: 'payu-payment' } },
      refund: { id: 'local-refund' },
    })).resolves.toEqual({ status: 'pending' });
    expect(globalThis.fetch.mock.calls[0][1].body.get('command')).toBe('getAllRefundsFromTxnIds');
  });

});
