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

const getClient = async () => {
    const creds = await SettingsService.getByGroup('messaging_credentials');
    const sid = creds.twilio_sid;
    const token = creds.twilio_token;

    if (!sid || !token) {
        throw new Error('twilio_sid and twilio_token must be set in messaging_credentials to send WhatsApp.');
    }

    if (!_client || _currentSid !== sid) {
        _client = twilio(sid, token);
        _currentSid = sid;
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

    const creds = await SettingsService.getByGroup('messaging_credentials');
    const fromRaw = creds.twilio_whatsapp_from;
    if (!fromRaw) {
        throw new Error('twilio_whatsapp_from is not set in messaging_credentials.');
    }

    // Normalise: allow operator to set with or without the prefix
    const from = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`;
    const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const client = await getClient();
    const message = await client.messages.create({ to: toWa, from, body });

    logger.debug(`[whatsapp.channel] Sent SID=${message.sid} to ${to}`);
    return true;
};

module.exports = { send };
