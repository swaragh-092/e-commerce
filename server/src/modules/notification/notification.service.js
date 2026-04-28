'use strict';

const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const { NotificationTemplate, NotificationLog, User, UserProfile } = require('../index');
const SettingsService = require('../settings/settings.service');
const logger = require('../../utils/logger');

// Startup check
if (process.env.NODE_ENV === 'production' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
    logger.warn('WARNING: SMTP_USER or SMTP_PASS is missing in production. Emails may silently fail.');
}

const getSettings = async () => {
    try {
        return await SettingsService.getByGroup('general');
    } catch (e) {
        logger.error('Failed to get settings in NotificationService:', e);
        return {};
    }
};

const createTransporter = (settings) => {
    return nodemailer.createTransport({
        host: settings['smtp.host'] || process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: parseInt(settings['smtp.port'] || process.env.SMTP_PORT) || 2525,
        secure: (settings['smtp.secure'] || process.env.SMTP_SECURE) === 'true',
        auth: {
            user: settings['smtp.user'] || process.env.SMTP_USER,
            pass: settings['smtp.pass'] || process.env.SMTP_PASS,
        },
    });
};

const sendEmail = async (template, recipientEmail, variables, settings, queryOptions) => {
    if (!recipientEmail) return;
    
    let status = 'sent';
    let errorMessage = null;
    let subject = '';

    try {
        const compileSubject = handlebars.compile(template.subject);
        const compileBodyHtml = handlebars.compile(template.bodyHtml);
        const compileBodyText = handlebars.compile(template.bodyText);

        subject = compileSubject(variables);
        const html = compileBodyHtml(variables);
        const text = compileBodyText(variables);

        const transporter = createTransporter(settings);

        const mailOptions = {
            from: settings['smtp.from'] || process.env.EMAIL_FROM || '"E-Commerce Store" <noreply@example.com>',
            to: recipientEmail,
            subject: subject,
            text: text,
            html: html,
        };

        if (process.env.NODE_ENV !== 'test') {
            await transporter.sendMail(mailOptions);
        }
    } catch (err) {
        logger.error('Error sending email:', err);
        status = 'failed';
        errorMessage = err.message;
    }

    await NotificationLog.create({
        templateName: template.name,
        recipient: recipientEmail,
        channel: 'email',
        subject: subject,
        status,
        error: errorMessage || null,
    }, queryOptions);

    return status === 'sent';
};

