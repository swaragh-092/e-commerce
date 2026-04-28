'use strict';

const nodemailer = require('nodemailer');
const logger = require('../../../utils/logger');
const SettingsService = require('../../settings/settings.service');

// Startup check — warn in production if SMTP credentials are missing
if (process.env.NODE_ENV === 'production' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
    logger.warn('WARNING: SMTP_USER or SMTP_PASS is missing in production. Emails may silently fail unless configured in DB.');
}

const createTransporter = async () => {
    const creds = await SettingsService.getByGroup('messaging_credentials');
    const config = await SettingsService.getByGroup('messaging');

    return nodemailer.createTransport({
        host: creds.smtp_host || process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: parseInt(creds.smtp_port) || parseInt(process.env.SMTP_PORT) || 2525,
        // true only for port 465 (implicit TLS)
        secure: (creds.smtp_secure !== undefined ? creds.smtp_secure === 'true' || creds.smtp_secure === true : process.env.SMTP_SECURE === 'true'),
        auth: {
            user: creds.smtp_user || process.env.SMTP_USER,
            pass: creds.smtp_pass || process.env.SMTP_PASS,
        },
    });
};

/**
 * Send a transactional email via SMTP.
 *
 * @param {Object} payload
 * @param {string} payload.to          - Recipient email address
 * @param {string} payload.subject     - Compiled subject line
 * @param {string} payload.html        - Compiled HTML body
 * @param {string} payload.text        - Compiled plain-text body
 * @returns {Promise<boolean>}
 */
const send = async ({ to, subject, html, text }) => {
    if (process.env.NODE_ENV === 'test') {
        // Skip actual delivery in test environments — log only
        logger.debug(`[email.channel] TEST MODE — skipping send to ${to}`);
        return true;
    }

    const transporter = await createTransporter();
    const config = await SettingsService.getByGroup('messaging');
    const creds = await SettingsService.getByGroup('messaging_credentials');

    await transporter.sendMail({
        from: config.emailFrom || creds.email_from || process.env.EMAIL_FROM || '"E-Commerce Store" <noreply@example.com>',
        to,
        subject,
        text,
        html,
    });

    return true;
};

module.exports = { send };
