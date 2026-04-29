'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const existing = await queryInterface.sequelize.query(
      `SELECT name FROM notification_templates`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const existingNames = existing.map((r) => r.name);

    const ITEMS_TABLE = `
      {{#if items}}
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb;">Product</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb;">Price</th>
            <th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {{#each items}}
          <tr style="border-bottom:1px solid #f0f0f0;">
            <td style="padding:10px 12px;color:#374151;">{{this.name}}{{#if this.variant}}<br><small style="color:#9ca3af;">{{this.variant}}</small>{{/if}}</td>
            <td style="padding:10px 12px;text-align:center;color:#374151;">{{this.quantity}}</td>
            <td style="padding:10px 12px;text-align:right;color:#374151;">{{this.price}}</td>
            <td style="padding:10px 12px;text-align:right;color:#374151;font-weight:600;">{{this.subtotal}}</td>
          </tr>
          {{/each}}
        </tbody>
        <tfoot>
          {{#if order_subtotal}}<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;">Subtotal</td><td style="padding:8px 12px;text-align:right;">{{order_subtotal}}</td></tr>{{/if}}
          {{#if shipping_total}}<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;">Shipping</td><td style="padding:8px 12px;text-align:right;">{{shipping_total}}</td></tr>{{/if}}
          {{#if tax_total}}<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;">Tax</td><td style="padding:8px 12px;text-align:right;">{{tax_total}}</td></tr>{{/if}}
          {{#if discount_total}}<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#16a34a;">Discount</td><td style="padding:8px 12px;text-align:right;color:#16a34a;">-{{discount_total}}</td></tr>{{/if}}
          <tr style="background:#f9fafb;border-top:2px solid #e5e7eb;">
            <td colspan="3" style="padding:12px;text-align:right;font-weight:700;font-size:15px;">Total</td>
            <td style="padding:12px;text-align:right;font-weight:800;font-size:16px;color:#111827;">{{order_total}}</td>
          </tr>
        </tfoot>
      </table>
      {{/if}}`;

    const H = (bg, title, body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="background:${bg};padding:28px 40px;text-align:center;">
  {{#if store_logo}}<img src="{{store_logo}}" alt="{{store_name}}" style="max-height:48px;max-width:160px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;">{{/if}}
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${title}</h1>
</td></tr>
<tr><td style="padding:36px 40px;">${body}</td></tr>
<tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">{{copyright}}</p>
  <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">Questions? <a href="mailto:{{support_email}}" style="color:${bg};">{{support_email}}</a></p>
</td></tr>
</table></td></tr></table></body></html>`;

    const ORDER_META = `
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:16px 0;">
        <tr style="background:#f9fafb;"><td style="padding:10px 16px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Order #</td><td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:700;border-bottom:1px solid #e5e7eb;">#{{order_number}}</td></tr>
        <tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Date</td><td style="padding:10px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">{{order_date}}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:10px 16px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Payment</td><td style="padding:10px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">{{payment_method}}</td></tr>
        <tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;font-weight:600;">Customer</td><td style="padding:10px 16px;font-size:14px;color:#374151;">{{customer_name}} &lt;{{customer_email}}&gt;</td></tr>
      </table>`;

    const templates = [
      {
        name: 'admin_new_order',
        channel: 'email',
        subject: '[{{store_name}}] New Order #{{order_number}} — {{order_total}}',
        body_html: H('#1d4ed8', ' New Order Received', `
          <p style="margin:0 0 8px;font-size:15px;color:#374151;">A new order has been placed on <strong>{{store_name}}</strong>.</p>
          ${ORDER_META}
          <p style="margin:16px 0 4px;font-size:14px;font-weight:600;color:#374151;">Order Items</p>
          ${ITEMS_TABLE}
          <div style="text-align:center;margin:24px 0;">
            <a href="{{website_url}}/admin/orders/{{order_id}}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">View Order in Admin</a>
          </div>`),
        body_text: `New Order #{{order_number}} on {{store_name}}\n\nCustomer: {{customer_name}} <{{customer_email}}>\nDate: {{order_date}}\nTotal: {{order_total}}\n\nView: {{website_url}}/admin/orders/{{order_id}}`,
        is_active: true, created_at: now, updated_at: now,
      },
      {
        name: 'admin_order_cancelled',
        channel: 'email',
        subject: '[{{store_name}}] Order #{{order_number}} Cancelled',
        body_html: H('#dc2626', ' Order Cancelled', `
          <p style="margin:0 0 8px;font-size:15px;color:#374151;">Order <strong>#{{order_number}}</strong> has been cancelled.</p>
          {{#if cancel_reason}}<div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;padding:14px 18px;margin:16px 0;"><p style="margin:0;font-size:14px;color:#374151;"><strong>Reason:</strong> {{cancel_reason}}</p></div>{{/if}}
          ${ORDER_META}
          ${ITEMS_TABLE}
          {{#if refund_amount}}<p style="font-size:14px;color:#374151;">Refund of <strong>{{refund_amount}}</strong> will be processed automatically.</p>{{/if}}
          <div style="text-align:center;margin:24px 0;">
            <a href="{{website_url}}/admin/orders/{{order_id}}" style="background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">View Order</a>
          </div>`),
        body_text: `Order #{{order_number}} cancelled on {{store_name}}\n\nCustomer: {{customer_name}}\n{{#if cancel_reason}}Reason: {{cancel_reason}}\n{{/if}}{{#if refund_amount}}Refund: {{refund_amount}}\n{{/if}}\nView: {{website_url}}/admin/orders/{{order_id}}`,
        is_active: true, created_at: now, updated_at: now,
      },
      {
        name: 'admin_order_failed',
        channel: 'email',
        subject: '[{{store_name}}] Payment Failed — Order #{{order_number}}',
        body_html: H('#d97706', ' Payment Failed', `
          <p style="margin:0 0 8px;font-size:15px;color:#374151;">A payment has failed for order <strong>#{{order_number}}</strong>.</p>
          <div style="background:#fffbeb;border-left:4px solid #d97706;border-radius:4px;padding:14px 18px;margin:16px 0;">
            <p style="margin:0;font-size:14px;color:#374151;"><strong>Failure Reason:</strong> {{failure_reason}}</p>
            <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Payment Method: {{payment_method}}</p>
          </div>
          ${ORDER_META}
          ${ITEMS_TABLE}
          <div style="text-align:center;margin:24px 0;">
            <a href="{{website_url}}/admin/orders/{{order_id}}" style="background:#d97706;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">Review Order</a>
          </div>`),
        body_text: `Payment Failed — Order #{{order_number}} on {{store_name}}\n\nCustomer: {{customer_name}} <{{customer_email}}>\nReason: {{failure_reason}}\nAmount: {{order_total}}\n\nView: {{website_url}}/admin/orders/{{order_id}}`,
        is_active: true, created_at: now, updated_at: now,
      },
    ];

    const toInsert = templates.filter((t) => !existingNames.includes(t.name));
    if (toInsert.length > 0) {
      await queryInterface.bulkInsert('notification_templates', toInsert);
      console.log(`Seeded ${toInsert.length} admin template(s): ${toInsert.map(t => t.name).join(', ')}`);
    } else {
      console.log('Admin templates already exist.');
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('notification_templates', {
      name: ['admin_new_order', 'admin_order_cancelled', 'admin_order_failed'],
    });
  },
};
