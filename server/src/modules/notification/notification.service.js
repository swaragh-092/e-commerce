'use strict';

const handlebars = require('handlebars');
const { NotificationTemplate, NotificationLog } = require('../index');
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
        const queryOptions = t ? { transaction: t } : {};

        // Fetch the template matching both name AND channel so each channel
        // can have its own copy of the message (shorter text for SMS, rich HTML for email)
        const template = await NotificationTemplate.findOne({
            where: { name: templateName, channel },
            ...queryOptions,
        });

        if (!template) {
            // Gracefully fall back to email template when a channel-specific one is absent
            logger.warn(`Notification template '${templateName}' not found for channel '${channel}'. Skipping.`);
            return false;
        }

        if (!template.isActive) {
            logger.debug(`Template '${templateName}' (${channel}) is inactive — skipping.`);
            return false;
        }

        // Inject global settings into variables so templates can use them dynamically
        // e.g. {{store_name}}, {{website_url}}, {{support_email}}
        const SettingsService = require('../settings/settings.service');
        const [general, seo, logo, footer] = await Promise.all([
            SettingsService.getByGroup('general'),
            SettingsService.getByGroup('seo'),
            SettingsService.getByGroup('logo'),
            SettingsService.getByGroup('footer')
        ]);

        const globalVars = {
            store_name:    general.storeName || 'Our Store',
            website_url:   process.env.CLIENT_URL || 'http://localhost:3000',
            support_email: footer.email || 'support@example.com',
            store_logo:    logo.main ? `${process.env.API_PUBLIC_URL || ''}${logo.main}` : null,
            copyright:     (footer.copyright || '© {{year}} {{store_name}}. All rights reserved.')
                            .replace('{{year}}', new Date().getFullYear())
                            .replace('{{store_name}}', general.storeName || 'Our Store'),
            current_year:  new Date().getFullYear()
        };

        const mergedVariables = { ...globalVars, ...variables };

        // Compile all three fields — Handlebars is cheap even if bodyText is empty
        const subject = handlebars.compile(template.subject)(mergedVariables);
        const html    = handlebars.compile(template.bodyHtml)(mergedVariables);
        const text    = handlebars.compile(template.bodyText || '')(mergedVariables);

        const payload = buildPayload(channel, recipient, subject, html, text);

        let status = 'sent';
        let errorMessage = null;

        try {
            const dispatched = await dispatch(channel, payload);
            if (!dispatched) {
                // Channel was disabled — not an error, just log accordingly
                status = 'skipped';
            }
        } catch (err) {
            logger.error(`[notification.service] Dispatch failed for ${templateName}/${channel}:`, err);
            status = 'failed';
            errorMessage = err.message;
        }

        // Persist log entry — always, even for failures
        const logData = {
            templateName,
            subject,
            status,
            error: errorMessage || null,
            userId:  userId  || null,
            orderId: orderId || null,
            channel,
        };

        // Route to the right recipient column
        if (channel === 'email') {
            logData.recipientEmail = recipient;
        } else {
            logData.recipientPhone = recipient;
            // recipientEmail stays null for SMS/WA
        }

        await NotificationLog.create(logData, queryOptions);

        return status === 'sent';

    } catch (error) {
        logger.error(`[notification.service] Unexpected error for ${templateName}:`, error);
        return false;
    }
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
    // phone lives on UserProfile — guard gracefully if profile not loaded
    const phone = user.UserProfile?.phone || null;

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

module.exports = { send, sendToUser };
