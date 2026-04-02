'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Order, Cart, ProductVariant, AuditLog, sequelize } = require('../modules');
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
          created_at: { [Op.lt]: fifteenMinsAgo }
        },
        transaction
      });

      for (const order of expiredOrders) {
        // Find cart
        if (order.cartId) {
          await Cart.update({ status: 'expired' }, { where: { id: order.cartId }, transaction });
        }
        
        // Find items & release inventory
        const items = await order.getOrderItems({ transaction });
        for (const item of items) {
          if (item.variantId) {
            await ProductVariant.update(
              { reserved_qty: sequelize.literal(`reserved_qty - ${item.quantity}`) },
              { where: { id: item.variantId }, transaction }
            );
          }
        }
        
        // Update order status
        await order.update({ status: 'cancelled' }, { transaction });

        // Audit log
        await AuditLog.create({
          adminId: null,
          action: 'ORDER_TIMEOUT',
          entityType: 'ORDER',
          entityId: order.id,
          details: { message: 'Order expired due to timeout, inventory released' }
        }, { transaction });
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
