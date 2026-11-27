import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Opt in only on a fresh, migrated test database served through a private Unix
// socket. See the PR verification commands for creating the disposable cluster.
const enabled = process.env.REFUND_TEST_POSTGRES === '1';
if (enabled && (process.env.NODE_ENV !== 'test'
    || !process.env.DB_HOST?.startsWith('/tmp/ecommerce-refund-pg.')
    || process.env.DB_USER !== 'refund_test'
    || process.env.DB_NAME !== 'refund_pr')) {
  throw new Error('Refund reconciliation integration tests require the dedicated disposable PostgreSQL fixture');
}

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const orderService = require('../../src/modules/order/order.service');
const paymentService = require('../../src/modules/payment/payment.service');
const notifications = require('../../src/modules/notification/notification.service');
const audit = require('../../src/modules/audit/audit.service');

const past = (ms) => new Date(Date.now() - ms);
const barrier = () => {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return { promise, release };
};
async function fixture({ provider = 'stripe', withReturn = false } = {}) {
  const order = await db.Order.create({
    orderNumber: 'RF-' + randomUUID(), subtotal: 100, total: 100, paymentMethod: provider, status: 'processing',
  });
  const payment = await db.Payment.create({
    orderId: order.id, provider, amount: 100, currency: 'INR', status: provider === 'cod' ? 'paid_cod' : 'paid_online',
    transactionId: 'pi_test', metadata: provider === 'cod' ? { codCollectedAmount: 100 } : {},
  });
  if (!withReturn) return { order, payment };
  const item = await db.OrderItem.create({ orderId: order.id, snapshotName: 'Refund test item', snapshotPrice: 50, quantity: 1, total: 50 });
  const returned = await db.OrderReturn.create({ orderId: order.id, type: 'return', status: 'pickup_completed' });
  await db.OrderReturnItem.create({ returnId: returned.id, orderItemId: item.id, quantity: 1 });
  return { order, payment, returned };
}
const queue = ({ order, payment }, fields = {}) => db.OrderRefund.create({
  orderId: order.id, paymentId: payment.id, amount: 15,
  currency: 'INR', status: 'refund_processing', nextReconcileAt: past(60_000), ...fields,
});

