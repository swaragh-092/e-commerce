'use strict';

const { DEFAULTS } = require('../src/modules/notification/notification.defaults');

const LOGO_BLOCK = '{{#if store_logo}}<div style="text-align:center;margin:0 0 16px;"><img src="{{store_logo}}" alt="{{store_name}}" style="max-height:48px;max-width:160px;display:inline-block;"></div>{{/if}}';

const addLogoToTemplate = (bodyHtml) => {
  if (!bodyHtml || bodyHtml.includes('store_logo')) return bodyHtml;

  // Existing wrappers place the heading inside the header cell/div. Put the
  // logo immediately before it so custom content and spacing remain intact.
  const headingMatch = bodyHtml.match(/<h1\b/i);
  if (headingMatch && headingMatch.index !== undefined) {
    return `${bodyHtml.slice(0, headingMatch.index)}${LOGO_BLOCK}${bodyHtml.slice(headingMatch.index)}`;
  }

  // For custom HTML without a recognizable heading, keep the content valid
  // and visible by placing the logo at the top of the body.
  const bodyMatch = bodyHtml.match(/<body\b[^>]*>/i);
  if (bodyMatch && bodyMatch.index !== undefined) {
    const insertAt = bodyMatch.index + bodyMatch[0].length;
    return `${bodyHtml.slice(0, insertAt)}${LOGO_BLOCK}${bodyHtml.slice(insertAt)}`;
  }

  return `${LOGO_BLOCK}${bodyHtml}`;
};

module.exports = {
  async up(queryInterface) {
    const templates = await queryInterface.sequelize.query(
      `SELECT id, name, channel, body_html FROM notification_templates WHERE channel = 'email'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    for (const template of templates) {
      const updates = {};
      const logoBody = addLogoToTemplate(template.body_html);
      if (logoBody !== template.body_html) updates.body_html = logoBody;

      // Enquiry emails share one customer-facing layout. Refresh only these
      // built-in templates; other templates may contain intentional custom edits.
      if (DEFAULTS[template.name] && ['new_enquiry_customer', 'enquiry_reply_customer'].includes(template.name)) {
        updates.subject = DEFAULTS[template.name].subject;
        updates.body_html = DEFAULTS[template.name].bodyHtml;
        updates.body_text = DEFAULTS[template.name].bodyText || '';
      }

      if (Object.keys(updates).length) {
        updates.updated_at = new Date();
        await queryInterface.sequelize.query(
          `UPDATE notification_templates SET body_html = COALESCE(:body_html, body_html), subject = COALESCE(:subject, subject), body_text = COALESCE(:body_text, body_text), updated_at = :updated_at WHERE id = :id`,
          {
            replacements: {
              id: template.id,
              body_html: updates.body_html ?? null,
              subject: updates.subject ?? null,
              body_text: updates.body_text ?? null,
              updated_at: updates.updated_at,
            },
          },
        );
      }
    }
  },

  async down() {
    // This migration intentionally has no destructive rollback: it preserves
    // the logo and standardized content if a later migration is reverted.
  },
};
