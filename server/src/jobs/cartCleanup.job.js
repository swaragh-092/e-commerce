'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Cart } = require('../modules');
const logger = require('../utils/logger');

const run = () => {
  // Run daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running cartCleanup job...');
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const [updatedCount] = await Cart.update(
        { status: 'expired' },
        { 
          where: { 
            status: 'active',
            updated_at: { [Op.lt]: thirtyDaysAgo }
          }
        }
      );
      
      if (updatedCount > 0) {
        logger.info(`Expired ${updatedCount} inactive carts.`);
      }
    } catch (error) {
      logger.error('Error in cartCleanup job:', error);
    }
  });
};

module.exports = { run };
