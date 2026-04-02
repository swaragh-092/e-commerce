'use strict';

const reservationTimeoutJob = require('./reservationTimeout.job');
const cartCleanupJob = require('./cartCleanup.job');
const couponExpiryJob = require('./couponExpiry.job');
const lowStockAlertJob = require('./lowStockAlert.job');
const logger = require('../utils/logger');

const startJobs = () => {
  logger.info('Initializing background jobs...');
  reservationTimeoutJob.run();
  cartCleanupJob.run();
  couponExpiryJob.run();
  lowStockAlertJob.run();
};

module.exports = startJobs;
