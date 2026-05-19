'use strict';

const handlebars = require('handlebars');
const { Op } = require('sequelize');
const { NotificationTemplate, NotificationLog, NotificationQueue } = require('../index');
const { dispatch } = require('./notification.dispatcher');
const logger = require('../../utils/logger');

/**
 * Build the channel-specific payload from a compiled template.
 *
 * Email needs subject + html + text.
 * SMS / WhatsApp need only the body (we use bodyText for those).
 */
const buildPayload = (channel, to, subject, html, text) => {
    switch (channel) {
        case 'email':    return { to, subject, html, text };
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
        website_url:   process.env.CLIENT_URL || 'http://localhost:3000',
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
    t = null
) => {
    try {
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
        };

        if (channel === 'email') {
            jobData.recipientEmail = recipient;
        } else {
            jobData.recipientPhone = recipient;
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
    const jobs = await NotificationQueue.findAll({
        where: {
            status: 'queued',
            [Op.or]: [
                { nextAttemptAt: null },
                { nextAttemptAt: { [Op.lte]: new Date() } },
            ],
        },
        order: [['createdAt', 'ASC']],
        limit,
    });

    for (const job of jobs) {
        await job.update({ status: 'processing', lockedAt: new Date(), attempts: Number(job.attempts || 0) + 1, error: null });

        let subject = null;
        try {
            const template = await NotificationTemplate.findOne({ where: { name: job.templateName, channel: job.channel } });
            if (!template || !template.isActive) {
                await job.update({ status: 'skipped', error: template ? 'Template inactive' : 'Template missing' });
                await createLog({ job, status: 'skipped', error: template ? 'Template inactive' : 'Template missing' });
                continue;
            }

            const compiled = await compileTemplate(template, job.variables || {});
            subject = compiled.subject;
            const recipient = job.channel === 'email' ? job.recipientEmail : job.recipientPhone;
            const payload = buildPayload(job.channel, recipient, compiled.subject, compiled.html, compiled.text);
            const dispatched = await dispatch(job.channel, payload);
            const status = dispatched ? 'sent' : 'skipped';

            await job.update({ status, sentAt: dispatched ? new Date() : null, error: dispatched ? null : 'Channel disabled' });
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

    return jobs.length;
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
    const email = user.email;
    const phone = user.profile?.phone || user.UserProfile?.phone || null;

    const results = await Promise.allSettled(
        channels.map((channel) => {
            const recipient = channel === 'email' ? email : phone;
            if (!recipient) {
                logger.warn(`[notification.service] No recipient for channel '${channel}' on user ${user.id} — skipping.`);
                return Promise.resolve(false);
            }
            return send(templateName, recipient, variables, user.id, orderId, channel, t);
        })
    );

    return results.map((r) => r.status === 'fulfilled' && r.value === true);
};

const sendToAdmins = async (templateName, channels = ['email'], variables = {}, orderId = null, t = null) => {
    const { User, UserProfile } = require('../index');
    const admins = await User.findAll({
        where: { role: ['admin', 'super_admin'] },
        include: [{ model: UserProfile, as: 'profile', required: false }],
        transaction: t || undefined,
    });

    const manualRecipients = [
        ...parseRecipientList(process.env.ADMIN_NOTIFICATION_EMAIL).map((email) => ({ email })),
        ...parseRecipientList(process.env.ADMIN_NOTIFICATION_PHONE).map((phone) => ({ phone })),
    ];
    const recipients = [...admins, ...manualRecipients];

    const results = [];
    for (const recipientRecord of recipients) {
        const email = recipientRecord.email || null;
        const phone = recipientRecord.phone || recipientRecord.profile?.phone || null;

        for (const channel of channels) {
            const recipient = channel === 'email' ? email : phone;
            if (!recipient) continue;
            results.push(await send(templateName, recipient, variables, recipientRecord.id || null, orderId, channel, t));
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
const sendDeliveryUpdate = async (userId, orderId, status) => {
    try {
        const { User, Order } = require('../index');
        const { UserProfile } = require('../index');
        const user = await User.findByPk(userId, { include: [{ model: UserProfile, as: 'profile', required: false }] });
        const order = await Order.findByPk(orderId);

        if (!user || !order) return false;

        const templateName = status === 'delivered' ? 'order_delivered' : 'order_out_for_delivery';
        
        // Settings/Channels: usually we want Email + SMS for delivery updates
        const channels = ['email', 'sms'];

        return await sendToUser(templateName, channels, user, {
            order_number: order.orderNumber,
            order_id: order.id,
            status_label: status.replace(/_/g, ' '),
            customer_name: user.firstName || user.profile?.firstName || user.email || 'Customer'
        }, orderId);
    } catch (error) {
        logger.error(`[notification.service] Failed to send delivery update:`, error);
        return false;
    }
};

module.exports = { send, sendImmediate, sendToUser, sendToAdmins, sendDeliveryUpdate, processQueued };
