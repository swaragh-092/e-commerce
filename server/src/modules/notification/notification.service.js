'use strict';

const handlebars = require('handlebars');
const { Op } = require('sequelize');
const { sequelize, NotificationTemplate, NotificationLog, NotificationQueue, InventoryAlert } = require('../index');
const { dispatch } = require('./notification.dispatcher');
const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');

const INVENTORY_ALERT_TEMPLATE = 'inventory_alert_digest';
const INVENTORY_ALERT_RETRY_DELAY_MS = 15 * 60 * 1000;
const NEWSLETTER_TEMPLATES = new Set(['newsletter_campaign', 'newsletter_confirmation', 'newsletter_confirm']);
const NEWSLETTER_TEMPLATE_LIST = [...NEWSLETTER_TEMPLATES];
const PROCESSING_LOCK_MS = 10 * 60 * 1000;

/**
 * Build the channel-specific payload from a compiled template.
 *
 * Email needs subject + html + text.
 * SMS / WhatsApp need only the body (we use bodyText for those).
 */
const buildPayload = (channel, to, subject, html, text, headers = null) => {
    switch (channel) {
        case 'email':    return { to, subject, html, text, ...(headers ? { headers } : {}) };
        case 'sms':      return { to, body: text || subject };
        case 'whatsapp': return { to, body: text || subject };
        default:         return { to, body: text || subject };
    }
};

const parseRecipientList = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeVariables = (variables = {}) => {
    const normalized = { ...variables };

    if (normalized.orderNumber && !normalized.order_number) normalized.order_number = normalized.orderNumber;
    if (normalized.orderId && !normalized.order_id) normalized.order_id = normalized.orderId;
    if (normalized.orderDate && !normalized.order_date) normalized.order_date = normalized.orderDate;
    if (normalized.paymentMethod && !normalized.payment_method) normalized.payment_method = normalized.paymentMethod;
    if (normalized.total !== undefined && normalized.order_total === undefined) normalized.order_total = normalized.total;
    if (normalized.firstName && !normalized.customer_name) normalized.customer_name = normalized.firstName;
    if (normalized.storeName && !normalized.store_name) normalized.store_name = normalized.storeName;
    if (normalized.supportEmail && !normalized.support_email) normalized.support_email = normalized.supportEmail;

    return normalized;
};

const getGlobalVariables = async () => {
    const SettingsService = require('../settings/settings.service');
    const [general, seo, logo, footer] = await Promise.all([
        SettingsService.getByGroup('general'),
        SettingsService.getByGroup('seo'),
        SettingsService.getByGroup('logo'),
        SettingsService.getByGroup('footer')
    ]);

    return {
        store_name:    general.storeName || 'Our Store',
        website_url:   (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, ''),
        support_email: footer.email || 'support@example.com',
        store_logo:    logo.main ? `${process.env.API_PUBLIC_URL || ''}${logo.main}` : null,
        copyright:     (footer.copyright || '© {{year}} {{store_name}}. All rights reserved.')
                        .replace('{{year}}', new Date().getFullYear())
                        .replace('{{store_name}}', general.storeName || 'Our Store'),
        current_year:  new Date().getFullYear(),
    };
};

const compileTemplate = async (template, variables = {}) => {
    const mergedVariables = { ...(await getGlobalVariables()), ...normalizeVariables(variables) };
    const subject = handlebars.compile(template.subject || '')(mergedVariables);
    const html = handlebars.compile(template.bodyHtml || '')(mergedVariables);
    const text = handlebars.compile(template.bodyText || '')(mergedVariables);
    return { subject, html, text };
};

const createLog = async ({ job, subject = null, status, error = null }, transaction = null) => {
    const logData = {
        templateName: job.templateName,
        subject,
        status,
        error,
        userId: job.userId || null,
        orderId: job.orderId || null,
        channel: job.channel,
    };

    if (job.channel === 'email') {
        logData.recipientEmail = job.recipientEmail;
    } else {
        logData.recipientPhone = job.recipientPhone;
    }

    await NotificationLog.create(logData, transaction ? { transaction } : {});
};

