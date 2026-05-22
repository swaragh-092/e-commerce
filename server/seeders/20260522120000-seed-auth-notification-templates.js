'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const existing = await queryInterface.sequelize.query(
      `SELECT name FROM notification_templates`, { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const existingNames = existing.map(r => r.name);

    // Fix: rename verify_email → email_verification if it exists
    if (existingNames.includes('verify_email') && !existingNames.includes('email_verification')) {
      await queryInterface.sequelize.query(
        `UPDATE notification_templates SET name = 'email_verification' WHERE name = 'verify_email'`
      );
    }

    const templates = [
      {
        name: 'email_verification',
        channel: 'email',
        subject: 'Verify your email address',
        body_html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;"><tr><td style="background:#0f766e;padding:32px 40px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;">Verify Your Email</h1></td></tr><tr><td style="padding:40px;"><p style="font-size:16px;color:#374151;">Hi <strong>{{name}}</strong>,</p><p style="font-size:15px;color:#6B7280;line-height:1.6;">Click the button below to verify your email address. This link expires in 24 hours.</p><div style="text-align:center;margin:32px 0;"><a href="{{verify_url}}" style="background:#0f766e;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600;display:inline-block;">Verify Email</a></div></td></tr></table></td></tr></table></body></html>`,
        body_text: 'Hi {{name}},\n\nVerify your email: {{verify_url}}\n\nThis link expires in 24 hours.',
        is_active: true, created_at: now, updated_at: now,
      },
      {
        name: 'new_login_alert',
        channel: 'email',
        subject: 'New login to your account',
        body_html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;"><tr><td style="background:#dc2626;padding:32px 40px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;">New Login Detected</h1></td></tr><tr><td style="padding:40px;"><p style="font-size:16px;color:#374151;">Hi <strong>{{name}}</strong>,</p><p style="font-size:15px;color:#6B7280;line-height:1.6;">We detected a new login to your account:</p><table style="margin:20px 0;font-size:14px;color:#374151;"><tr><td style="padding:8px 16px 8px 0;font-weight:600;">Device:</td><td>{{device}}</td></tr><tr><td style="padding:8px 16px 8px 0;font-weight:600;">IP Address:</td><td>{{ip}}</td></tr><tr><td style="padding:8px 16px 8px 0;font-weight:600;">Time:</td><td>{{time}}</td></tr></table><p style="font-size:14px;color:#6B7280;">If this wasn't you, please change your password immediately and enable 2FA.</p></td></tr></table></td></tr></table></body></html>`,
        body_text: 'Hi {{name}},\n\nNew login detected:\nDevice: {{device}}\nIP: {{ip}}\nTime: {{time}}\n\nIf this wasn\'t you, change your password immediately.',
        is_active: true, created_at: now, updated_at: now,
      },
      {
        name: 'account_deletion_scheduled',
        channel: 'email',
        subject: 'Your account is scheduled for deletion',
        body_html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;"><tr><td style="background:#b91c1c;padding:32px 40px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;">Account Deletion Scheduled</h1></td></tr><tr><td style="padding:40px;"><p style="font-size:16px;color:#374151;">Hi <strong>{{name}}</strong>,</p><p style="font-size:15px;color:#6B7280;line-height:1.6;">Your account is scheduled for permanent deletion on <strong>{{deletion_date}}</strong>.</p><p style="font-size:15px;color:#6B7280;">If you change your mind, you can cancel the deletion anytime before that date:</p><div style="text-align:center;margin:32px 0;"><a href="{{cancel_url}}" style="background:#0f766e;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600;display:inline-block;">Cancel Deletion</a></div></td></tr></table></td></tr></table></body></html>`,
        body_text: 'Hi {{name}},\n\nYour account is scheduled for deletion on {{deletion_date}}.\n\nTo cancel: {{cancel_url}}',
        is_active: true, created_at: now, updated_at: now,
      },
      {
        name: 'email_change_verification',
        channel: 'email',
        subject: 'Confirm your new email address',
        body_html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;"><tr><td style="background:#0f766e;padding:32px 40px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;">Confirm Email Change</h1></td></tr><tr><td style="padding:40px;"><p style="font-size:16px;color:#374151;">Hi <strong>{{name}}</strong>,</p><p style="font-size:15px;color:#6B7280;line-height:1.6;">Click below to confirm this as your new email address. This link expires in 24 hours.</p><div style="text-align:center;margin:32px 0;"><a href="{{verify_url}}" style="background:#0f766e;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600;display:inline-block;">Confirm Email</a></div></td></tr></table></td></tr></table></body></html>`,
        body_text: 'Hi {{name}},\n\nConfirm your new email: {{verify_url}}\n\nThis link expires in 24 hours.',
        is_active: true, created_at: now, updated_at: now,
      },
    ];

    const toInsert = templates.filter(t => !existingNames.includes(t.name));
    if (toInsert.length > 0) {
      await queryInterface.bulkInsert('notification_templates', toInsert);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('notification_templates', {
      name: ['new_login_alert', 'account_deletion_scheduled', 'email_change_verification']
    });
  }
};
