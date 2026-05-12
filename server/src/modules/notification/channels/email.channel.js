'use strict';

const nodemailer = require('nodemailer');
const logger = require('../../../utils/logger');
const SettingsService = require('../../settings/settings.service');

const toBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const requireSetting = (value, label) => {
    if (value === undefined || value === null || String(value).trim() === '') {
        throw new Error(`${label} is required in Admin Settings > Notifications.`);
    }
    return String(value).trim();
};

const createTransporter = async () => {
    const creds = await SettingsService.getByGroup('messaging_credentials', { maskSensitive: false });
    const host = requireSetting(creds.smtp_host, 'SMTP Host');
    const port = Number.parseInt(creds.smtp_port, 10) || 587;
    const user = requireSetting(creds.smtp_user, 'SMTP User');
    const pass = requireSetting(creds.smtp_pass, 'SMTP Password');

    return nodemailer.createTransport({
        host,
        port,
        secure: toBoolean(creds.smtp_secure, port === 465),
        auth: {
            user,
            pass,
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
    const creds = await SettingsService.getByGroup('messaging_credentials', { maskSensitive: false });
    const general = await SettingsService.getByGroup('general');

    const storeName = general.storeName || 'E-Commerce Store';
    const defaultFrom = creds.smtp_user ? `"${storeName}" <${creds.smtp_user}>` : null;

    await transporter.sendMail({
        from: config.emailFrom || defaultFrom || requireSetting(creds.smtp_user, 'Sender Email'),
        to,
        subject,
        text,
        html,
    });

    return true;
};

module.exports = { send };