describe.skipIf(!enabled)('order refund reconciliation on disposable PostgreSQL', () => {
  beforeAll(async () => {
    await db.sequelize.authenticate();
    const [rows] = await db.sequelize.query("SELECT to_regclass('order_refunds_reconciliation_due_idx') AS idx");
    expect(rows[0].idx).toBe('order_refunds_reconciliation_due_idx');
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await db.sequelize.close(); });

  it('serializes same-return submissions and counts the completed amount before permitting a new attempt', async () => {
    const { order, returned } = await fixture({ withReturn: true });
    const initiate = vi.spyOn(paymentService, 'initiateProviderRefund').mockResolvedValue({ status: 'pending', providerRefundId: 'provider-1' });
    vi.spyOn(paymentService, 'fetchProviderRefundStatus').mockResolvedValue({ status: 'succeeded', providerRefundId: 'provider-1' });
    const sendEvent = vi.spyOn(notifications, 'sendEvent').mockResolvedValue(true);
    const auditLog = vi.spyOn(audit, 'log').mockResolvedValue();
    const submit = (amount) => orderService.processRefund(order.id, { returnId: returned.id, amount }, null, true);
    const outcomes = await Promise.allSettled([submit(35), submit(35)]);
    expect(outcomes.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(outcomes.find((result) => result.status === 'rejected').reason).toMatchObject({ statusCode: 409 });
    expect(initiate).toHaveBeenCalledTimes(1);
    const refund = outcomes.find((result) => result.status === 'fulfilled').value;
    expect(refund.status).toBe('refund_processing');
    expect(refund.nextReconcileAt.getTime()).toBeGreaterThan(Date.now());
    await refund.update({ nextReconcileAt: past(60_000) });
    expect(await orderService.reconcileOpenRefunds()).toBe(1);
    expect((await refund.reload()).status).toBe('partially_refunded');
    expect(refund.nextReconcileAt).toBeNull();
    expect(sendEvent).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenCalledTimes(1);
    await expect(submit(16)).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('15.00') });
    initiate.mockResolvedValue({ status: 'succeeded', providerRefundId: 'provider-2' });
    await expect(submit(15)).resolves.toMatchObject({ status: 'partially_refunded' });
    expect(sendEvent).toHaveBeenCalledTimes(2);
    expect(auditLog).toHaveBeenCalledTimes(2);
  });

  it('lets contending workers take different rows and continues past an unresolved oldest row', async () => {
    const older = await queue(await fixture(), { nextReconcileAt: null });
    const recent = await queue(await fixture(), { nextReconcileAt: past(30_000) });
    const future = await queue(await fixture(), { nextReconcileAt: new Date(Date.now() + 120_000) });
    const enter = barrier();
    const release = barrier();
    const fetchStatus = vi.spyOn(paymentService, 'fetchProviderRefundStatus').mockImplementation(async ({ refund }) => {
      if (refund.id === older.id) {
        enter.release();
        await release.promise;
      }
      return { status: 'pending' };
    });
    const initiate = vi.spyOn(paymentService, 'initiateProviderRefund').mockRejectedValue(new Error('unexpected provider submission'));
    const first = orderService.reconcileOpenRefunds({ limit: 1 });
    try {
      await Promise.race([enter.promise, first]);
      expect(fetchStatus).toHaveBeenCalledWith(expect.objectContaining({ refund: expect.objectContaining({ id: older.id }) }));
      expect(await orderService.reconcileOpenRefunds({ limit: 1 })).toBe(0);
    } finally {
      release.release();
      await first;
    }
    expect(fetchStatus.mock.calls.map(([{ refund }]) => refund.id)).toEqual([older.id, recent.id]);
    expect(await orderService.reconcileOpenRefunds({ limit: 1 })).toBe(0);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    for (const refund of [older, recent]) {
      await refund.reload();
      expect(refund.status).toBe('refund_processing');
      expect(refund.nextReconcileAt.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
    }
    expect((await future.reload()).status).toBe('refund_processing');
    expect(initiate).not.toHaveBeenCalled();
  });

  it('skips a due row while another transaction holds its row lock', async () => {
    const locked = await queue(await fixture(), { nextReconcileAt: past(90_000) });
    const available = await queue(await fixture(), { nextReconcileAt: past(30_000) });
    const fetchStatus = vi.spyOn(paymentService, 'fetchProviderRefundStatus').mockResolvedValue({ status: 'pending' });
    const transaction = await db.sequelize.transaction();
    try {
      await db.OrderRefund.findByPk(locked.id, { transaction, lock: transaction.LOCK.UPDATE });
      expect(await orderService.reconcileOpenRefunds({ limit: 1 })).toBe(0);
      expect(fetchStatus.mock.calls.map(([{ refund }]) => refund.id)).toEqual([available.id]);
    } finally {
      await transaction.rollback();
    }
    await orderService.reconcileOpenRefunds({ limit: 1 });
    expect(fetchStatus.mock.calls.map(([{ refund }]) => refund.id)).toEqual([available.id, locked.id]);
  });

  it('does not reopen or re-notify a refund completed by the worker while the submitting request is still waiting', async () => {
    const { order } = await fixture();
    const enter = barrier();
    const release = barrier();
    vi.spyOn(paymentService, 'initiateProviderRefund').mockImplementation(async () => {
      enter.release();
      await release.promise;
      throw new Error('response lost');
    });
    vi.spyOn(paymentService, 'fetchProviderRefundStatus').mockResolvedValue({ status: 'succeeded', providerRefundId: 'known-by-worker' });
    const sendEvent = vi.spyOn(notifications, 'sendEvent').mockResolvedValue(true);
    const auditLog = vi.spyOn(audit, 'log').mockResolvedValue();
    const submission = orderService.processRefund(order.id, { amount: 20 }, null, true);
    try {
      await Promise.race([enter.promise, submission]);
      const row = await db.OrderRefund.findOne({ where: { orderId: order.id } });
      expect(row.status).toBe('refund_initiated');
      await row.update({ nextReconcileAt: past(60_000) });
      expect(await orderService.reconcileOpenRefunds()).toBe(1);
    } finally {
      release.release();
    }
    await expect(submission).resolves.toMatchObject({ status: 'refunded', providerRefundId: 'known-by-worker', nextReconcileAt: null });
    expect(sendEvent).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenCalledTimes(1);
  });

  it('keeps an ambiguous online submission open and only recovers COD rows with a recorded reference', async () => {
    const { order } = await fixture();
    const initiate = vi.spyOn(paymentService, 'initiateProviderRefund').mockRejectedValue(Object.assign(new Error('Provider conflict'), { statusCode: 409 }));
    const fetchStatus = vi.spyOn(paymentService, 'fetchProviderRefundStatus').mockResolvedValue({ status: 'pending' });
    const sendEvent = vi.spyOn(notifications, 'sendEvent').mockResolvedValue(true);
    vi.spyOn(audit, 'log').mockResolvedValue();
    await expect(orderService.processRefund(order.id, { amount: 20 }, null, true)).rejects.toMatchObject({ statusCode: 503 });
    const refund = await db.OrderRefund.findOne({ where: { orderId: order.id } });
    expect(refund).toMatchObject({ status: 'refund_processing', metadata: expect.objectContaining({ outcomeUnknown: true }) });
    const refreshedOrder = await orderService.getOrderById(order.id, null, true);
    expect(refreshedOrder.refunds).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: refund.id, status: 'refund_processing' }),
    ]));
    await refund.update({ nextReconcileAt: past(60_000) });
    await expect(orderService.processRefund(order.id, { amount: 20 }, null, true)).rejects.toMatchObject({ statusCode: 409 });
    const codMissing = await queue(await fixture({ provider: 'cod' }), { metadata: { refundMethod: 'offline', manualReference: ' ' } });
    const codRecorded = await queue(await fixture({ provider: 'cod' }), { metadata: { refundMethod: 'offline', manualReference: 'bank-test-reference' } });
    expect(await orderService.reconcileOpenRefunds()).toBe(1);
    expect(initiate).toHaveBeenCalledTimes(1);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect((await codMissing.reload()).status).toBe('refund_processing');
    expect(await codRecorded.reload()).toMatchObject({ status: 'refunded', providerRefundId: 'offline:bank-test-reference' });
    expect(sendEvent).toHaveBeenCalledTimes(1);
  });
});
