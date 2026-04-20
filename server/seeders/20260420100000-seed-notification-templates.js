'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Upsert: skip if template already exists to avoid duplicates on re-run
    const existing = await queryInterface.sequelize.query(
      `SELECT name FROM notification_templates`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const existingNames = existing.map((r) => r.name);

    const templates = [
      // ──────────────────────────────────────────
      // Email Verification
      // Variables: {{ name }}, {{ verify_url }}
      // ──────────────────────────────────────────
      {
        name: 'verify_email',
        subject: 'Please verify your email address',
        body_html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#4F46E5;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Verify Your Email</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi <strong>{{name}}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
            Thanks for signing up! Please verify your email address by clicking the button below.
            This link will expire in 24 hours.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="{{verify_url}}" style="background:#4F46E5;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600;display:inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;line-height:1.5;">
            If you didn't create an account, you can safely ignore this email.<br>
            Or copy and paste this link in your browser:<br>
            <a href="{{verify_url}}" style="color:#4F46E5;word-break:break-all;">{{verify_url}}</a>
          </p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:13px;color:#9CA3AF;">© 2026 My E‑Commerce Store. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        body_text: `Hi {{name}},

Thanks for signing up! Please verify your email address by clicking the link below.
This link will expire in 24 hours.

{{verify_url}}

If you didn't create an account, you can safely ignore this email.`,
        is_active: true,
        created_at: now,
        updated_at: now,
      },

      // ──────────────────────────────────────────
      // Password Reset
      // Variables: {{ name }}, {{ reset_url }}
      // ──────────────────────────────────────────
      {
        name: 'password_reset',
        subject: 'Reset your password',
        body_html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#DC2626;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Password Reset Request</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi <strong>{{name}}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
            We received a request to reset your password. Click the button below to create a new one.
            This link will expire in <strong>1 hour</strong>.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="{{reset_url}}" style="background:#DC2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600;display:inline-block;">
              Reset Password
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;line-height:1.5;">
            If you didn't request a password reset, you can safely ignore this email. Your password will not change.<br><br>
            Or copy and paste this link in your browser:<br>
            <a href="{{reset_url}}" style="color:#DC2626;word-break:break-all;">{{reset_url}}</a>
          </p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:13px;color:#9CA3AF;">© 2026 My E‑Commerce Store. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        body_text: `Hi {{name}},

We received a request to reset your password. Click the link below to reset it.
This link will expire in 1 hour.

{{reset_url}}

If you didn't request a password reset, you can safely ignore this email.`,
        is_active: true,
        created_at: now,
        updated_at: now,
      },

      // ──────────────────────────────────────────
      // Low Stock Admin Alert
      // Variables: {{ productName }}, {{ sku }}, {{ stock }}
      // ──────────────────────────────────────────
      {
        name: 'low_stock_admin',
        subject: 'Low Stock Alert: {{productName}} ({{sku}})',
        body_html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#D97706;padding:24px 40px;text-align:center;">
          <h2 style="margin:0;color:#fff;">⚠ Low Stock Alert</h2>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 12px;font-size:15px;color:#374151;">The following product variant is running low on stock:</p>
          <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;">
            <tr style="background:#F9FAFB;">
              <td style="padding:12px 16px;font-size:13px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">Product</td>
              <td style="padding:12px 16px;font-size:13px;color:#374151;border-bottom:1px solid #E5E7EB;">{{productName}}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:13px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">SKU</td>
              <td style="padding:12px 16px;font-size:13px;color:#374151;border-bottom:1px solid #E5E7EB;">{{sku}}</td>
            </tr>
            <tr style="background:#FEF2F2;">
              <td style="padding:12px 16px;font-size:13px;color:#6B7280;font-weight:600;">Current Stock</td>
              <td style="padding:12px 16px;font-size:16px;font-weight:700;color:#DC2626;">{{stock}} units</td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;">Please restock this item to avoid lost sales.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        body_text: `Low Stock Alert

Product: {{productName}}
SKU: {{sku}}
Current Stock: {{stock}} units

Please restock this item to avoid lost sales.`,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ];

    // Only insert templates that do not already exist
    const toInsert = templates.filter((t) => !existingNames.includes(t.name));
    if (toInsert.length > 0) {
      await queryInterface.bulkInsert('notification_templates', toInsert);
      console.log(`Seeded ${toInsert.length} notification template(s).`);
    } else {
      console.log('All notification templates already exist — nothing to seed.');
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('notification_templates', {
      name: ['verify_email', 'password_reset', 'low_stock_admin'],
    });
  },
};
