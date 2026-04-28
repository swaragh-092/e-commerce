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

const getClient = async () => {
    const creds = await SettingsService.getByGroup('messaging_credentials');
    const sid = creds.twilio_sid;
    const token = creds.twilio_token;

    if (!sid || !token) {
        throw new Error('twilio_sid and twilio_token must be set in messaging_credentials to send SMS.');
    }

    if (!_client || _currentSid !== sid) {
        _client = twilio(sid, token);
        _currentSid = sid;
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

    const creds = await SettingsService.getByGroup('messaging_credentials');
    const from = creds.twilio_from_number;
    if (!from) {
        throw new Error('twilio_from_number is not set in messaging_credentials.');
    }

    const client = await getClient();
    const message = await client.messages.create({ to, from, body });

    logger.debug(`[sms.channel] Sent SID=${message.sid} to ${to}`);
    return true;
};

module.exports = { send };
