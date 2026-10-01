'use strict';

const cron = require('node-cron');
const logger = require('../utils/logger');
const { reconcileTracking } = require('../modules/shipping/shipping.webhook.service');

let running = false;

const runReconciliation = async () => {
    if (running) return;
    running = true;
    try {
        const count = await reconcileTracking({ limit: 20 });
        if (count > 0) {
            logger.info(`[trackingReconciliation.job] Reconciled tracking for ${count} shipment(s)`);
        }
    } catch (error) {
        logger.error('[trackingReconciliation.job] Failed to reconcile shipment tracking', error);
    } finally {
        running = false;
    }
};

module.exports = {
    run: () => {
        // Runs every 30 minutes
        cron.schedule('*/30 * * * *', runReconciliation);
    },
    runReconciliation,
};
