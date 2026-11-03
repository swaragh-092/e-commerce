'use strict';

const crypto = require('crypto');
const logger = require('./logger');

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let cleanupTimer = null;

const getSequelize = () => require('../modules').sequelize;

const startCleanup = () => {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    Promise.all([
      getSequelize().query('DELETE FROM rate_limit_windows WHERE expires_at <= NOW()'),
      getSequelize().query("DELETE FROM auth_email_throttles WHERE last_sent_at <= NOW() - INTERVAL '2 days'"),
    ])
      .catch((error) => logger.warn('Rate limit window cleanup failed', { errorMessage: error.message }));
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
};

class PostgresRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.windowMs = 60_000;
    startCleanup();
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  makeKey(key) {
    const digest = crypto.createHash('sha256').update(String(key)).digest('hex');
    return `${this.prefix}:${digest}`;
  }

  async increment(key) {
    const [rows] = await getSequelize().query(`
      INSERT INTO rate_limit_windows (limiter_key, window_start, hits, expires_at)
      VALUES (:limiterKey, NOW(), 1, NOW() + (:windowMs * INTERVAL '1 millisecond'))
      ON CONFLICT (limiter_key) DO UPDATE SET
        hits = CASE
          WHEN rate_limit_windows.expires_at <= NOW() THEN 1
          ELSE rate_limit_windows.hits + 1
        END,
        window_start = CASE
          WHEN rate_limit_windows.expires_at <= NOW() THEN EXCLUDED.window_start
          ELSE rate_limit_windows.window_start
        END,
        expires_at = CASE
          WHEN rate_limit_windows.expires_at <= NOW() THEN EXCLUDED.expires_at
          ELSE rate_limit_windows.expires_at
        END
      RETURNING hits, expires_at
    `, {
      replacements: {
        limiterKey: this.makeKey(key),
        windowMs: this.windowMs,
      },
    });

    return { totalHits: Number(rows[0].hits), resetTime: new Date(rows[0].expires_at) };
  }

  async decrement(key) {
    await getSequelize().query(`
      UPDATE rate_limit_windows SET hits = GREATEST(hits - 1, 0)
      WHERE limiter_key = :limiterKey
    `, { replacements: { limiterKey: this.makeKey(key) } });
  }

  async resetKey(key) {
    await getSequelize().query('DELETE FROM rate_limit_windows WHERE limiter_key = :limiterKey', {
      replacements: { limiterKey: this.makeKey(key) },
    });
  }

  async resetAll() {
    await getSequelize().query('DELETE FROM rate_limit_windows WHERE limiter_key LIKE :prefix', {
      replacements: { prefix: `${this.prefix}:%` },
    });
  }
}

module.exports = PostgresRateLimitStore;
