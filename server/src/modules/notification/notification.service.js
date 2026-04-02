'use strict';

const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const { NotificationTemplate, NotificationLog } = require('../index');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

// Startup check
if (process.env.NODE_ENV === 'production' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
    logger.warn('WARNING: SMTP_USER or SMTP_PASS is missing in production. Emails may silently fail.');
}

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: parseInt(process.env.SMTP_PORT) || 2525,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

/**
 * Send an email using a predefined template
 * @param {string} templateName - Name of the template in DB
 * @param {string} recipientEmail - To address
 * @param {Object} variables - Data for Handlebars template replacement
 * @param {string} [userId] - Optional user linking for logs
 * @param {string} [orderId] - Optional order linking for logs
 * @param {Object} [t] - Optional transaction
 */
const send = async (templateName, recipientEmail, variables = {}, userId = null, orderId = null, t = null) => {
    try {
        const queryOptions = t ? { transaction: t } : {};
        const template = await NotificationTemplate.findOne({ where: { name: templateName }, ...queryOptions });

        if (!template) {
            logger.warn(`Email template '${templateName}' not found.`);
            return false;
        }

        // Compile subject and body using Handlebars
        const compileSubject = handlebars.compile(template.subject);
        const compileBodyHtml = handlebars.compile(template.bodyHtml);
        const compileBodyText = handlebars.compile(template.bodyText);

        const subject = compileSubject(variables);
        const html = compileBodyHtml(variables);
        const text = compileBodyText(variables);

        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"E-Commerce Store" <noreply@example.com>',
            to: recipientEmail,
            subject: subject,
            text: text,
            html: html,
        };

        let status = 'sent';
        let errorMessage = null;

        // Try to send email
        if (process.env.NODE_ENV !== 'test') { // Skip actual sending in test environment
            try {
                await transporter.sendMail(mailOptions);
            } catch (err) {
                logger.error('Error sending email:', err);
                status = 'failed';
                errorMessage = err.message;
            }
        }

        // Log notification — columns match notification_logs migration exactly
        await NotificationLog.create({
            templateName,
            recipientEmail,
            subject,
            status,
            error: errorMessage || null,
        }, queryOptions);

        return status === 'sent';

    } catch (error) {
        logger.error(`Notification loop error for ${templateName}:`, error);
        return false;
    }
};

module.exports = {
    send
};
