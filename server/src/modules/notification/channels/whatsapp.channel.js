'use strict';

const twilio = require('twilio');
const logger = require('../../../utils/logger');

/**
 * Lazy-create the Twilio client — same reason as sms.channel.js.
 * WhatsApp uses the SAME Twilio account but a different from-number
 * (TWILIO_WHATSAPP_FROM) prefixed with "whatsapp:".
 */
const SettingsService = require('../../settings/settings.service');

let _client = null;
let _currentSid = null;
let _currentToken = null;

const requireSetting = (value, label) => {
    if (value === undefined || value === null || String(value).trim() === '') {
        throw new Error(`${label} is required in Admin Settings > Notifications.`);
    }
    return String(value).trim();
};

const getClient = async () => {
    const creds = await SettingsService.getByGroup('messaging_credentials', { maskSensitive: false });
    const sid = requireSetting(creds.twilio_sid, 'Twilio Account SID');
    const token = requireSetting(creds.twilio_token, 'Twilio Auth Token');

    if (!_client || _currentSid !== sid || _currentToken !== token) {
        _client = twilio(sid, token);
        _currentSid = sid;
        _currentToken = token;
    }
    return _client;
};

/**
 * Send a WhatsApp message via Twilio.
 *
 * In sandbox: TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886"
 * In production (WABA): use your approved number e.g. "whatsapp:+1NXXNXXXXXX"
 *
 * @param {Object} payload
 * @param {string} payload.to    - E.164 recipient number e.g. "+919876543210"
 *                                 (the "whatsapp:" prefix is added automatically)
 * @param {string} payload.body  - Message body
 * @returns {Promise<boolean>}
 */
const send = async ({ to, body }) => {
    if (process.env.NODE_ENV === 'test') {
        logger.debug(`[whatsapp.channel] TEST MODE — skipping send to ${to}`);
        return true;
    }

    const creds = await SettingsService.getByGroup('messaging_credentials', { maskSensitive: false });
    const fromRaw = requireSetting(creds.twilio_whatsapp_from, 'Twilio WhatsApp Sender');

    // Normalise: allow operator to set with or without the prefix
    const from = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`;
    const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const client = await getClient();
    const message = await client.messages.create({ to: toWa, from, body });

    logger.debug(`[whatsapp.channel] Sent SID=${message.sid} to ${to}`);
    return true;
};

module.exports = { send };
