'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { ShippingQuote } = require('../models');
const logger = require('../utils/logger');

const run = () => {
    // Run every hour at the 30th minute
    cron.schedule('30 * * * *', async () => {
        logger.info('[Job: ShippingQuoteCleanup] Starting expired shipping quotes cleanup...');
        try {
            // Delete shipping quotes that expired more than 24 hours ago
            const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const deletedCount = await ShippingQuote.destroy({
                where: {
                    expiresAt: {
                        [Op.lt]: cutoffTime,
                    },
                },
            });

            if (deletedCount > 0) {
                logger.info(`[Job: ShippingQuoteCleanup] Deleted ${deletedCount} expired shipping quotes.`);
            } else {
                logger.debug('[Job: ShippingQuoteCleanup] No expired shipping quotes to delete.');
            }
        } catch (error) {
            logger.error('[Job: ShippingQuoteCleanup] Error cleaning up shipping quotes:', error);
        }
    });
};

module.exports = { run };