const markInventoryAlertsDelivered = async (job, deliveredAt) => {
    const alertIds = [...new Set(job?.variables?.inventory_alert_ids || [])].filter(Boolean);
    if (job?.templateName !== INVENTORY_ALERT_TEMPLATE || !alertIds.length) return;

    try {
        await InventoryAlert.update(
            { lastNotifiedAt: deliveredAt },
            {
                where: {
                    id: { [Op.in]: alertIds },
                    status: { [Op.in]: ['open', 'acknowledged'] },
                },
            },
        );
    } catch (error) {
        // Delivery succeeded; a bookkeeping failure must not re-send the email.
        logger.error('[notification.service] Failed to record inventory alert delivery:', error);
    }
};

/**
 * Core send — look up a template by (name + channel), compile it,
 * dispatch to the correct channel, and log the result.
 *
 * @param {string}  templateName     - Template `name` in DB
 * @param {string}  recipient        - Email address (email) or E.164 phone (sms/whatsapp)
 * @param {Object}  [variables={}]   - Handlebars variables
 * @param {string}  [userId]         - For notification_logs FK
 * @param {string}  [orderId]        - For notification_logs FK
 * @param {string}  [channel='email']- 'email' | 'sms' | 'whatsapp'
 * @param {Object}  [t]              - Sequelize transaction
 * @returns {Promise<boolean>}       - true if sent, false if skipped/failed
 */
const send = async (
    templateName,
    recipient,
    variables = {},
    userId = null,
    orderId = null,
    channel = 'email',
    t = null,
    dedupeKey = null,
    skipRules = false
) => {
    // Defensively handle positional argument variations (e.g. if a transaction is passed as channel or orderId)
    if (orderId && typeof orderId === 'object' && !Array.isArray(orderId)) {
        t = orderId;
        orderId = null;
        channel = 'email';
    } else if (channel && typeof channel === 'object' && !Array.isArray(channel)) {
        t = channel;
        channel = 'email';
    } else if (!channel || typeof channel !== 'string') {
        channel = 'email';
    }
    try {
        if (!skipRules) {
            const routed = await require('./notificationRules.service').route({ sourceTemplate: templateName,
                variables: normalizeVariables(variables), orderId, transaction: t });
            if (routed !== null) return routed.some(Boolean);
        }
        const normalizedVariables = normalizeVariables({
            ...(orderId && !variables.order_id && !variables.orderId ? { order_id: orderId } : {}),
            ...variables,
        });
        const queryOptions = t ? { transaction: t } : {};
        const template = await NotificationTemplate.findOne({
            where: { name: templateName, channel },
            ...queryOptions,
        });

        if (!template) {
            logger.warn(`Notification template '${templateName}' not found for channel '${channel}'. Queue skipped.`);
            return false;
        }

        if (!template.isActive) {
            logger.debug(`Template '${templateName}' (${channel}) is inactive — queue skipped.`);
            return false;
        }

        const jobData = {
            templateName,
            userId:  userId  || null,
            orderId: orderId || null,
            channel,
            variables: normalizedVariables,
            status: 'queued',
            nextAttemptAt: new Date(),
            ...(dedupeKey ? { dedupeKey } : {}),
        };

        if (channel === 'email') {
            jobData.recipientEmail = recipient;
        } else {
            jobData.recipientPhone = recipient;
        }

        if (dedupeKey) {
            const [existing, created] = await NotificationQueue.findOrCreate({
                where: { dedupeKey },
                defaults: jobData,
                ...queryOptions,
            });
            if (created) return true;

            const lastAttemptAt = new Date(existing.updatedAt || existing.createdAt).getTime();
            const retryableInventoryAlert = templateName === INVENTORY_ALERT_TEMPLATE
                && ['failed', 'skipped'].includes(existing.status)
                && Number.isFinite(lastAttemptAt)
                && Date.now() - lastAttemptAt >= INVENTORY_ALERT_RETRY_DELAY_MS;
            if (!retryableInventoryAlert) return false;

            await existing.update({
                ...jobData,
                attempts: 0,
                lockedAt: null,
                sentAt: null,
                error: null,
            });
            return true;
        }
        await NotificationQueue.create(jobData, queryOptions);

        return true;

    } catch (error) {
        logger.error(`[notification.service] Unexpected queue error for ${templateName}:`, error);
        return false;
    }
};

