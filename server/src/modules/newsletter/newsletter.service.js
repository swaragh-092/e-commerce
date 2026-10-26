'use strict';

const { NewsletterSubscriber, Sequelize } = require('../index');
const AppError = require('../../utils/AppError');
const Joi = require('joi');
const logger = require('../../utils/logger');

const UNIQUE_VIOLATION = 'SequelizeUniqueConstraintError';

// Free-form source strings used to pollute the table and break CSV exports.
const SOURCE_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/;
const DEFAULT_SOURCE = 'homepage';

const MAX_LIST_LIMIT = 500;

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const consentContext = (context = {}) => ({
  consentIp: typeof context.ip === 'string' ? context.ip.slice(0, 45) : null,
  consentUserAgent: typeof context.userAgent === 'string' ? context.userAgent.slice(0, 255) : null,
});

// Double opt-in: the confirmation email carries a verify link; the subscriber
// only becomes 'active' after confirming. Tokens travel exclusively inside
// emails and are never returned by API responses.
const queueConfirmEmail = async (subscriber) => {
  if (!subscriber?.unsubscribeToken) return false;
  const subscribedAtIso = new Date(subscriber.subscribedAt).toISOString();
  const queued = await require('../notification/notification.service').send('newsletter_confirm', subscriber.email, {
    subscriber_id: subscriber.id,
    subscribed_at: subscribedAtIso,
    confirm_url: require('./newsletterCampaign.service').confirmUrl(subscriber.unsubscribeToken),
  }, null, null, 'email', null, `newsletter_confirm:${subscriber.id}:${subscribedAtIso}`);
  if (queued) {
    // Persist the marker so GET /me can distinguish "pending, email queued"
    // from "pending, queueing failed" across reloads. A marker-write failure must
    // not fail the subscription itself.
    try { await subscriber.update({ lastConfirmQueuedAt: new Date() }); }
    catch (error) { logger.warn(`[newsletter] Could not record confirm-queue marker for subscriber ${subscriber.id}`); }
  }
  return queued;
};

// Welcome email sent after the confirm link is clicked (and after account
// resubscription is confirmed). Reuses the historical confirmation template.
const queueWelcomeEmail = async (subscriber) => {
  if (!subscriber?.unsubscribeToken) return false;
  return require('../notification/notification.service').send('newsletter_confirmation', subscriber.email, {
    subscriber_id: subscriber.id,
    subscribed_at: new Date(subscriber.subscribedAt).toISOString(),
    unsubscribe_url: require('./newsletterCampaign.service').unsubscribeUrl(subscriber.unsubscribeToken),
  });
};

/**
 * Start (or restart) the double opt-in flow for an email address.
 * Never returns unsubscribe/confirm tokens — they only travel via email.
 *
 * @param {string} email
 * @param {string} [source='homepage'] - allowlisted slug (^[a-z][a-z0-9_-]{0,39}$)
 * @param {object} [context]           - { ip, userAgent } consent evidence
 */
const subscribe = async (email, source = DEFAULT_SOURCE, context = {}) => {
  if (!await require('../../middleware/featureGate.middleware').getResolvedFeature('newsletter')) {
    throw new AppError('FEATURE_DISABLED', 403, 'Newsletter subscriptions are disabled');
  }
  if (typeof email !== 'string' || Joi.string().email().validate(email.trim()).error) throw new AppError('VALIDATION_ERROR', 400, 'Enter a valid email address');
  if (typeof source !== 'string' || !SOURCE_PATTERN.test(source)) throw new AppError('VALIDATION_ERROR', 400, 'Invalid subscription source');
  const normalized = normalizeEmail(email);
  const existing = await NewsletterSubscriber.findOne({ where: { email: normalized } });
  if (existing) {
    if (existing.status === 'active') return { alreadySubscribed: true };
    // 'pending' or 'unsubscribed' — start a brand-new consent session: fresh
    // timestamp AND a rotated token, so confirm/unsubscribe links from any
    // previous session (which may have leaked via logs or referrers) can no
    // longer act on this subscription. The rotation also invalidates in-flight
    // emails for the previous session (their token lookup 404s).
    await existing.update({
      status: 'pending',
      subscribedAt: new Date(),
      unsubscribedAt: null,
      source,
      unsubscribeToken: NewsletterSubscriber.generateToken(),
      ...consentContext(context),
    });
    const confirmationQueued = await queueConfirmEmail(existing);
    if (!confirmationQueued) logger.warn(`[newsletter] Confirm email could not be queued for subscriber ${existing.id}`);
    return { pending: true, confirmationQueued };
  }
  // Token is generated in the model beforeCreate hook — no follow-up write needed.
  try {
    const subscriber = await NewsletterSubscriber.create({ email: normalized, source, status: 'pending', ...consentContext(context) });
    const confirmationQueued = await queueConfirmEmail(subscriber);
    if (!confirmationQueued) logger.warn(`[newsletter] Confirm email could not be queued for subscriber ${subscriber.id}`);
    return { pending: true, confirmationQueued };
  } catch (err) {
    // Two concurrent subscribes for the same new email can both pass the
    // findOne check above; the second create throws a unique violation.
    // Surface that as 409 instead of leaking 500.
    if (err && err.name === UNIQUE_VIOLATION) {
      throw new AppError('CONFLICT', 409, 'This email is already subscribed.');
    }
    throw err;
  }
};

