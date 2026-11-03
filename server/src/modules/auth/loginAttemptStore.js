'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../index');
const AppError = require('../../utils/AppError');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

const getEmailHash = (email) => crypto
  .createHmac('sha256', process.env.JWT_ACCESS_SECRET || '')
  .update(String(email || '').trim().toLowerCase())
  .digest('hex');

const getEmailThrottleHash = (kind, email) => crypto
  .createHmac('sha256', process.env.JWT_ACCESS_SECRET || '')
  .update(`${kind}\0${String(email || '').trim().toLowerCase()}`)
  .digest('hex');

const checkLock = async (email) => {
  const rows = await sequelize.query(
    'SELECT locked_until FROM auth_login_attempts WHERE email_hash = :emailHash',
    { replacements: { emailHash: getEmailHash(email) }, type: QueryTypes.SELECT },
  );
  if (rows[0]?.locked_until && new Date(rows[0].locked_until) > new Date()) {
    throw new AppError('TOO_MANY_REQUESTS', 429, 'Too many failed attempts for this account. Please try again later.');
  }
};

const recordFailure = async (email) => {
  const now = Date.now();
  const windowStartedAt = new Date(now - WINDOW_MS);
  const lockedUntil = new Date(now + LOCK_MS);

  await sequelize.query(`
    INSERT INTO auth_login_attempts (email_hash, failure_count, window_started_at, locked_until, updated_at)
    VALUES (:emailHash, 1, :now, NULL, :now)
    ON CONFLICT (email_hash) DO UPDATE SET
      failure_count = CASE
        WHEN auth_login_attempts.window_started_at <= :windowCutoff THEN 1
        ELSE auth_login_attempts.failure_count + 1
      END,
      window_started_at = CASE
        WHEN auth_login_attempts.window_started_at <= :windowCutoff THEN :now
        ELSE auth_login_attempts.window_started_at
      END,
      locked_until = CASE
        WHEN auth_login_attempts.window_started_at <= :windowCutoff THEN NULL
        WHEN auth_login_attempts.failure_count + 1 >= :maxFailures THEN :lockedUntil
        ELSE auth_login_attempts.locked_until
      END,
      updated_at = :now
  `, {
    replacements: {
      emailHash: getEmailHash(email),
      now: new Date(now),
      windowCutoff: windowStartedAt,
      lockedUntil,
      maxFailures: MAX_FAILURES,
    },
  });

  await sequelize.query('DELETE FROM auth_login_attempts WHERE updated_at <= :cutoff', {
    replacements: { cutoff: new Date(now - RETENTION_MS) },
  });
};

const clear = async (email) => {
  await sequelize.query('DELETE FROM auth_login_attempts WHERE email_hash = :emailHash', {
    replacements: { emailHash: getEmailHash(email) },
  });
};

const claimEmailSend = async (kind, email) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 5 * 60 * 1000);
  const rows = await sequelize.query(`
    INSERT INTO auth_email_throttles (email_hash, last_sent_at)
    VALUES (:emailHash, :now)
    ON CONFLICT (email_hash) DO UPDATE
      SET last_sent_at = EXCLUDED.last_sent_at
      WHERE auth_email_throttles.last_sent_at <= :cutoff
    RETURNING email_hash
  `, {
    replacements: { emailHash: getEmailThrottleHash(kind, email), now, cutoff },
    type: QueryTypes.SELECT,
  });
  return rows.length === 0;
};

module.exports = { checkLock, recordFailure, clear, claimEmailSend };
