'use strict';

const cron = require('node-cron');
const { Op, Transaction } = require('sequelize');
const { Order, OrderItem, Coupon, CouponUsage, Payment, OrderStatusHistory, sequelize } = require('../modules');
const AuditService = require('../modules/audit/audit.service');
const InventoryService = require('../modules/inventory/inventory.service');
const logger = require('../utils/logger');

const RESERVATION_TTL_MS = 15 * 60 * 1000;

const expireOrderReservation = async (orderId, cutoff) => sequelize.transaction(async (transaction) => {
  const order = await Order.findByPk(orderId, { transaction, lock: Transaction.LOCK.UPDATE });
  if (!order || order.status !== 'pending_payment' || order.inventoryReleasedAt || new Date(order.createdAt) >= cutoff) return false;

  const payment = await Payment.findOne({ where: { orderId: order.id }, transaction, lock: Transaction.LOCK.UPDATE });
  if (payment && ['paid_online', 'paid_cod', 'refunded', 'partially_refunded'].includes(payment.status)) return false;
  const attemptStartedAt = payment?.status === 'payment_failed'
    ? Date.parse(payment.metadata?.failedAt || '')
    : Date.parse(payment?.metadata?.retryStartedAt || '');
  const paymentExpiry = Date.parse(payment?.expiresAt || '');
  const effectiveExpiry = Number.isFinite(paymentExpiry)
    ? paymentExpiry
    : Number.isFinite(attemptStartedAt) ? attemptStartedAt + RESERVATION_TTL_MS : new Date(order.createdAt).getTime() + RESERVATION_TTL_MS;
  if (Date.now() < effectiveExpiry) return false;

  const orderItems = await OrderItem.findAll({
    where: { orderId: order.id },
    lock: Transaction.LOCK.UPDATE,
    transaction,
  });
  const variantProductIdsToSync = new Set();
  for (const item of orderItems) {
    if (item.isCombo) {
      for (const constituent of Array.isArray(item.comboSnapshot) ? item.comboSnapshot : []) {
        const quantity = Number(constituent.quantity || 0) * Number(item.quantity || 0);
        if (!constituent.productId || quantity <= 0) continue;
        await InventoryService.restockReturn({
          productId: constituent.productId, variantId: constituent.variantId || null, qty: quantity,
          orderId: order.id, orderItemId: item.id,
          metadata: { reason: 'pending_payment_timeout_combo_constituent', comboProductId: item.productId }, transaction,
        });
      }
      continue;
    }
    if (item.productId && item.quantity > 0) {
      await InventoryService.release({
        productId: item.productId, variantId: item.variantId || null, qty: Number(item.quantity),
        orderId: order.id, orderItemId: item.id, metadata: { reason: 'pending_payment_timeout' },
        transaction, syncParent: false,
      });
      if (item.variantId) variantProductIdsToSync.add(String(item.productId));
    }
  }
  for (const productId of variantProductIdsToSync) await InventoryService.syncParentProductFromVariants(productId, transaction);

  const appliedCouponIds = Array.from(new Set([
    order.couponId,
    ...(Array.isArray(order.appliedDiscounts) ? order.appliedDiscounts.map((discount) => discount.couponId) : []),
  ].filter(Boolean)));
  if (appliedCouponIds.length) {
    const usages = await CouponUsage.findAll({ where: { orderId: order.id, couponId: { [Op.in]: appliedCouponIds } }, transaction });
    const actualCouponIds = [...new Set(usages.map((usage) => usage.couponId))];
    if (actualCouponIds.length) {
      await CouponUsage.destroy({ where: { orderId: order.id, couponId: { [Op.in]: actualCouponIds } }, transaction });
      await Coupon.update({ usedCount: sequelize.literal('GREATEST(used_count - 1, 0)') }, { where: { id: { [Op.in]: actualCouponIds } }, transaction });
    }
  }

  await order.update({ status: 'cancelled', inventoryReleasedAt: new Date() }, { transaction });
  if (payment && ['payment_pending', 'pending', 'payment_failed'].includes(payment.status)) {
    const fromStatus = payment.status;
    await payment.update({
      status: 'payment_expired',
      metadata: { ...(payment.metadata || {}), expiredAt: new Date().toISOString(), reason: 'pending_payment_timeout' },
    }, { transaction });
    await OrderStatusHistory.create({
      orderId: order.id, entityType: 'Payment', entityId: payment.id,
      statusGroup: 'payment', fromStatus, toStatus: 'payment_expired',
      changedBy: null, metadata: { reason: 'pending_payment_timeout' },
    }, { transaction });
  }
  try {
    await AuditService.log({
      userId: null, action: 'ORDER_TIMEOUT', entity: 'Order', entityId: order.id,
      changes: { message: 'Order expired — inventory released automatically' },
    }, transaction);
  } catch (_) { /* audit failure must not prevent reservation release */ }
  return true;
});

const run = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('Running reservationTimeout job...');
      const cutoff = new Date(Date.now() - RESERVATION_TTL_MS);
      let expiredCount = 0;
      let cursor = null;
      while (true) {
        const where = { status: 'pending_payment', createdAt: { [Op.lt]: cutoff } };
        if (cursor) {
          where[Op.or] = [
            { createdAt: { [Op.gt]: cursor.createdAt, [Op.lt]: cutoff } },
            { createdAt: cursor.createdAt, id: { [Op.gt]: cursor.id } },
          ];
        }
        const candidates = await Order.findAll({
          where,
          order: [['createdAt', 'ASC'], ['id', 'ASC']],
          limit: 100,
          attributes: ['id', 'createdAt'],
        });
        if (candidates.length === 0) break;
        for (const candidate of candidates) {
          try {
            if (await expireOrderReservation(candidate.id, cutoff)) expiredCount += 1;
          } catch (error) {
            logger.error('Failed to release expired order reservation; continuing with next order', {
              orderId: candidate.id, errorMessage: error.message,
            });
          }
        }
        const last = candidates[candidates.length - 1];
        cursor = { createdAt: last.createdAt, id: last.id };
      }
      if (expiredCount > 0) {
        logger.info(`Released inventory for ${expiredCount} expired orders.`);
      }
    } catch (error) {
      logger.error('Error scanning expired order reservations:', error);
    }
  });
};

module.exports = { run };
