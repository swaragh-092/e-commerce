'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Coupon } = require('../modules');
const logger = require('../utils/logger');

const run = () => {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running couponExpiry job...');
    try {
      const [updatedCount] = await Coupon.update(
        { is_active: false },
        { 
          where: { 
            is_active: true,
            end_date: { [Op.lt]: new Date() }
          }
        }
      );
      
      if (updatedCount > 0) {
        logger.info(`Deactivated ${updatedCount} expired coupons.`);
      }
    } catch (error) {
      logger.error('Error in couponExpiry job:', error);
    }
  });
};

module.exports = { run };