const sendImmediate = async (
    templateName,
    recipient,
    variables = {},
    userId = null,
    orderId = null,
    channel = 'email'
) => {
    if (NEWSLETTER_TEMPLATES.has(templateName)) {
        let enabled = false;
        try { enabled = await require('../../middleware/featureGate.middleware').getResolvedFeature('newsletter'); }
        catch (_) { /* Fail closed when the platform feature state cannot be read. */ }
        if (!enabled) throw new AppError('FEATURE_DISABLED', 403, 'Newsletter delivery is disabled');
    }

    const template = await NotificationTemplate.findOne({
        where: { name: templateName, channel },
    });

    if (!template) {
        logger.warn(`Notification template '${templateName}' not found for channel '${channel}'. Send skipped.`);
        return false;
    }

    if (!template.isActive) {
        logger.debug(`Template '${templateName}' (${channel}) is inactive. Send skipped.`);
        return false;
    }

    const compiled = await compileTemplate(template, normalizeVariables(variables));
    const payload = buildPayload(channel, recipient, compiled.subject, compiled.html, compiled.text);
    const job = {
        templateName,
        userId,
        orderId,
        channel,
        recipientEmail: channel === 'email' ? recipient : null,
        recipientPhone: channel === 'email' ? null : recipient,
    };

    try {
        const dispatched = await dispatch(channel, payload);
        await createLog({
            job,
            subject: compiled.subject,
            status: dispatched ? 'sent' : 'skipped',
            error: dispatched ? null : 'Channel disabled',
        });
        return dispatched;
    } catch (err) {
        await createLog({ job, subject: compiled.subject, status: 'failed', error: err.message });
        throw err;
    }
};

