'use strict';

const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

// Channel map — keys match the `channel` column in notification_templates
const CHANNELS = {
    email:     () => require('./email.channel'),
    sms:       () => require('./sms.channel'),
    whatsapp:  () => require('./whatsapp.channel'),
};

const SettingsService = require('../settings/settings.service');

const isChannelEnabled = async (channel) => {
    const messagingConfig = await SettingsService.getByGroup('messaging');
    switch (channel) {
        case 'email':    return messagingConfig.emailEnabled !== false;  // on by default
        case 'sms':      return messagingConfig.smsEnabled === true;     // off by default
        case 'whatsapp': return messagingConfig.whatsappEnabled === true; // off by default
        default: return false;
    }
};

/**
 * Dispatch a compiled notification payload to the correct channel.
 *
 * @param {string} channel          - 'email' | 'sms' | 'whatsapp'
 * @param {Object} payload          - Channel-specific payload (see each channel for shape)
 * @returns {Promise<boolean>}      - true = sent, false = channel disabled
 * @throws {AppError}               - Unknown channel
 */
const dispatch = async (channel, payload) => {
    if (!CHANNELS[channel]) {
        throw new AppError('INVALID_CHANNEL', 400, `Unknown notification channel: ${channel}`);
    }

    const enabled = await isChannelEnabled(channel);
    if (!enabled) {
        logger.debug(`[dispatcher] Channel '${channel}' is disabled — skipping.`);
        return false;
    }

    const channelModule = CHANNELS[channel]();
    await channelModule.send(payload);
    return true;
};

module.exports = { dispatch };
