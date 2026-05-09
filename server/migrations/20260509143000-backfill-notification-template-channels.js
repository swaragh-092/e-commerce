'use strict';

const { DEFAULTS } = require('../src/modules/notification/notification.defaults');

const smsBodyFor = (name, defaults) => defaults.bodyText || defaults.subject || name;

const whatsappBodyFor = (name, defaults) => {
  const body = defaults.bodyText || defaults.subject || name;
  return `${body}\n\n- {{store_name}}`;
};

const channelRowsFor = (name, defaults, now) => ([
  {
    name,
    channel: 'email',
    subject: defaults.subject || name,
    body_html: defaults.bodyHtml || '',
    body_text: defaults.bodyText || '',
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    name,
    channel: 'sms',
    subject: defaults.subject || name,
    body_html: '',
    body_text: smsBodyFor(name, defaults),
    is_active: false,
    created_at: now,
    updated_at: now,
  },
  {
    name,
    channel: 'whatsapp',
    subject: defaults.subject || name,
    body_html: '',
    body_text: whatsappBodyFor(name, defaults),
    is_active: false,
    created_at: now,
    updated_at: now,
  },
]);

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const rows = Object.entries(DEFAULTS).flatMap(([name, defaults]) => channelRowsFor(name, defaults, now));

    for (const row of rows) {
      await queryInterface.sequelize.query(
        `INSERT INTO notification_templates
          (id, name, channel, subject, body_html, body_text, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), :name, :channel, :subject, :body_html, :body_text, :is_active, NOW(), NOW())
         ON CONFLICT (name, channel) DO NOTHING`,
        { replacements: row }
      );
    }
  },

  down: async () => {},
};
