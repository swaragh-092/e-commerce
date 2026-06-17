'use strict';

const cron = require('node-cron');
const analyticsReportService = require('../modules/admin/analyticsReport.service');
const logger = require('../utils/logger');

const run = () => {
  // Daily at 8 AM
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running daily analytics report job...');
    try {
      await analyticsReportService.sendReport();
    } catch (error) {
      logger.error('Error in analyticsReport job:', error);
    }
  });

  // Weekly on Monday at 8 AM
  cron.schedule('0 8 * * 1', async () => {
    logger.info('Running weekly analytics report job...');
    try {
      await analyticsReportService.sendReport();
    } catch (error) {
      logger.error('Error in weekly analyticsReport job:', error);
    }
  });
};

module.exports = { run };
