'use strict';

const cron = require('node-cron');
const logger = require('../utils/logger');
const OrderService = require('../modules/order/order.service');

let running = false;

const runReconciliation = async () => {
    if (running) return;
    running = true;
    try {
        const count = await OrderService.reconcileOpenRefunds({ limit: 25 });
        if (count > 0) logger.info(`[refundReconciliation.job] Reconciled ${count} refund(s)`);
    } catch (error) {
        logger.error('[refundReconciliation.job] Refund reconciliation failed', error);
    } finally {
        running = false;
    }
};

module.exports = {
    run: () => cron.schedule('*/5 * * * *', runReconciliation),
    runReconciliation,
};
