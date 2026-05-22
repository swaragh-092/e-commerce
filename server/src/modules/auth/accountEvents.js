'use strict';

const EventEmitter = require('events');
const logger = require('../../utils/logger');

const SENSITIVE_KEYS = /password|token|secret|ssn|accessToken|refreshToken/i;

const sanitize = (data) => {
  if (!data || typeof data !== 'object') return data;
  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEYS.test(key)) clean[key] = '***';
    else clean[key] = val;
  }
  return clean;
};

class AccountEventEmitter extends EventEmitter {
  emit(event, data) {
    logger.info(`[AccountEvent] ${event}`, { userId: data?.userId, ...sanitize(data) });
    super.emit(event, data);
    super.emit('*', { event, ...data });
  }
}

const AccountEvents = new AccountEventEmitter();

const WEBHOOK_TIMEOUT = parseInt(process.env.ACCOUNT_EVENTS_WEBHOOK_TIMEOUT_MS || '5000', 10);

AccountEvents.on('*', async (payload) => {
  const webhookUrl = process.env.ACCOUNT_EVENTS_WEBHOOK_URL;
  if (!webhookUrl) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

  try {
    const fetch = (await import('node-fetch')).default;
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sanitize(payload), timestamp: new Date().toISOString() }),
      signal: controller.signal,
    });
  } catch (e) {
    logger.error('[AccountEvent] Webhook delivery failed', { url: webhookUrl, error: e.message });
  } finally {
    clearTimeout(timer);
  }
});

module.exports = AccountEvents;
