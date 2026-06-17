'use strict';

const { NewsletterSubscriber, Sequelize } = require('../index');
const AppError = require('../../utils/AppError');

const UNIQUE_VIOLATION = 'SequelizeUniqueConstraintError';

const subscribe = async (email, source = 'homepage') => {
  const normalized = email.trim().toLowerCase();
  const existing = await NewsletterSubscriber.findOne({ where: { email: normalized } });
  if (existing) {
    if (existing.status === 'active') return { alreadySubscribed: true, unsubscribeToken: existing.unsubscribeToken };
    await existing.update({ status: 'active', subscribedAt: new Date(), unsubscribedAt: null, source });
    return { resubscribed: true, unsubscribeToken: existing.unsubscribeToken };
  }
  // Token is generated in the model beforeCreate hook — no follow-up write needed.
  try {
    const subscriber = await NewsletterSubscriber.create({ email: normalized, source });
    return { subscribed: true, unsubscribeToken: subscriber.unsubscribeToken };
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
  const normalized = email.trim().toLowerCase();
  const subscriber = await NewsletterSubscriber.findOne({ where: { email: normalized } });
  if (!subscriber) return { unsubscribed: true };
  if (subscriber.status === 'unsubscribed') return { unsubscribed: true };
  await subscriber.update({ status: 'unsubscribed', unsubscribedAt: new Date() });
  return { unsubscribed: true };
};

const getUnsubscribeToken = async (subscriber) => {
  if (!subscriber) return null;
  return subscriber.unsubscribeToken || null;
};

// Pure read — no DB writes. The token is generated in beforeCreate and
// backfilled in the migration, so no row should ever arrive without one.
// If one ever does (data drift), we treat the row as missing the token
// rather than silently writing during a GET.
const list = async (query = {}) => {
  const where = {};
  if (query.status) where.status = query.status;
  const { count, rows } = await NewsletterSubscriber.findAndCountAll({
    where,
    order: [['subscribed_at', 'DESC']],
    limit: parseInt(query.limit) || 50,
    offset: parseInt(query.offset) || 0,
  });
  return { subscribers: rows, total: count };
};

module.exports = { subscribe, unsubscribe, unsubscribeByToken, getUnsubscribeToken, list };
