'use strict';

const cron = require('node-cron');
const logger = require('../utils/logger');
const NotificationService = require('../modules/notification/notification.service');

let running = false;

const processQueue = async () => {
  if (running) return;
  running = true;
  try {
    const count = await NotificationService.processQueued({ limit: 50 });
    if (count > 0) {
      logger.debug(`[notificationQueue.job] Processed ${count} notification queue item(s)`);
    }
  } catch (err) {
    logger.error('[notificationQueue.job] Failed to process notification queue', err);
  } finally {
    running = false;
  }
};

module.exports = {
  run: () => {
    cron.schedule('*/1 * * * *', processQueue);
    setTimeout(processQueue, 5000);
  },
};
