'use strict';

/**
 * Updates existing customer-facing order templates to include:
 * - Full items table (name, variant, qty, unit price, subtotal)
 * - Order totals breakdown (subtotal, shipping, tax, discount, total)
 * - Dynamic store details (already injected by notification.service.js)
 */

const ITEMS_TABLE = `
      <p style="margin:20px 0 8px;font-size:14px;font-weight:700;color:#374151;">Order Items</p>
      {{#if items}}
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">
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
            <td style="padding:10px 12px;text-align:right;font-weight:600;color:#374151;">{{this.subtotal}}</td>
          </tr>
          {{/each}}
        </tbody>
        <tfoot style="border-top:2px solid #e5e7eb;">
          {{#if order_subtotal}}<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;font-size:13px;">Subtotal</td><td style="padding:8px 12px;text-align:right;color:#374151;">{{order_subtotal}}</td></tr>{{/if}}
          {{#if shipping_total}}<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;font-size:13px;">Shipping</td><td style="padding:8px 12px;text-align:right;color:#374151;">{{shipping_total}}</td></tr>{{/if}}
          {{#if tax_total}}<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;font-size:13px;">Tax</td><td style="padding:8px 12px;text-align:right;color:#374151;">{{tax_total}}</td></tr>{{/if}}
          {{#if discount_total}}<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#16a34a;font-size:13px;">Discount</td><td style="padding:8px 12px;text-align:right;color:#16a34a;">-{{discount_total}}</td></tr>{{/if}}
          <tr style="background:#f9fafb;">
            <td colspan="3" style="padding:12px;text-align:right;font-weight:700;font-size:15px;color:#111827;">Total</td>
            <td style="padding:12px;text-align:right;font-weight:800;font-size:17px;color:#059669;">{{order_total}}</td>
          </tr>
        </tfoot>
      </table>
      {{/if}}`;

