'use strict';

const cron = require('node-cron');
const logger = require('../utils/logger');
let running = false;
const tick = async () => {
  if (running) return;
  running = true;
  try { await require('../modules/newsletter/newsletterCampaign.service').queueDue(); }
  catch (error) { logger.error('Newsletter campaign queue failed', { error: error.message }); }
  finally { running = false; }
};
module.exports = { run: () => { cron.schedule('*/1 * * * *', tick); setTimeout(tick, 5000); } };
