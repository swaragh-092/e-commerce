'use strict';

const cron = require('node-cron');
const { Op, Transaction } = require('sequelize');
const { Order, OrderItem, Coupon, CouponUsage, sequelize } = require('../modules');
const AuditService = require('../modules/audit/audit.service');
const InventoryService = require('../modules/inventory/inventory.service');
const logger = require('../utils/logger');

const run = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Running reservationTimeout job...');
    const transaction = await sequelize.transaction();
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

      // Only fetch orders that are still in pending_payment — avoids double-processing
      // if the cron overlaps or an order was already cancelled by the user.
      const expiredOrders = await Order.findAll({
        where: {
          status: 'pending_payment',
          createdAt: { [Op.lt]: fifteenMinsAgo },
        },
        lock: Transaction.LOCK.UPDATE,  // prevent concurrent job runs from racing
        skipLocked: true,
        transaction,
      });

      const orderItems = expiredOrders.length > 0
        ? await OrderItem.findAll({
            where: { orderId: expiredOrders.map((order) => order.id) },
            lock: Transaction.LOCK.UPDATE,
            of: OrderItem,
            transaction,
          })
        : [];

      const itemsByOrderId = orderItems.reduce((accumulator, item) => {
        const orderId = item.orderId;
        if (!accumulator[orderId]) {
          accumulator[orderId] = [];
        }
        accumulator[orderId].push(item);
        return accumulator;
      }, {});

      for (const order of expiredOrders) {
        if (order.inventoryReleasedAt) {
          continue;
        }
        const orderItemsForOrder = itemsByOrderId[order.id] || [];
        const variantProductIdsToSync = new Set();
        for (const item of orderItemsForOrder) {
          if (item.productId && item.quantity > 0) {
            await InventoryService.release({
              productId: item.productId,
              variantId: item.variantId || null,
              qty: Number(item.quantity),
              orderId: order.id,
              orderItemId: item.id,
              metadata: {
                reason: 'pending_payment_timeout',
              },
              transaction,
              syncParent: false,
            });
            if (item.variantId) variantProductIdsToSync.add(String(item.productId));
          }
        }

        for (const productId of variantProductIdsToSync) {
          await InventoryService.syncParentProductFromVariants(productId, transaction);
        }

        // Release coupons if any
        const appliedCouponIds = Array.from(new Set([
          order.couponId,
          ...(Array.isArray(order.appliedDiscounts) ? order.appliedDiscounts.map(d => d.couponId) : [])
        ].filter(Boolean)));

        if (appliedCouponIds.length > 0) {
          const usages = await CouponUsage.findAll({
            where: { orderId: order.id, couponId: { [Op.in]: appliedCouponIds } },
            transaction
          });
          const actualCouponIds = [...new Set(usages.map(u => u.couponId))];
          if (actualCouponIds.length > 0) {
            await CouponUsage.destroy({ 
              where: { orderId: order.id, couponId: { [Op.in]: actualCouponIds } }, 
              transaction 
            });
            await Coupon.update(
              { usedCount: sequelize.literal('GREATEST(used_count - 1, 0)') },
              { where: { id: { [Op.in]: actualCouponIds } }, transaction }
            );
          }
        }

        await order.update({ status: 'cancelled', inventoryReleasedAt: new Date() }, { transaction });

        try {
          await AuditService.log({
            userId: null,
            action: 'ORDER_TIMEOUT',
            entity: 'Order',
            entityId: order.id,
            changes: { message: 'Order expired — inventory released automatically' },
          }, transaction);
        } catch (_) { /* audit failure must not block the job */ }
      }

      await transaction.commit();

      if (expiredOrders.length > 0) {
        logger.info(`Released inventory for ${expiredOrders.length} expired orders.`);
      }
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in reservationTimeout job:', error);
    }
  });
};

module.exports = { run };
