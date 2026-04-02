'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { ProductVariant, Product, User, Setting, sequelize } = require('../modules');
const notificationService = require('../modules/notification/notification.service');
const logger = require('../utils/logger');

const run = () => {
  // Run daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running lowStockAlert job...');
    try {
      // Find low stock threshold from settings or default to 5
      const thresholdSetting = await Setting.findOne({ where: { key: 'low_stock_threshold' } });
      const threshold = thresholdSetting ? parseInt(thresholdSetting.value, 10) : 5;

      const lowStockVariants = await ProductVariant.findAll({
        where: sequelize.where(
          sequelize.literal('quantity - reserved_qty'),
          { [Op.lt]: threshold }
        ),
        include: [{ model: Product, as: 'product', attributes: ['name'] }]
      });

      if (lowStockVariants.length > 0) {
        const admins = await User.findAll({ where: { role: 'admin' } });
        
        for (const admin of admins) {
          for (const variant of lowStockVariants) {
            await notificationService.sendNotification(
              admin.id,
              'low_stock_admin',
              {
                productName: variant.product.name,
                sku: variant.sku,
                stock: variant.quantity - variant.reserved_qty
              }
            );
          }
        }
        logger.info(`Sent low stock alerts for ${lowStockVariants.length} variants.`);
      }
    } catch (error) {
      logger.error('Error in lowStockAlert job:', error);
    }
  });
};

module.exports = { run };
