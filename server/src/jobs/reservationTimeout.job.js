'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Order, OrderItem, Product, sequelize } = require('../modules');
const AuditService = require('../modules/audit/audit.service');
const logger = require('../utils/logger');

const run = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Running reservationTimeout job...');
    const transaction = await sequelize.transaction();
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

      const expiredOrders = await Order.findAll({
        where: {
          status: 'pending_payment',
          createdAt: { [Op.lt]: fifteenMinsAgo },
        },
        include: [{ model: OrderItem, as: 'items' }],
        transaction,
      });

      for (const order of expiredOrders) {
        // Release product-level reserved inventory for each order item
        for (const item of order.items) {
          if (item.productId && item.quantity > 0) {
            await Product.update(
              { reservedQty: sequelize.literal(`reserved_qty - ${item.quantity}`) },
              { where: { id: item.productId }, transaction }
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
