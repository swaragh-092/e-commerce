'use strict';

const { Op } = require('sequelize');
const { sequelize, NewsletterCampaign, NewsletterSubscriber, NotificationQueue } = require('../index');
const NotificationService = require('../notification/notification.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const firstUrl = (fallback) => (process.env.CLIENT_URL || fallback).split(',')[0].trim().replace(/\/+$/, '');

const unsubscribeUrl = (token) => `${firstUrl('http://localhost:5173')}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;

const confirmUrl = (token) => `${firstUrl('http://localhost:5173')}/newsletter/confirm?token=${encodeURIComponent(token)}`;

// RFC 8058 List-Unsubscribe target: providers POST here with the token in the
// query string. Prefer the API origin; fall back to same-origin /api path.
const oneClickUnsubscribeUrl = (token) => {
  const apiBase = (process.env.API_PUBLIC_URL || '').split(',')[0].trim().replace(/\/+$/, '')
    || firstUrl('http://localhost:5173');
  const apiOrigin = apiBase.replace(/\/api$/i, '');
  return `${apiOrigin}/api/newsletter/unsubscribe/one-click?token=${encodeURIComponent(token)}`;
};

const validateContent = (input) => {
  if (typeof input.subject !== 'string' || !input.subject.trim() || input.subject.trim().length > 200 || /[\r\n]/.test(input.subject)) throw new AppError('VALIDATION_ERROR', 400, 'Enter a subject of 1–200 characters on one line');
  if (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 20000) throw new AppError('VALIDATION_ERROR', 400, 'Enter a message of 1–20,000 characters');
  return { subject: input.subject.trim(), message: input.message.trim() };
};

const create = (input, userId) => NewsletterCampaign.create({ ...validateContent(input), createdBy: userId });

const edit = async (id, input) => {
  const content = validateContent(input);
  return sequelize.transaction(async (transaction) => {
    const campaign = await NewsletterCampaign.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!campaign) throw new AppError('NOT_FOUND', 404, 'Campaign not found');
    if (campaign.status !== 'draft') throw new AppError('CONFLICT', 409, 'Only draft campaigns can be edited');
    await campaign.update(content, { transaction });
    return campaign;
  });
};

const schedule = async (id, scheduledAt) => {
  const date = scheduledAt ? new Date(scheduledAt) : new Date();
  if (!Number.isFinite(date.getTime()) || (scheduledAt && date.getTime() < Date.now() - 1000)) throw new AppError('VALIDATION_ERROR', 400, 'Choose a valid future send time');
  return sequelize.transaction(async (transaction) => {
    const campaign = await NewsletterCampaign.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!campaign) throw new AppError('NOT_FOUND', 404, 'Campaign not found');
    if (campaign.status !== 'draft') throw new AppError('CONFLICT', 409, 'Only draft campaigns can be scheduled');
    await campaign.update({ status: 'scheduled', scheduledAt: date }, { transaction });
    return campaign;
  });
};

const cancel = async (id) => sequelize.transaction(async (transaction) => {
  const campaign = await NewsletterCampaign.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!campaign) throw new AppError('NOT_FOUND', 404, 'Campaign not found');
  if (!['draft', 'scheduled'].includes(campaign.status)) throw new AppError('CONFLICT', 409, 'This campaign has already been queued for delivery');
  await campaign.update({ status: 'cancelled' }, { transaction });
  return campaign;
});

const list = async () => {
  const campaigns = await NewsletterCampaign.findAll({ order: [['createdAt', 'DESC']], limit: 30 });
  const results = [];
  for (const campaign of campaigns) {
    const counts = await NotificationQueue.findAll({
      where: { dedupeKey: { [Op.like]: `newsletter:${campaign.id}:%` } },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['status'], raw: true,
    });
    results.push({ ...campaign.toJSON(), delivery: Object.fromEntries(counts.map((row) => [row.status, Number(row.count)])) });
  }
  return results;
};

// A campaign interrupted mid-queue (crash/deploy) sits in 'sending'. Dedupe
// keys make re-queueing idempotent, so we can safely return it to
// 'scheduled' after a grace period.
const SENDING_LOCK_MS = 15 * 60 * 1000;
const reclaimStuckSending = async () => {
  const [count] = await NewsletterCampaign.update(
    { status: 'scheduled' },
    { where: { status: 'sending', updatedAt: { [Op.lt]: new Date(Date.now() - SENDING_LOCK_MS) } } },
  );
  if (count > 0) logger.warn(`[newsletterCampaign] Reclaimed ${count} stuck 'sending' campaign(s) back to 'scheduled'`);
  return count;
};

const queueDue = async () => {
  if (!await require('../../middleware/featureGate.middleware').getResolvedFeature('newsletter')) return;
  await reclaimStuckSending();
  const due = await NewsletterCampaign.findAll({ where: { status: 'scheduled', scheduledAt: { [Op.lte]: new Date() } }, attributes: ['id'], limit: 5 });
  for (const { id } of due) {
    // Short claim transaction: flip scheduled → sending under a row lock so
    // concurrent ticks/instances cannot double-queue, without holding the
    // lock across the whole subscriber loop.
    const claimed = await sequelize.transaction(async (transaction) => {
      const campaign = await NewsletterCampaign.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!campaign || campaign.status !== 'scheduled') return null;
      await campaign.update({ status: 'sending' }, { transaction });
      return campaign;
    });
    if (!claimed) continue;

    try {
      let lastId = null;
      let recipientCount = 0;
      while (true) {
        const subscribers = await NewsletterSubscriber.findAll({
          where: { status: 'active', ...(lastId ? { id: { [Op.gt]: lastId } } : {}) },
          order: [['id', 'ASC']], limit: 200,
        });
        if (!subscribers.length) break;
        for (const subscriber of subscribers) {
          if (!subscriber.unsubscribeToken) continue;
          const dedupeKey = `newsletter:${claimed.id}:${subscriber.id}`;
          const queued = await NotificationService.send('newsletter_campaign', subscriber.email, {
            campaign_subject: claimed.subject, campaign_message: claimed.message,
            campaign_id: claimed.id, subscriber_id: subscriber.id,
            subscribed_at: new Date(subscriber.subscribedAt).toISOString(),
            unsubscribe_url: unsubscribeUrl(subscriber.unsubscribeToken),
          }, null, null, 'email', null, dedupeKey);
          if (!queued) {
            // send() also returns false when the dedupe key already exists
            // (e.g. after a reclaim). Only fail when nothing is queued at all.
            const alreadyQueued = await NotificationQueue.findOne({ where: { dedupeKey } });
            if (!alreadyQueued) throw new AppError('NOTIFICATION_UNAVAILABLE', 503, 'Newsletter template is unavailable; campaign will be retried');
          }
          recipientCount++;
        }
        lastId = subscribers[subscribers.length - 1].id;
      }
      await claimed.update({ status: 'queued', queuedAt: new Date(), recipientCount });
    } catch (error) {
      // Leave the row in 'sending'; the reaper returns it to 'scheduled' so
      // the next tick retries with dedupe-safe inserts.
      logger.error(`[newsletterCampaign] Queueing failed for campaign ${claimed.id}:`, error);
      throw error;
    }
  }
};

const test = async (input, user) => {
  const content = validateContent(input);
  const sent = await NotificationService.sendImmediate('newsletter_campaign', user.email, {
    campaign_subject: `[Test] ${content.subject}`, campaign_message: content.message,
    unsubscribe_url: `${firstUrl('http://localhost:5173')}/account`,
    is_test: true,
  }, user.id);
  if (!sent) throw new AppError('NOTIFICATION_UNAVAILABLE', 503, 'Enable email delivery and the newsletter template before testing');
  return { sent: true };
};

module.exports = { create, edit, schedule, cancel, list, queueDue, test, unsubscribeUrl, confirmUrl, oneClickUnsubscribeUrl };
