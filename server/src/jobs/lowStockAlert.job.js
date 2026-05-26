'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { ProductVariant, Product, Setting } = require('../modules');
const notificationService = require('../modules/notification/notification.service');
const logger = require('../utils/logger');

const run = () => {
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running lowStockAlert job...');
    try {
      const thresholdSetting = await Setting.findOne({ where: { key: 'lowStockThreshold', group: 'catalog' } });
      const threshold = thresholdSetting ? parseInt(thresholdSetting.value, 10) : 10;

      // Check variants
      const lowStockVariants = await ProductVariant.findAll({
        where: { stockQty: { [Op.lt]: threshold } },
        include: [{ model: Product, as: 'product', attributes: ['name'] }]
      });

      // Check simple products (no variants, use quantity field)
      const lowStockProducts = await Product.findAll({
        where: {
          type: 'simple',
          status: 'published',
          quantity: { [Op.lt]: threshold },
        },
        attributes: ['name', 'sku', 'quantity'],
      });

      const alerts = [];
      for (const variant of lowStockVariants) {
        alerts.push({ productName: variant.product.name, sku: variant.sku, stock: Number(variant.stockQty || 0) });
      }
      for (const product of lowStockProducts) {
        alerts.push({ productName: product.name, sku: product.sku, stock: Number(product.quantity || 0) });
      }

      if (alerts.length > 0) {
        for (const alert of alerts) {
          await notificationService.sendToAdmins(
            'low_stock_admin',
            ['email', 'sms', 'whatsapp'],
            alert
          );
        }
        logger.info(`Sent low stock alerts for ${alerts.length} items.`);
      }
    } catch (error) {
      logger.error('Error in lowStockAlert job:', error);
    }
  });
};

module.exports = { run };