const H = (bg, title, body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333;">
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

const ORDER_META_ROW = (label, val) =>
  `<tr><td style="padding:9px 14px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #f0f0f0;">${label}</td><td style="padding:9px 14px;font-size:14px;color:#374151;border-bottom:1px solid #f0f0f0;">${val}</td></tr>`;

const ORDER_META = `
  <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:16px 0;">
    ${ORDER_META_ROW('Order Number', '<strong>#{{order_number}}</strong>')}
    ${ORDER_META_ROW('Order Date', '{{order_date}}')}
    ${ORDER_META_ROW('Payment', '{{payment_method}}')}
  </table>`;

module.exports = {
  async up(queryInterface) {

    const updates = [
      {
        name: 'order_placed',
        subject: 'Order Confirmed — #{{order_number}}',
        body_html: H('#059669', 'Order Confirmed!', `
          <p style="margin:0 0 4px;font-size:16px;color:#374151;">Hi <strong>{{customer_name}}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.7;">Thank you for your order! We've received it and it's being processed. You'll receive a shipping notification soon.</p>
          ${ORDER_META}
          ${ITEMS_TABLE}
          <div style="text-align:center;margin:28px 0;">
            <a href="{{website_url}}/account/orders/{{order_id}}" style="background:#059669;color:#fff;text-decoration:none;padding:13px 30px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">View Your Order</a>
          </div>`),
        body_text: `Hi {{customer_name}},\n\nYour order #{{order_number}} is confirmed!\nDate: {{order_date}} | Payment: {{payment_method}} | Total: {{order_total}}\n\nView: {{website_url}}/account/orders/{{order_id}}\n\n{{store_name}}`,
      },
      {
        name: 'order_shipped',
        subject: 'Your Order #{{order_number}} Has Shipped!',
        body_html: H('#2563eb', 'Your Order is On Its Way!', `
          <p style="margin:0 0 4px;font-size:16px;color:#374151;">Hi <strong>{{customer_name}}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.7;">Great news — your order <strong>#{{order_number}}</strong> has been shipped!</p>
          <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:16px 0;">
            ${ORDER_META_ROW('Order Number', '<strong>#{{order_number}}</strong>')}
            {{#if tracking_number}}${ORDER_META_ROW('Tracking Number', '{{tracking_number}}')}{{/if}}
            {{#if courier}}${ORDER_META_ROW('Courier', '{{courier}}')}{{/if}}
          </table>
          ${ITEMS_TABLE}
          <div style="text-align:center;margin:28px 0;">
            {{#if tracking_url}}<a href="{{tracking_url}}" style="background:#2563eb;color:#fff;text-decoration:none;padding:13px 28px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;margin-right:10px;">Track Package</a>{{/if}}
            <a href="{{website_url}}/account/orders/{{order_id}}" style="background:#374151;color:#fff;text-decoration:none;padding:13px 28px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">View Order</a>
          </div>`),
        body_text: `Hi {{customer_name}},\n\nOrder #{{order_number}} has shipped!\n{{#if tracking_number}}Tracking: {{tracking_number}}\n{{/if}}{{#if courier}}Courier: {{courier}}\n{{/if}}\nView: {{website_url}}/account/orders/{{order_id}}\n\n{{store_name}}`,
      },
      {
        name: 'order_delivered',
        subject: 'Your Order #{{order_number}} Has Been Delivered',
        body_html: H('#059669', 'Your Order Has Arrived!', `
          <p style="margin:0 0 4px;font-size:16px;color:#374151;">Hi <strong>{{customer_name}}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.7;">Your order <strong>#{{order_number}}</strong> has been delivered. We hope you love it!</p>
          ${ORDER_META}
          ${ITEMS_TABLE}
          <div style="text-align:center;margin:28px 0;">
            <a href="{{website_url}}/account/orders/{{order_id}}" style="background:#059669;color:#fff;text-decoration:none;padding:13px 30px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">View Order</a>
          </div>
          <p style="font-size:14px;color:#6b7280;text-align:center;">Loved your purchase? <a href="{{website_url}}/products" style="color:#059669;font-weight:600;">Leave a review</a></p>`),
        body_text: `Hi {{customer_name}},\n\nOrder #{{order_number}} delivered!\nTotal: {{order_total}}\n\nView: {{website_url}}/account/orders/{{order_id}}\n\n{{store_name}}`,
      },
      {
        name: 'order_cancelled',
        subject: 'Order #{{order_number}} Has Been Cancelled',
        body_html: H('#dc2626', 'Order Cancelled', `
          <p style="margin:0 0 4px;font-size:16px;color:#374151;">Hi <strong>{{customer_name}}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.7;">Your order <strong>#{{order_number}}</strong> has been cancelled.</p>
          {{#if cancel_reason}}<div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;padding:14px 18px;margin:0 0 16px;"><p style="margin:0;font-size:14px;color:#374151;"><strong>Reason:</strong> {{cancel_reason}}</p></div>{{/if}}
          ${ORDER_META}
          ${ITEMS_TABLE}
          {{#if refund_amount}}<p style="font-size:14px;color:#374151;margin:16px 0;">A refund of <strong>{{refund_amount}}</strong> will be processed within 5–7 business days.</p>{{/if}}
          <div style="text-align:center;margin:28px 0;">
            <a href="{{website_url}}/products" style="background:#374151;color:#fff;text-decoration:none;padding:13px 30px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">Continue Shopping</a>
          </div>`),
        body_text: `Hi {{customer_name}},\n\nOrder #{{order_number}} cancelled.\n{{#if cancel_reason}}Reason: {{cancel_reason}}\n{{/if}}{{#if refund_amount}}Refund: {{refund_amount}}\n{{/if}}\n{{store_name}}`,
      },
      {
        name: 'order_refunded',
        subject: 'Refund Processed for Order #{{order_number}} 💳',
        body_html: H('#7c3aed', 'Refund Processed', `
          <p style="margin:0 0 4px;font-size:16px;color:#374151;">Hi <strong>{{customer_name}}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.7;">A refund of <strong>{{refund_amount}}</strong> has been processed for order <strong>#{{order_number}}</strong>.</p>
          ${ORDER_META}
          ${ITEMS_TABLE}
          <div style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:4px;padding:14px 18px;margin:20px 0;">
            <p style="margin:0;font-size:14px;color:#374151;">Please allow <strong>5–7 business days</strong> for the amount to appear in your account.</p>
          </div>
          <div style="text-align:center;margin:28px 0;">
            <a href="{{website_url}}/account/orders/{{order_id}}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:13px 30px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">View Order</a>
          </div>`),
        body_text: `Hi {{customer_name}},\n\nRefund of {{refund_amount}} for order #{{order_number}} processed.\nPlease allow 5-7 business days.\n\nView: {{website_url}}/account/orders/{{order_id}}\n\n{{store_name}}`,
      },
      {
        name: 'welcome',
        subject: 'Welcome to {{store_name}}!',
        body_html: H('#1a1a2e', 'Welcome to {{store_name}}!', `
          <p style="margin:0 0 4px;font-size:16px;color:#374151;">Hi <strong>{{name}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.7;">Thanks for creating an account at <strong>{{store_name}}</strong>. We're thrilled to have you. Start browsing our latest products!</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="{{website_url}}/products" style="background:#6c63ff;color:#fff;text-decoration:none;padding:13px 30px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">Shop Now</a>
          </div>`),
        body_text: `Hi {{name}},\n\nWelcome to {{store_name}}!\n\nStart shopping: {{website_url}}/products\n\nNeed help? {{support_email}}\n\n{{store_name}}`,
      },
    ];

    for (const u of updates) {
      await queryInterface.sequelize.query(
        `UPDATE notification_templates SET subject = :subject, body_html = :body_html, body_text = :body_text, updated_at = NOW() WHERE name = :name AND channel = 'email'`,
        { replacements: { name: u.name, subject: u.subject, body_html: u.body_html, body_text: u.body_text } }
      );
      console.log(`Updated template: ${u.name}`);
    }
  },

  async down() {
    console.log('To revert the changes made by the "update-order-templates-with-items-table" seeder, please manually restore the email templates from a backup or run the following command to re-seed the original templates:');
    console.log('npx sequelize-cli db:seed --seed 20260429200000-seed-missing-email-templates.js');
  },
};
