'use strict';

const cron = require('node-cron');
const { deliverOne, reconcilePurchaseRefunds } = require('../modules/giftCard/giftCard.service');
const logger = require('../utils/logger');

function run() {
    let running = false;
    cron.schedule('* * * * *', async () => {
        if (running) return;
        running = true;
        try {
            await reconcilePurchaseRefunds();
            for (let count = 0; count < 20; count += 1) {
                if (!await deliverOne()) break;
            }
        } catch (error) {
            logger.error('Gift card delivery worker failed', { type: error.name });
        } finally {
            running = false;
        }
    });
}

module.exports = { run };
