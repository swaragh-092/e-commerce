'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Order, OrderItem, Product, ProductVariant, sequelize } = require('../modules');
const AuditService = require('../modules/audit/audit.service');
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
        lock: transaction.LOCK.UPDATE,  // prevent concurrent job runs from racing
        skipLocked: true,
        transaction,
      });

      const orderItems = expiredOrders.length > 0
        ? await OrderItem.findAll({
            where: { orderId: expiredOrders.map((order) => order.id) },
            lock: transaction.LOCK.UPDATE,
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
        const orderItemsForOrder = itemsByOrderId[order.id] || [];
        // Release product-level reserved inventory.
        // GREATEST(..., 0) ensures we never go below zero even if there's
        // a data inconsistency (e.g. a prior partial decrement).
        for (const item of orderItemsForOrder) {
          if (item.productId && item.quantity > 0) {
            await Product.update(
              {
                reservedQty: sequelize.literal(
                  `GREATEST(reserved_qty - ${item.quantity}, 0)`
                ),
              },
              {
                where: {
                  id: item.productId,
                  // Only decrement if there is actually something reserved —
                  // guards against double-firing on already-released inventory.
                  reservedQty: { [Op.gt]: 0 },
                },
                transaction,
              }
            );
          }
        }

        await order.update({ status: 'cancelled' }, { transaction });

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
