'use strict';

const { randomUUID } = require('crypto');
const notifications = require('../notification/notification.service');
const settings = require('../settings/settings.service');
const AppError = require('../../utils/AppError');

const unavailable = () => new AppError('CONTACT_UNAVAILABLE', 503,
  'We could not send your message right now. Please try again later or contact us using the email or phone details on this page.');

const submit = async ({ name, email, phone, message }) => {
  const variables = {
    contact_name: name,
    contact_email: email,
    contact_phone: phone,
    contact_message: message,
    notification_event_id: randomUUID(),
  };
  const routed = await notifications.sendEvent('contact_form_submitted', { variables });
  if (routed !== null) {
    if (!routed.some(Boolean)) throw unavailable();
    return { queued: true };
  }

  // Before the event is saved, preserve its existing template and recipient defaults.
  const messaging = await settings.getByGroup('messaging');
  if (messaging.emailEnabled !== undefined && messaging.emailEnabled !== null && messaging.emailEnabled !== ''
      && !['true', '1', 'yes', 'on'].includes(String(messaging.emailEnabled).toLowerCase())) {
    throw unavailable();
  }

  // Recipients come only from protected notification settings, never from the public request.
  const queued = await notifications.sendToAdmins('contact_form_admin', ['email'], variables);
  if (!queued.some(Boolean)) throw unavailable();
  return { queued: true };
};

module.exports = { submit };
