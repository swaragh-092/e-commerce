'use strict';

const cron = require('node-cron');
const InventoryAlertService = require('../modules/inventory/inventoryAlert.service');
const logger = require('../utils/logger');

const run = () => {
  let isRunning = false;
  const runCycle = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const result = await InventoryAlertService.runAlertCycle();
      if (result.queued) logger.info(`Queued ${result.queued} inventory alert email(s).`);
    } catch (error) {
      logger.error('Error in inventory alert cycle:', error);
    } finally {
      isRunning = false;
    }
  };
  cron.schedule('* * * * *', runCycle);
  runCycle();
};

module.exports = { run };
