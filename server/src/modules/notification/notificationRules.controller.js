'use strict';

const Joi = require('joi');
const rules = require('./notificationRules.service');
const { success } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const endpoint = action => async (req, res, next) => {
  try { return success(res, await action(req)); } catch (error) { next(error); }
};

module.exports = {
  list: endpoint(() => rules.list()),
  options: endpoint(async () => {
    const [options, config] = await Promise.all([rules.recipientOptions(), require('../settings/settings.service').getByGroup('messaging')]);
    const enabled = (value, fallback) => value === undefined || value === null || value === '' ? fallback : ['true', '1', 'on', 'yes'].includes(String(value).toLowerCase());
    return { ...options, channelEnabled: { email: enabled(config.emailEnabled, true), sms: enabled(config.smsEnabled, false), whatsapp: enabled(config.whatsappEnabled, false) } };
  }),
  read: endpoint(req => rules.read(req.params.event)),
  save: endpoint(req => rules.save(req.params.event, req.body, req.user)),
  history: endpoint(req => rules.history(req.params.event)),
  preview: endpoint(req => rules.preview(req.params.event, req.body.message)),
  test: endpoint(async req => {
    const { channel, recipient, message } = req.body;
    const schema = channel === 'email' ? Joi.string().email({ tlds: { allow: false } }) : Joi.string().pattern(/^\+[1-9]\d{6,14}$/);
    if (!['email', 'sms', 'whatsapp'].includes(channel) || schema.required().validate(recipient).error) {
      throw new AppError('VALIDATION_ERROR', 400, 'Enter a valid email address or international phone number for the selected channel');
    }
    const compiled = await rules.preview(req.params.event, message);
    const payload = require('./notification.service').buildPayload(channel, recipient, compiled.subject, compiled.html, compiled.text);
    const sent = await require('./notification.dispatcher').dispatch(channel, payload);
    if (!sent) throw new AppError('CHANNEL_DISABLED', 400, 'This channel is disabled. Enable and configure it in messaging settings first.');
    let simulated = false;
    if (channel === 'email' && process.env.NODE_ENV === 'development') {
      const email = require('./channels/email.channel');
      const smtp = await email.getSmtpConfig();
      simulated = email.isPlaceholderCredential(smtp.user) || email.isPlaceholderCredential(smtp.pass);
    }
    return { sent: !simulated, simulated };
  }),
};
