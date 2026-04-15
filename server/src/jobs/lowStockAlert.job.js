'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { ProductVariant, Product, User, Setting } = require('../modules');
const notificationService = require('../modules/notification/notification.service');
const logger = require('../utils/logger');

const run = () => {
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running lowStockAlert job...');
    try {
      const thresholdSetting = await Setting.findOne({ where: { key: 'low_stock_threshold' } });
      const threshold = thresholdSetting ? parseInt(thresholdSetting.value, 10) : 5;

      const lowStockVariants = await ProductVariant.findAll({
        where: { stockQty: { [Op.lt]: threshold } },
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
                stock: Number(variant.stockQty || 0)
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