/**
 * Activate a pending subscription after the owner clicks the confirm link.
 * Unsubscribed rows are never reactivated by a stale confirm link.
 */
const confirm = async (token) => {
  if (!token || typeof token !== 'string') throw new AppError('VALIDATION_ERROR', 400, 'Confirmation token is required.');
  // Atomic pending→active transition. The WHERE guard guarantees a concurrent
  // unsubscribe (any endpoint, any moment) can never be undone: if the row is
  // no longer pending when this UPDATE runs, it matches zero rows and we
  // report the current state instead of overwriting it.
  const [activated] = await NewsletterSubscriber.update(
    { status: 'active' },
    { where: { unsubscribeToken: token, status: 'pending' } },
  );
  if (!activated) {
    const subscriber = await NewsletterSubscriber.findOne({ where: { unsubscribeToken: token } });
    if (!subscriber) throw new AppError('NOT_FOUND', 404, 'Invalid confirmation token.');
    if (subscriber.status === 'active') return { alreadyConfirmed: true };
    return { cancelled: true };
  }
  const subscriber = await NewsletterSubscriber.findOne({ where: { unsubscribeToken: token } });
  const welcomeQueued = await queueWelcomeEmail(subscriber);
  if (!welcomeQueued) logger.warn(`[newsletter] Welcome email could not be queued for subscriber ${subscriber?.id}`);
  return { confirmed: true, welcomeQueued };
};

const getStatus = async (email) => {
  const subscriber = await NewsletterSubscriber.findOne({ where: { email: normalizeEmail(email) } });
  const subscribed = subscriber?.status === 'active';
  const pending = subscriber?.status === 'pending';
  // The marker only counts for the CURRENT consent session: resubscribing
  // bumps subscribedAt, which makes any older marker stale.
  const confirmationQueued = Boolean(
    pending
    && subscriber?.lastConfirmQueuedAt
    && subscriber?.subscribedAt
    && new Date(subscriber.lastConfirmQueuedAt).getTime() >= new Date(subscriber.subscribedAt).getTime(),
  );
  return { subscribed, pending, confirmationQueued };
};

const unsubscribeByToken = async (token) => {
  if (!token || typeof token !== 'string') throw new AppError('VALIDATION_ERROR', 400, 'Unsubscribe token is required.');
  const subscriber = await NewsletterSubscriber.findOne({ where: { unsubscribeToken: token } });
  if (!subscriber) throw new AppError('NOT_FOUND', 404, 'Invalid unsubscribe token.');
  if (subscriber.status === 'unsubscribed') return { alreadyUnsubscribed: true };
  await subscriber.update({ status: 'unsubscribed', unsubscribedAt: new Date() });
  return { unsubscribed: true };
};

// Public, no-auth unsubscribe by email — return the SAME response for
// "not found" and "already unsubscribed" so this endpoint cannot be used
// to enumerate the subscriber list.
const unsubscribe = async (email) => {
  if (!email) throw new AppError('VALIDATION_ERROR', 400, 'Email is required.');
  const normalized = normalizeEmail(email);
  const subscriber = await NewsletterSubscriber.findOne({ where: { email: normalized } });
  if (!subscriber) return { unsubscribed: true };
  if (subscriber.status === 'unsubscribed') return { unsubscribed: true };
  await subscriber.update({ status: 'unsubscribed', unsubscribedAt: new Date() });
  return { unsubscribed: true };
};

// Pure read — no DB writes. The token is generated in beforeCreate and
// backfilled in the migration, so no row should ever arrive without one.
// If one ever does (data drift), we treat the row as missing the token
// rather than silently writing during a GET.
const list = async (query = {}) => {
  const where = {};
  if (query.status) where.status = query.status;
  const requestedLimit = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, MAX_LIST_LIMIT)
    : 50;
  const requestedOffset = Number.parseInt(query.offset, 10);
  const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
  const { count, rows } = await NewsletterSubscriber.findAndCountAll({
    where,
    attributes: { exclude: ['unsubscribeToken', 'consentIp', 'consentUserAgent', 'lastConfirmQueuedAt'] },
    order: [['subscribed_at', 'DESC']],
    limit,
    offset,
  });
  return { subscribers: rows, total: count };
};

module.exports = { subscribe, confirm, getStatus, unsubscribe, unsubscribeByToken, list };