const processQueued = async ({ limit = 25 } = {}) => {
    // Recover jobs stuck in 'processing' (e.g. crash between claim and final
    // update). Without this reaper those emails are silently lost forever.
    // A crashed job already had attempts incremented at claim time, so the
    // recovery MUST respect maxAttempts: exhausted jobs are failed outright,
    // never requeued for another dispatch attempt.
    const staleLock = { status: 'processing', lockedAt: { [Op.lt]: new Date(Date.now() - PROCESSING_LOCK_MS) } };
    const [exhaustedFailed] = await NotificationQueue.update(
        { status: 'failed', lockedAt: null, error: 'Retry limit reached after interrupted processing' },
        {
            where: {
                ...staleLock,
                [Op.and]: [sequelize.where(sequelize.col('attempts'), Op.gte, sequelize.col('max_attempts'))],
            },
        },
    );
    if (exhaustedFailed > 0) logger.warn(`[notification.service] Failed ${exhaustedFailed} stale 'processing' job(s) that exhausted their retry limit`);
    const [reclaimed] = await NotificationQueue.update(
        { status: 'queued', lockedAt: null, error: 'Recovered from stale processing lock' },
        {
            where: {
                ...staleLock,
                [Op.and]: [sequelize.where(sequelize.col('attempts'), Op.lt, sequelize.col('max_attempts'))],
            },
        },
    );
    if (reclaimed > 0) logger.warn(`[notification.service] Reclaimed ${reclaimed} stale 'processing' queue job(s)`);

    // Pause marketing deliveries while the feature is off, retaining consent
    // records and queued work. Transactional mail continues independently.
    let newsletterEnabled = false;
    try { newsletterEnabled = await require('../../middleware/featureGate.middleware').getResolvedFeature('newsletter'); }
    catch (error) { logger.warn('Could not resolve newsletter capability; marketing delivery paused'); }
    const jobs = await NotificationQueue.findAll({
        where: {
            status: 'queued',
            ...(!newsletterEnabled ? { templateName: { [Op.notIn]: NEWSLETTER_TEMPLATE_LIST } } : {}),
            [Op.or]: [
                { nextAttemptAt: null },
                { nextAttemptAt: { [Op.lte]: new Date() } },
            ],
        },
        order: [['createdAt', 'ASC']],
        limit,
    });

    let processedCount = 0;
    for (const job of jobs) {
        const claim = { status: 'processing', lockedAt: new Date(), attempts: Number(job.attempts || 0) + 1, error: null };
        const [claimed] = await NotificationQueue.update(claim, { where: { id: job.id, status: 'queued' } });
        if (!claimed) continue;
        Object.assign(job, claim);
        processedCount++;

        // Defense in depth: never dispatch beyond the retry budget, even if a
        // row reached 'queued' with attempts already at/over the cap.
        if (Number(job.attempts) > Number(job.maxAttempts || 3)) {
            await job.update({ status: 'failed', lockedAt: null, error: 'Retry limit exceeded' });
            await createLog({ job, status: 'failed', error: 'Retry limit exceeded' });
            continue;
        }

        let subject = null;
        try {
            const ruleMeta = job.variables?.__notificationRule;
            if (ruleMeta && !await require('./notificationRules.service').canDeliver(job)) {
                const reason = 'Notification disabled or recipient is no longer selected or eligible';
                await job.update({ status: 'skipped', error: reason });
                await createLog({ job, status: 'skipped', error: reason });
                continue;
            }
            if (['order_assigned_staff', 'enquiry_assigned_staff'].includes(job.templateName)) {
                const kind = job.templateName === 'order_assigned_staff' ? 'orders' : 'enquiries';
                const id = kind === 'orders' ? job.variables?.order_id : job.variables?.enquiry_id;
                const eligible = await require('./notificationAssignment.service').canReceive(kind, id, job.userId, job.recipientEmail);
                if (!eligible) {
                    await job.update({ status: 'skipped', error: 'Staff assignment changed or recipient is no longer eligible' });
                    await createLog({ job, status: 'skipped', error: 'Staff assignment changed or recipient is no longer eligible' });
                    continue;
                }
            }
            if (job.templateName === 'staff_invitation') {
                const { PasswordResetToken, User } = require('../index');
                const invitation = job.variables?.invitation_token_id ? await PasswordResetToken.findOne({ where: { id: job.variables.invitation_token_id, userId: job.userId, purpose: 'staff_invitation' } }) : null;
                const user = invitation ? await User.findOne({ where: { id: job.userId, email: job.recipientEmail, status: 'active' } }) : null;
                if (!user || invitation.expiresAt <= new Date()) {
                    await job.update({ status: 'skipped', error: 'Staff invitation expired or was replaced' });
                    await createLog({ job, status: 'skipped', error: 'Staff invitation expired or was replaced' });
                    continue;
                }
            }
            // Consent re-check: campaigns/welcome mail require an active
            // subscription; confirm mail requires it to still be pending.
            // The subscribed_at match invalidates jobs queued before a
            // resubscribe (fresh consent session).
            let newsletterSubscriber = null;
            if (NEWSLETTER_TEMPLATES.has(job.templateName)) {
                const { NewsletterSubscriber } = require('../index');
                const requiredStatus = job.templateName === 'newsletter_confirm' ? 'pending' : 'active';
                newsletterSubscriber = job.variables?.subscriber_id && job.variables?.subscribed_at
                    ? await NewsletterSubscriber.findOne({ where: { id: job.variables.subscriber_id, email: job.recipientEmail, status: requiredStatus } }) : null;
                if (!newsletterSubscriber || new Date(newsletterSubscriber.subscribedAt).toISOString() !== job.variables?.subscribed_at) {
                    const skipError = 'Newsletter consent is no longer active for this subscription';
                    await job.update({ status: 'skipped', error: skipError });
                    await createLog({ job, status: 'skipped', error: skipError });
                    continue;
                }
            }
            const template = ruleMeta ? { ...ruleMeta.message, isActive: true }
                : await NotificationTemplate.findOne({ where: { name: job.templateName, channel: job.channel } });
            if (!template || !template.isActive) {
                await job.update({ status: 'skipped', error: template ? 'Template inactive' : 'Template missing' });
                await createLog({ job, status: 'skipped', error: template ? 'Template inactive' : 'Template missing' });
                continue;
            }

            const compiled = await compileTemplate(template, job.variables || {});
            subject = compiled.subject;
            const recipient = job.channel === 'email' ? job.recipientEmail : job.recipientPhone;
            // RFC 8058 one-click unsubscribe headers on marketing mail.
            let headers = null;
            if (job.channel === 'email' && ['newsletter_campaign', 'newsletter_confirmation'].includes(job.templateName) && newsletterSubscriber?.unsubscribeToken) {
                const oneClick = require('../newsletter/newsletterCampaign.service').oneClickUnsubscribeUrl(newsletterSubscriber.unsubscribeToken);
                headers = { 'List-Unsubscribe': `<${oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
            }
            const payload = buildPayload(job.channel, recipient, compiled.subject, compiled.html, compiled.text, headers);
            const dispatched = await dispatch(job.channel, payload);
            const status = dispatched ? 'sent' : 'skipped';

            await job.update({ status, sentAt: dispatched ? new Date() : null, error: dispatched ? null : 'Channel disabled' });
            if (dispatched) await markInventoryAlertsDelivered(job, job.sentAt || new Date());
            await createLog({ job, subject, status, error: dispatched ? null : 'Channel disabled' });
        } catch (err) {
            const attempts = Number(job.attempts || 0);
            const failedPermanently = attempts >= Number(job.maxAttempts || 3);
            const delayMinutes = Math.min(60, attempts * 5);
            await job.update({
                status: failedPermanently ? 'failed' : 'queued',
                error: err.message,
                nextAttemptAt: failedPermanently ? null : new Date(Date.now() + delayMinutes * 60 * 1000),
            });
            if (failedPermanently) {
                await createLog({ job, subject, status: 'failed', error: err.message });
            }
            logger.error(`[notification.service] Queue job failed ${job.id}:`, err);
        }
    }

    return processedCount;
};

/**
 * Convenience helper: send the same event across multiple channels at once.
 *
 * Looks up the user's email and phone from the pre-loaded `user` object
 * (which must include the UserProfile association loaded).
 *
 * @param {string}   templateName   - Base template name (e.g. 'order_placed')
 * @param {string[]} channels       - ['email', 'sms', 'whatsapp']
 * @param {Object}   user           - User instance with user.email + user.UserProfile.phone
 * @param {Object}   variables      - Handlebars variables
 * @param {string}   [orderId]      - For logs
 * @param {Object}   [t]            - Sequelize transaction
 */
const sendToUser = async (templateName, channels, user, variables = {}, orderId = null, t = null) => {
    const routed = await require('./notificationRules.service').route({ sourceTemplate: templateName,
        variables: normalizeVariables(variables), orderId, transaction: t,
        customer: user ? { id: user.id, name: user.firstName || user.email, email: user.email, phone: user.profile?.phone || user.UserProfile?.phone || '' } : null });
    if (routed !== null) return routed;
    if (!user) return [];
    const email = user.email;
    const phone = user.profile?.phone || user.UserProfile?.phone || null;

    const results = await Promise.allSettled(
        channels.map((channel) => {
            const recipient = channel === 'email' ? email : phone;
            if (!recipient) {
                logger.warn(`[notification.service] No recipient for channel '${channel}' on user ${user.id} — skipping.`);
                return Promise.resolve(false);
            }
            return send(templateName, recipient, variables, user.id, orderId, channel, t, null, true);
        })
    );

    return results.map((r) => r.status === 'fulfilled' && r.value === true);
};

const sendToAdmins = async (templateName, channels = ['email'], variables = {}, orderId = null, t = null) => {
    const routed = await require('./notificationRules.service').route({ sourceTemplate: templateName,
        variables: normalizeVariables(variables), orderId, transaction: t });
    if (routed !== null) return routed;
    const recipientsService = require('./notificationRecipients.service');
    const configuredRecipients = await recipientsService.getConfiguredRecipients(templateName, t);
    const needsDefaults = configuredRecipients === null || channels.some((channel) => channel !== 'email');
    // Never fall back to a raw role query: custom roles can carry baseRole=admin
    // without possessing the operational permission required for this template.
    const eligibleRecipients = needsDefaults
        ? await recipientsService.getEligibleRecipientsForTemplate(templateName, t)
        : [];

    const manualRecipients = [
        ...parseRecipientList(process.env.ADMIN_NOTIFICATION_EMAIL).map((email) => ({ email })),
        ...parseRecipientList(process.env.ADMIN_NOTIFICATION_PHONE).map((phone) => ({ phone })),
    ];
    const defaultRecipients = [...eligibleRecipients, ...manualRecipients];

    const results = [];
    for (const channel of channels) {
        const recipients = channel === 'email' && configuredRecipients !== null ? configuredRecipients : defaultRecipients;
        const seen = new Set();
        for (const recipientRecord of recipients) {
            const email = recipientRecord.email || null;
            const phone = recipientRecord.phone || recipientRecord.profile?.phone || null;
            const recipient = channel === 'email' ? email : phone;
            if (!recipient) continue;
            const recipientKey = channel === 'email' ? recipient.toLowerCase() : recipient;
            if (seen.has(recipientKey)) continue;
            seen.add(recipientKey);
            results.push(await send(templateName, recipient, variables, recipientRecord.id || null, orderId, channel, t, null, true));
        }
    }

    return results;
};

/**
 * Send a notification when a shipment's status changes (e.g. out for delivery, delivered).
 *
 * @param {string} userId - Recipient user ID
 * @param {string} orderId - Related order ID
 * @param {string} status - New shipment status (out_for_delivery, delivered, etc)
 */
const sendDeliveryUpdate = async (userId, orderId, status, eventId = null) => {
    try {
        const { User, Order } = require('../index');
        const { UserProfile } = require('../index');
        const user = await User.findByPk(userId, { include: [{ model: UserProfile, as: 'profile', required: false }] });
        const order = await Order.findByPk(orderId);

        if (!order) return false;

        const isException = ['delivery_failed', 'rto_initiated', 'rto_in_transit', 'rto'].includes(status);
        const templateName = isException ? 'delivery_exception' : status === 'delivered' ? 'order_delivered' : 'order_out_for_delivery';
        
        // Settings/Channels: usually we want Email + SMS for delivery updates
        const channels = isException ? ['email'] : ['email', 'sms'];

        return await sendToUser(templateName, channels, user, {
            order_number: order.orderNumber,
            order_id: order.id,
            status_label: status.replace(/_/g, ' '),
            notification_event_id: eventId,
            customer_name: user?.firstName || user?.email || 'Customer'
        }, orderId);
    } catch (error) {
        logger.error(`[notification.service] Failed to send delivery update:`, error);
        return false;
    }
};

const sendOnce = (templateName, recipient, variables = {}, userId = null, orderId = null, channel = 'email', dedupeKey) => {
    if (!dedupeKey) return Promise.resolve(false);
    return send(templateName, recipient, variables, userId, orderId, channel, null, dedupeKey);
};
const sendEvent = (eventKey, context = {}) => {
    const event = require('./notification.events').findEvent(eventKey);
    if (!event) return Promise.resolve(null);
    return require('./notificationRules.service').route({ ...context, sourceTemplate: context.sourceTemplate || event.customerTemplate });
};
module.exports = { send, sendOnce, sendImmediate, sendToUser, sendToAdmins, sendDeliveryUpdate, processQueued, normalizeVariables, compileTemplate, buildPayload, sendEvent };
