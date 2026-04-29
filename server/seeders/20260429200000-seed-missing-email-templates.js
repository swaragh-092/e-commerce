'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Upsert-safe: skip any that already exist
    const existing = await queryInterface.sequelize.query(
      `SELECT name FROM notification_templates`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const existingNames = existing.map((r) => r.name);

    const WRAPPER = (headerBg, headerText, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:${headerBg};padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${headerText}</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          ${body}
        </td></tr>
        <tr><td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">{{copyright}}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">You're receiving this email because you have an account at <a href="{{website_url}}" style="color:${headerBg};text-decoration:none;">{{store_name}}</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const templates = [
      // ─────────────────────────────────────────────────────────────────────
      // Welcome Email
      // Variables: name, website_url, store_name, support_email, copyright
      // ─────────────────────────────────────────────────────────────────────
      {
        name: 'welcome',
        channel: 'email',
        subject: 'Welcome to {{store_name}}!',
        body_html: WRAPPER('#1a1a2e', 'Welcome to {{store_name}}!', `
          <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi <strong>{{name}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.7;">
            Thanks for creating an account at <strong>{{store_name}}</strong>. We're thrilled to have you.
            Start browsing our latest products and find something you love!
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="{{website_url}}/products" style="background:#6c63ff;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:700;display:inline-block;">
              Shop Now
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
            Need help? Contact us at <a href="mailto:{{support_email}}" style="color:#6c63ff;">{{support_email}}</a>
          </p>
        `),
        body_text: `Hi {{name}},

Welcome to {{store_name}}! We're glad you're here.

Start shopping: {{website_url}}/products

Need help? Email us at {{support_email}}

Thanks,
{{store_name}}`,
        is_active: true,
        created_at: now,
        updated_at: now,
      },

      // ─────────────────────────────────────────────────────────────────────
      // Order Placed
      // Variables: customer_name, order_number, order_date, order_id, order_total,
      //            payment_method, website_url, store_name, support_email, copyright
      // ─────────────────────────────────────────────────────────────────────
      {
        name: 'order_placed',
        channel: 'email',
        subject: 'Order Confirmed — #{{order_number}}',
        body_html: WRAPPER('#059669', 'Order Confirmed!', `
          <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi <strong>{{customer_name}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.7;">
            Thank you for your order! We've received it and it's being processed. You'll get another email when it ships.
          </p>
          <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
            <tr style="background:#f9fafb;">
              <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Order Number</td>
              <td style="padding:12px 16px;font-size:14px;color:#111827;font-weight:700;border-bottom:1px solid #e5e7eb;">#{{order_number}}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Order Date</td>
              <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">{{order_date}}</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Payment</td>
              <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">{{payment_method}}</td>
            </tr>
            <tr>
              <td style="padding:14px 16px;font-size:14px;color:#374151;font-weight:700;">Order Total</td>
              <td style="padding:14px 16px;font-size:18px;color:#059669;font-weight:800;">{{order_total}}</td>
            </tr>
          </table>
          <div style="text-align:center;margin:28px 0;">
            <a href="{{website_url}}/account/orders/{{order_id}}" style="background:#059669;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:700;display:inline-block;">
              View Your Order
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
            Questions? Email us at <a href="mailto:{{support_email}}" style="color:#059669;">{{support_email}}</a>
          </p>
        `),
        body_text: `Hi {{customer_name}},

Your order #{{order_number}} has been confirmed!

Order Date: {{order_date}}
Payment: {{payment_method}}
Total: {{order_total}}

View your order: {{website_url}}/account/orders/{{order_id}}

Questions? Email {{support_email}}

Thanks,
{{store_name}}`,
        is_active: true,
        created_at: now,
        updated_at: now,
      },

      // ─────────────────────────────────────────────────────────────────────
      // Order Shipped
      // Variables: customer_name, order_number, order_id, tracking_number,
      //            tracking_url, courier, website_url, store_name, support_email
      // ─────────────────────────────────────────────────────────────────────
      {
        name: 'order_shipped',
        channel: 'email',
        subject: 'Your Order #{{order_number}} Has Shipped!',
        body_html: WRAPPER('#2563eb', 'Your Order Has Shipped!', `
          <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi <strong>{{customer_name}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.7;">
            Great news — your order <strong>#{{order_number}}</strong> is on its way!
          </p>
          <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
            <tr style="background:#f9fafb;">
              <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Order Number</td>
              <td style="padding:12px 16px;font-size:14px;color:#111827;font-weight:700;border-bottom:1px solid #e5e7eb;">#{{order_number}}</td>
            </tr>
            {{#if tracking_number}}
            <tr>
              <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Tracking Number</td>
              <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">{{tracking_number}}</td>
            </tr>
            {{/if}}
            {{#if courier}}
            <tr style="background:#f9fafb;">
              <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;">Courier</td>
              <td style="padding:12px 16px;font-size:14px;color:#374151;">{{courier}}</td>
            </tr>
            {{/if}}
          </table>
          <div style="text-align:center;margin:28px 0;">
            {{#if tracking_url}}
            <a href="{{tracking_url}}" style="background:#2563eb;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:700;display:inline-block;margin-right:12px;">
              Track Package
            </a>
            {{/if}}
            <a href="{{website_url}}/account/orders/{{order_id}}" style="background:#374151;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:700;display:inline-block;">
              View Order
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
            Questions? <a href="mailto:{{support_email}}" style="color:#2563eb;">{{support_email}}</a>
          </p>
        `),
        body_text: `Hi {{customer_name}},

Your order #{{order_number}} has shipped!

{{#if tracking_number}}Tracking Number: {{tracking_number}}
{{/if}}{{#if courier}}Courier: {{courier}}
{{/if}}
View order: {{website_url}}/account/orders/{{order_id}}

{{store_name}}`,
        is_active: true,
        created_at: now,
        updated_at: now,
      },

      // ─────────────────────────────────────────────────────────────────────
      // Order Delivered
      // Variables: customer_name, order_number, order_id, website_url, store_name, support_email, copyright
      // ─────────────────────────────────────────────────────────────────────
      {
        name: 'order_delivered',
        channel: 'email',
        subject: 'Your Order #{{order_number}} Has Been Delivered',
        body_html: WRAPPER('#059669', 'Your Order Has Arrived!', `
          <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi <strong>{{customer_name}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.7;">
            Your order <strong>#{{order_number}}</strong> has been delivered. We hope you love it!
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="{{website_url}}/account/orders/{{order_id}}" style="background:#059669;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:700;display:inline-block;">
              View Order Details
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:14px;color:#374151;line-height:1.7;">
            Enjoyed your purchase? We'd love to hear about it! 
            <a href="{{website_url}}/products" style="color:#059669;text-decoration:none;font-weight:600;">Leave a review</a>
          </p>
          <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
            Need help? <a href="mailto:{{support_email}}" style="color:#059669;">{{support_email}}</a>
          </p>
        `),
        body_text: `Hi {{customer_name}},

Your order #{{order_number}} has been delivered!

View order: {{website_url}}/account/orders/{{order_id}}

We hope you love your purchase!

{{store_name}}`,
        is_active: true,
        created_at: now,
        updated_at: now,
      },

      // ─────────────────────────────────────────────────────────────────────
      // Order Cancelled
      // Variables: customer_name, order_number, cancel_reason, refund_amount,
      //            website_url, store_name, support_email
      // ─────────────────────────────────────────────────────────────────────
      {
        name: 'order_cancelled',
        channel: 'email',
        subject: 'Order #{{order_number}} Has Been Cancelled',
        body_html: WRAPPER('#dc2626', 'Order Cancelled', `
          <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi <strong>{{customer_name}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.7;">
            We're letting you know that your order <strong>#{{order_number}}</strong> has been cancelled.
          </p>
          {{#if cancel_reason}}
          <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;padding:16px 20px;margin:20px 0;">
            <p style="margin:0;font-size:14px;color:#374151;"><strong>Reason:</strong> {{cancel_reason}}</p>
          </div>
          {{/if}}
          {{#if refund_amount}}
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
            A refund of <strong>{{refund_amount}}</strong> will be processed to your original payment method within 5–7 business days.
          </p>
          {{/if}}
          <div style="text-align:center;margin:28px 0;">
            <a href="{{website_url}}/products" style="background:#374151;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:700;display:inline-block;">
              Continue Shopping
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
            Questions? <a href="mailto:{{support_email}}" style="color:#dc2626;">{{support_email}}</a>
          </p>
        `),
        body_text: `Hi {{customer_name}},

Your order #{{order_number}} has been cancelled.

{{#if cancel_reason}}Reason: {{cancel_reason}}
{{/if}}{{#if refund_amount}}Refund: {{refund_amount}} will be processed within 5-7 business days.
{{/if}}

Continue shopping: {{website_url}}/products

{{store_name}}`,
        is_active: true,
        created_at: now,
        updated_at: now,
      },

      // ─────────────────────────────────────────────────────────────────────
      // Order Refunded
      // Variables: customer_name, order_number, order_id, refund_amount,
      //            website_url, store_name, support_email
      // ─────────────────────────────────────────────────────────────────────
      {
        name: 'order_refunded',
        channel: 'email',
        subject: 'Refund Processed for Order #{{order_number}}',
        body_html: WRAPPER('#7c3aed', 'Refund Processed', `
          <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi <strong>{{customer_name}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.7;">
            A refund of <strong>{{refund_amount}}</strong> has been processed for order <strong>#{{order_number}}</strong>.
          </p>
          <div style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:4px;padding:16px 20px;margin:20px 0;">
            <p style="margin:0;font-size:14px;color:#374151;">Please allow <strong>5–7 business days</strong> for the amount to appear in your account, depending on your payment provider.</p>
          </div>
          <div style="text-align:center;margin:28px 0;">
            <a href="{{website_url}}/account/orders/{{order_id}}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:700;display:inline-block;">
              View Order
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
            Questions? <a href="mailto:{{support_email}}" style="color:#7c3aed;">{{support_email}}</a>
          </p>
        `),
        body_text: `Hi {{customer_name}},

A refund of {{refund_amount}} for order #{{order_number}} has been processed.

Please allow 5-7 business days for the amount to appear in your account.

View order: {{website_url}}/account/orders/{{order_id}}

{{store_name}}`,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ];

    const toInsert = templates.filter((t) => !existingNames.includes(t.name));
    if (toInsert.length > 0) {
      await queryInterface.bulkInsert('notification_templates', toInsert);
      console.log(`Seeded ${toInsert.length} notification template(s): ${toInsert.map(t => t.name).join(', ')}`);
    } else {
      console.log('All missing notification templates already exist — nothing to seed.');
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('notification_templates', {
      name: ['welcome', 'order_placed', 'order_shipped', 'order_delivered', 'order_cancelled', 'order_refunded'],
    });
  },
};