const sendSms = async (template, recipientPhone, variables, settings, queryOptions) => {
    if (!recipientPhone) return;

    let status = 'sent';
    let errorMessage = null;

    try {
        const compileBody = handlebars.compile(template.bodySms || '');
        const text = compileBody(variables);

        const provider = settings['sms.provider'] || 'twilio';
        logger.info(`[SMS Dispatcher - ${provider}] To: ${recipientPhone} - Body: ${text}`);
        
        if (process.env.NODE_ENV === 'production' && (!settings['sms.key'] && !process.env.TWILIO_ACCOUNT_SID)) {
            throw new Error('SMS Provider key missing in settings');
        }

        if (process.env.NODE_ENV !== 'test') {
            if (provider === 'twilio' && (settings['sms.key'] || process.env.TWILIO_ACCOUNT_SID)) {
                const accountSid = settings['sms.key'] || process.env.TWILIO_ACCOUNT_SID;
                const authToken = settings['sms.secret'] || process.env.TWILIO_AUTH_TOKEN;
                const fromNumber = settings['sms.from'] || process.env.TWILIO_PHONE_NUMBER;
                
                const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
                const form = new URLSearchParams();
                form.append('From', fromNumber);
                form.append('To', recipientPhone);
                form.append('Body', text);
                
                const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: form.toString()
                });
                
                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`Twilio SMS Error: ${response.status} ${errorData}`);
                }
            } else if (provider === 'messagebird' && settings['sms.key']) {
                const response = await fetch('https://rest.messagebird.com/messages', {
                    method: 'POST',
                    headers: {
                        'Authorization': `AccessKey ${settings['sms.key']}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        originator: settings['sms.from'],
                        recipients: [recipientPhone],
                        body: text
                    })
                });
                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`MessageBird SMS Error: ${response.status} ${errorData}`);
                }
            }
        }

    } catch (err) {
        logger.error('Error sending SMS:', err);
        status = 'failed';
        errorMessage = err.message;
    }

    await NotificationLog.create({
        templateName: template.name,
        recipient: recipientPhone,
        channel: 'sms',
        subject: null,
        status,
        error: errorMessage || null,
    }, queryOptions);

    return status === 'sent';
};

const sendWhatsapp = async (template, recipientPhone, variables, settings, queryOptions) => {
    if (!recipientPhone) return;

    let status = 'sent';
    let errorMessage = null;

    try {
        const compileBody = handlebars.compile(template.bodyWhatsapp || '');
        const text = compileBody(variables);

        const provider = settings['whatsapp.provider'] || 'twilio';
        logger.info(`[WhatsApp Dispatcher - ${provider}] To: ${recipientPhone} - Body: ${text}`);
        
        if (process.env.NODE_ENV === 'production' && (!settings['whatsapp.key'] && !process.env.TWILIO_ACCOUNT_SID)) {
            throw new Error('WhatsApp Provider key missing in settings');
        }

        if (process.env.NODE_ENV !== 'test') {
            if (provider === 'twilio' && (settings['whatsapp.key'] || process.env.TWILIO_ACCOUNT_SID)) {
                const accountSid = settings['whatsapp.key'] || process.env.TWILIO_ACCOUNT_SID;
                const authToken = settings['whatsapp.secret'] || process.env.TWILIO_AUTH_TOKEN;
                const fromNumber = settings['whatsapp.from'] || process.env.TWILIO_WHATSAPP_NUMBER;
                
                const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
                const form = new URLSearchParams();
                form.append('From', `whatsapp:${fromNumber}`);
                form.append('To', `whatsapp:${recipientPhone}`);
                form.append('Body', text);
                
                const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: form.toString()
                });
                
                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`Twilio WhatsApp Error: ${response.status} ${errorData}`);
                }
            }
        }

    } catch (err) {
        logger.error('Error sending WhatsApp message:', err);
        status = 'failed';
        errorMessage = err.message;
    }

    await NotificationLog.create({
        templateName: template.name,
        recipient: recipientPhone,
        channel: 'whatsapp',
        subject: null,
        status,
        error: errorMessage || null,
    }, queryOptions);

    return status === 'sent';
};

/**
 * Send a notification using predefined template across enabled channels
 * @param {string} templateName - Name of the template in DB
 * @param {string|null} recipientEmail - Email address (optional if userId is provided)
 * @param {Object} variables - Data for Handlebars template replacement
 * @param {string} [userId] - Optional user linking to fetch phone/email for SMS/Whatsapp
 * @param {string} [orderId] - Optional order linking
 * @param {Object} [t] - Optional transaction
 */
const send = async (templateName, recipientEmail, variables = {}, userId = null, orderId = null, t = null) => {
    try {
        const queryOptions = t ? { transaction: t } : {};
        const template = await NotificationTemplate.findOne({ where: { name: templateName }, ...queryOptions });

        if (!template) {
            logger.warn(`Notification template '${templateName}' not found.`);
            return false;
        }

        let email = recipientEmail;
        let phone = variables.phone || null;

        // Auto-fetch user contact details if a user ID is supplied
        if (userId && (!email || !phone)) {
            const user = await User.findByPk(userId, queryOptions);
            const profile = await UserProfile.findOne({ where: { userId }, ...queryOptions });
            
            if (user && !email) email = user.email;
            if (profile && profile.phone && !phone) phone = profile.phone;
        }

        const settings = await getSettings();

        // Dispatch to channels asynchronously but wait for their logging
        const dispatches = [];

        if (template.enableEmail && email) {
            dispatches.push(sendEmail(template, email, variables, settings, queryOptions));
        }

        if (template.enableSms && phone) {
            dispatches.push(sendSms(template, phone, variables, settings, queryOptions));
        }

        if (template.enableWhatsapp && phone) {
            dispatches.push(sendWhatsapp(template, phone, variables, settings, queryOptions));
        }

        await Promise.allSettled(dispatches);

        return true;

    } catch (error) {
        logger.error(`Notification loop error for ${templateName}:`, error);
        return false;
    }
};

module.exports = {
    send
};
