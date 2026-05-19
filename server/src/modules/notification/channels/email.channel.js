'use strict';

const nodemailer = require('nodemailer');
const logger = require('../../../utils/logger');
const SettingsService = require('../../settings/settings.service');

const MASKED_VALUE = '********';

const toBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const settingOrEnv = (settings, key, envKey) => {
    const value = settings?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== MASKED_VALUE) {
        return value;
    }
    return process.env[envKey];
};

const getSmtpConfig = async () => {
    const creds = await SettingsService.getByGroup('messaging_credentials', { maskSensitive: false });
    const messaging = await SettingsService.getByGroup('messaging');
    const host = settingOrEnv(creds, 'smtp_host', 'SMTP_HOST');
    const port = settingOrEnv(creds, 'smtp_port', 'SMTP_PORT');
    const user = settingOrEnv(creds, 'smtp_user', 'SMTP_USER');
    const pass = settingOrEnv(creds, 'smtp_pass', 'SMTP_PASS');
    const secure = settingOrEnv(creds, 'smtp_secure', 'SMTP_SECURE');
    const from = settingOrEnv(messaging, 'emailFrom', 'EMAIL_FROM');

    return { host, port, user, pass, secure, from };
};

const requireSetting = (value, label) => {
    if (value === undefined || value === null || String(value).trim() === '') {
        throw new Error(`${label} is required in Admin Settings > Notifications.`);
    }
    return String(value).trim();
};

const createTransporter = async () => {
    const smtp = await getSmtpConfig();
    const host = requireSetting(smtp.host, 'SMTP Host');
    const port = Number.parseInt(smtp.port, 10) || 587;
    const user = requireSetting(smtp.user, 'SMTP User');
    const pass = requireSetting(smtp.pass, 'SMTP Password');

    return nodemailer.createTransport({
        host,
        port,
        secure: toBoolean(smtp.secure, port === 465),
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
    const smtp = await getSmtpConfig();
    const general = await SettingsService.getByGroup('general');

    const storeName = general.storeName || 'E-Commerce Store';
    const defaultFrom = smtp.user ? `"${storeName}" <${smtp.user}>` : null;

    await transporter.sendMail({
        from: smtp.from || defaultFrom || requireSetting(smtp.user, 'Sender Email'),
        to,
        subject,
        text,
        html,
    });

    return true;
};

module.exports = { send };
