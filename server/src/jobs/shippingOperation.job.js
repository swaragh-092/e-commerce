'use strict';

const cron = require('node-cron');
const logger = require('../utils/logger');
const ShippingOperationService = require('../modules/shipping/shippingOperation.service');

let running = false;

const processQueue = async () => {
    if (running) return;
    running = true;
    try {
        const count = await ShippingOperationService.processQueued({ limit: 20 });
        if (count > 0) logger.info(`[shippingOperation.job] Processed ${count} shipping operation(s)`);
    } catch (error) {
        logger.error('[shippingOperation.job] Failed to process shipping operations', error);
    } finally {
        running = false;
    }
};

module.exports = {
    run: () => {
        cron.schedule('* * * * *', processQueue);
        setTimeout(processQueue, 5000);
    },
};
