'use strict';

const cron = require('node-cron');
const { refreshRankings } = require('../modules/product/product.discovery');
const logger = require('../utils/logger');

const refresh = async () => {
  try {
    await refreshRankings();
  } catch (err) {
    logger.error('Storefront product ranking refresh failed', err);
  }
};

module.exports = {
  run() {
    cron.schedule('15 * * * *', refresh, { timezone: 'UTC' });
  },
};
