'use strict';

const nodemailer = require('nodemailer');
const logger = require('../../../utils/logger');

// Startup check — warn in production if SMTP credentials are missing
if (process.env.NODE_ENV === 'production' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
    logger.warn('WARNING: SMTP_USER or SMTP_PASS is missing in production. Emails may silently fail.');
}

const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: parseInt(process.env.SMTP_PORT) || 2525,
        // true only for port 465 (implicit TLS)
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
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

    const transporter = createTransporter();

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"E-Commerce Store" <noreply@example.com>',
        to,
        subject,
        text,
        html,
    });

    return true;
};

module.exports = { send };
