'use strict';

const twilio = require('twilio');
const logger = require('../../../utils/logger');

/**
 * Lazy-create the Twilio client so the module can be required at startup
 * even when TWILIO_* env vars are not yet configured (e.g. SMS disabled).
 * The client is only instantiated when send() is actually called.
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
 * Send an SMS via Twilio.
 *
 * @param {Object} payload
 * @param {string} payload.to    - E.164 recipient number e.g. "+919876543210"
 * @param {string} payload.body  - Plain-text message body (≤160 chars per segment)
 * @returns {Promise<boolean>}
 */
const send = async ({ to, body }) => {
    if (process.env.NODE_ENV === 'test') {
        logger.debug(`[sms.channel] TEST MODE — skipping send to ${to}`);
        return true;
    }

    const creds = await SettingsService.getByGroup('messaging_credentials', { maskSensitive: false });
    const from = requireSetting(creds.twilio_from_number, 'Twilio From Number');

    const client = await getClient();
    const message = await client.messages.create({ to, from, body });

    logger.debug(`[sms.channel] Sent SID=${message.sid} to ${to}`);
    return true;
};

module.exports = { send };
