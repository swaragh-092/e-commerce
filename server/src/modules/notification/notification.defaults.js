'use strict';

/**
 * Default email template HTML bodies.
 * Keyed by template name. Used for the "Reset to Default" action.
 * These match the original seeder definitions.
 */
const EMAIL_WRAPPER = (content, footer = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{store_name}}</title>
<style>
  body { margin: 0; padding: 0; background: #f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; }
  .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .header { background: #1a1a2e; padding: 32px 40px; text-align: center; }
  .header img { max-height: 48px; max-width: 200px; }
  .header h1 { color: #ffffff; margin: 12px 0 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
  .body { padding: 40px; }
  .body p { line-height: 1.7; font-size: 15px; margin: 0 0 16px; color: #444; }
  .body h2 { font-size: 20px; margin: 0 0 16px; color: #111; }
  .btn { display: inline-block; margin: 20px 0; padding: 14px 32px; background: #6c63ff; color: #fff !important; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 700; }
  .info-box { background: #f8f9fa; border-left: 4px solid #6c63ff; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
  .info-box p { margin: 4px 0; font-size: 14px; color: #555; }
  .info-box strong { color: #111; }
  table.items { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
  table.items th { background: #f4f4f4; text-align: left; padding: 10px 12px; font-weight: 600; color: #555; border-bottom: 2px solid #e0e0e0; }
  table.items td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  table.items tr:last-child td { border-bottom: none; }
  .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #e0e0e0; }
  .footer { background: #f8f8f8; border-top: 1px solid #eee; padding: 24px 40px; text-align: center; }
  .footer p { font-size: 12px; color: #999; margin: 4px 0; line-height: 1.6; }
  .footer a { color: #6c63ff; text-decoration: none; }
  .divider { border: none; border-top: 1px solid #eee; margin: 24px 0; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    {{#if store_logo}}<img src="{{store_logo}}" alt="{{store_name}}">{{/if}}
    <h1>{{store_name}}</h1>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    ${footer}
    <p>{{copyright}}</p>
    <p>You're receiving this email because you have an account at <a href="{{website_url}}">{{store_name}}</a>.</p>
  </div>
</div>
</body>
</html>`;

const DEFAULTS = {
  order_placed: {
    subject: 'Order Confirmed — #{{order_number}}',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Thanks for your order, {{customer_name}}! 🎉</h2>
    <p>We've received your order and it's being processed. You'll get another email when it ships.</p>
    <div class="info-box">
      <p><strong>Order Number:</strong> {{order_number}}</p>
      <p><strong>Order Date:</strong> {{order_date}}</p>
      <p><strong>Payment Method:</strong> {{payment_method}}</p>
    </div>
    {{#if items}}
    <table class="items">
      <thead><tr><th>Product</th><th>Qty</th><th>Price</th></tr></thead>
      <tbody>
        {{#each items}}
        <tr>
          <td>{{this.name}}{{#if this.variant}}<br><small style="color:#999">{{this.variant}}</small>{{/if}}</td>
          <td>{{this.quantity}}</td>
          <td>{{this.price}}</td>
        </tr>
        {{/each}}
        <tr class="total-row"><td colspan="2">Total</td><td>{{order_total}}</td></tr>
      </tbody>
    </table>
    {{/if}}
    <a href="{{website_url}}/account/orders/{{order_id}}" class="btn">View Order</a>
    <hr class="divider">
    <p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`, '<p>Questions? <a href="mailto:{{support_email}}">Contact Support</a></p>'),
    bodyText: 'Hi {{customer_name}},\n\nYour order #{{order_number}} has been confirmed! Total: {{order_total}}.\n\nView your order: {{website_url}}/account/orders/{{order_id}}\n\nThanks,\n{{store_name}}',
  },

  order_shipped: {
    subject: 'Your Order #{{order_number}} Has Shipped!',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Your order is on its way, {{customer_name}}!</h2>
    <p>Great news — your order has been shipped and is headed your way.</p>
    <div class="info-box">
      <p><strong>Order Number:</strong> {{order_number}}</p>
      {{#if tracking_number}}<p><strong>Tracking Number:</strong> {{tracking_number}}</p>{{/if}}
      {{#if courier}}<p><strong>Courier:</strong> {{courier}}</p>{{/if}}
    </div>
    {{#if tracking_url}}
    <a href="{{tracking_url}}" class="btn">Track Your Package</a>
    {{/if}}
    <a href="{{website_url}}/account/orders/{{order_id}}" class="btn" style="background:#444;margin-left:12px">View Order</a>
    <hr class="divider">
    <p style="font-size:13px;color:#888">Questions? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`, ''),
    bodyText: 'Hi {{customer_name}},\n\nYour order #{{order_number}} has shipped!\n\n{{#if tracking_number}}Tracking: {{tracking_number}}\n{{/if}}View order: {{website_url}}/account/orders/{{order_id}}\n\n{{store_name}}',
  },

  order_delivered: {
    subject: 'Your Order #{{order_number}} Has Been Delivered',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Your order has arrived, {{customer_name}}! </h2>
    <p>Your order #{{order_number}} has been delivered. We hope you love it!</p>
    <a href="{{website_url}}/account/orders/{{order_id}}" class="btn">View Order</a>
    <hr class="divider">
    <p>Enjoyed your purchase? We'd love to hear from you. <a href="{{website_url}}/products">Leave a review</a></p>
    <p style="font-size:13px;color:#888">Need help? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`, ''),
    bodyText: 'Hi {{customer_name}},\n\nYour order #{{order_number}} has been delivered!\n\nView order: {{website_url}}/account/orders/{{order_id}}\n\n{{store_name}}',
  },

  order_cancelled: {
    subject: 'Order #{{order_number}} Cancelled',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Your order has been cancelled</h2>
    <p>Hi {{customer_name}}, we're letting you know that order <strong>#{{order_number}}</strong> has been cancelled.</p>
    {{#if cancel_reason}}<div class="info-box"><p><strong>Reason:</strong> {{cancel_reason}}</p></div>{{/if}}
    {{#if refund_amount}}<p>A refund of <strong>{{refund_amount}}</strong> will be processed to your original payment method within 5–7 business days.</p>{{/if}}
    <a href="{{website_url}}/products" class="btn">Continue Shopping</a>
    <hr class="divider">
    <p style="font-size:13px;color:#888">Questions? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`, ''),
    bodyText: 'Hi {{customer_name}},\n\nYour order #{{order_number}} has been cancelled.\n\n{{#if refund_amount}}Refund: {{refund_amount}}{{/if}}\n\n{{store_name}}',
  },

  order_refunded: {
    subject: 'Refund Processed for Order #{{order_number}}',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Refund processed</h2>
    <p>Hi {{customer_name}}, a refund of <strong>{{refund_amount}}</strong> has been processed for order #{{order_number}}.</p>
    <p>Please allow 5–7 business days for the amount to appear in your account, depending on your payment provider.</p>
    <a href="{{website_url}}/account/orders/{{order_id}}" class="btn">View Order</a>
    <hr class="divider">
    <p style="font-size:13px;color:#888">Questions? <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`, ''),
    bodyText: 'Hi {{customer_name}},\n\nRefund of {{refund_amount}} for order #{{order_number}} has been processed.\n\n{{store_name}}',
  },

  welcome: {
    subject: 'Welcome to {{store_name}}!',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Welcome aboard, {{name}}!</h2>
    <p>Thanks for creating an account at <strong>{{store_name}}</strong>. We're thrilled to have you.</p>
    <p>Start browsing our latest products:</p>
    <a href="{{website_url}}/products" class="btn">Shop Now</a>
    <hr class="divider">
    <p>Need help? Reach us at <a href="mailto:{{support_email}}">{{support_email}}</a></p>
`, ''),
    bodyText: 'Hi {{name}},\n\nWelcome to {{store_name}}! We\'re glad you\'re here.\n\nStart shopping: {{website_url}}/products\n\n{{store_name}}',
  },

  email_verification: {
    subject: 'Verify Your Email — {{store_name}}',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Please verify your email</h2>
    <p>Hi {{name}}, thanks for signing up. Click the button below to verify your email address and activate your account.</p>
    <a href="{{verify_url}}" class="btn">Verify Email</a>
    <hr class="divider">
    <p style="font-size:13px;color:#888">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
`, ''),
    bodyText: 'Hi {{name}},\n\nVerify your email: {{verify_url}}\n\nLink expires in 24 hours.\n\n{{store_name}}',
  },

  password_reset: {
    subject: 'Reset Your Password — {{store_name}}',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Reset your password</h2>
    <p>Hi {{name}}, we received a request to reset your password. Click the button below to set a new one.</p>
    <a href="{{reset_url}}" class="btn">Reset Password</a>
    <hr class="divider">
    <p style="font-size:13px;color:#888">This link expires in 1 hour. If you didn't request a password reset, ignore this email — your account is safe.</p>
`, ''),
    bodyText: 'Hi {{name}},\n\nReset your password: {{reset_url}}\n\nLink expires in 1 hour.\n\n{{store_name}}',
  },

  low_stock_alert: {
    subject: 'Low Stock Alert: {{productName}}',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Low Stock Alert ⚠️</h2>
    <p>The following product is running low on stock:</p>
    <div class="info-box">
      <p><strong>Product:</strong> {{productName}}</p>
      <p><strong>SKU:</strong> {{sku}}</p>
      <p><strong>Stock Remaining:</strong> {{stock}} units</p>
    </div>
    <a href="{{website_url}}/admin/products" class="btn">Manage Inventory</a>
`, ''),
    bodyText: 'Low stock alert: {{productName}} (SKU: {{sku}}) — {{stock}} units remaining.\n\nManage: {{website_url}}/admin/products\n\n{{store_name}}',
  },

  low_stock_admin: {
    subject: 'Low Stock Alert: {{productName}}',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Low Stock Alert ⚠️</h2>
    <p>The following product is running low on stock:</p>
    <div class="info-box">
      <p><strong>Product:</strong> {{productName}}</p>
      <p><strong>SKU:</strong> {{sku}}</p>
      <p><strong>Stock Remaining:</strong> {{stock}} units</p>
    </div>
    <a href="{{website_url}}/admin/products" class="btn">Manage Inventory</a>
`, ''),
    bodyText: 'Low stock alert: {{productName}} (SKU: {{sku}}) — {{stock}} units remaining.\n\nManage: {{website_url}}/admin/products\n\n{{store_name}}',
  },

  admin_new_order: {
    subject: '[{{store_name}}] New Order #{{order_number}} — {{order_total}}',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>New Order Received 🛍️</h2>
    <p>A new order has been placed on <strong>{{store_name}}</strong>.</p>
    <div class="info-box">
      <p><strong>Order Number:</strong> {{order_number}}</p>
      <p><strong>Customer:</strong> {{customer_name}} ({{customer_email}})</p>
      <p><strong>Order Date:</strong> {{order_date}}</p>
      <p><strong>Total:</strong> {{order_total}}</p>
    </div>
    <a href="{{website_url}}/admin/orders/{{order_id}}" class="btn">View Order in Admin</a>
`, ''),
    bodyText: 'New Order #{{order_number}} on {{store_name}}\n\nCustomer: {{customer_name}} <{{customer_email}}>\nDate: {{order_date}}\nTotal: {{order_total}}\n\nView: {{website_url}}/admin/orders/{{order_id}}',
  },

  admin_order_cancelled: {
    subject: '[{{store_name}}] Order #{{order_number}} Cancelled',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Order Cancelled 🛑</h2>
    <p>Order <strong>#{{order_number}}</strong> has been cancelled.</p>
    <div class="info-box">
      <p><strong>Customer:</strong> {{customer_name}} ({{customer_email}})</p>
      {{#if cancel_reason}}<p><strong>Reason:</strong> {{cancel_reason}}</p>{{/if}}
      {{#if refund_amount}}<p><strong>Refund:</strong> {{refund_amount}}</p>{{/if}}
    </div>
    <a href="{{website_url}}/admin/orders/{{order_id}}" class="btn">View Order</a>
`, ''),
    bodyText: 'Order #{{order_number}} cancelled on {{store_name}}\n\nCustomer: {{customer_name}}\n{{#if cancel_reason}}Reason: {{cancel_reason}}\n{{/if}}{{#if refund_amount}}Refund: {{refund_amount}}\n{{/if}}\nView: {{website_url}}/admin/orders/{{order_id}}',
  },

  admin_order_failed: {
    subject: '[{{store_name}}] Payment Failed — Order #{{order_number}}',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Payment Failed ⚠️</h2>
    <p>A payment has failed for order <strong>#{{order_number}}</strong>.</p>
    <div class="info-box">
      <p><strong>Customer:</strong> {{customer_name}} ({{customer_email}})</p>
      <p><strong>Failure Reason:</strong> {{failure_reason}}</p>
      <p><strong>Payment Method:</strong> {{payment_method}}</p>
      <p><strong>Amount:</strong> {{order_total}}</p>
    </div>
    <a href="{{website_url}}/admin/orders/{{order_id}}" class="btn">Review Order</a>
`, ''),
    bodyText: 'Payment Failed — Order #{{order_number}} on {{store_name}}\n\nCustomer: {{customer_name}} ({{customer_email}})\nFailure Reason: {{failure_reason}}\nPayment Method: {{payment_method}}\nAmount: {{order_total}}\n\nView: {{website_url}}/admin/orders/{{order_id}}',
  },

  new_enquiry_admin: {
    subject: '[{{store_name}}] New Enquiry Received',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>New Enquiry 📬</h2>
    <p>A new enquiry has been submitted on <strong>{{store_name}}</strong>.</p>
    <div class="info-box">
      <p><strong>Customer:</strong> {{customerName}} ({{customerEmail}})</p>
      <p><strong>Phone:</strong> {{customerPhone}}</p>
      <p><strong>Subject:</strong> {{productName}} {{#if productSku}}(SKU: {{productSku}}){{/if}}</p>
      {{^cartItems}}<p><strong>Quantity:</strong> {{quantity}}</p>{{/cartItems}}
    </div>
    {{#if cartItems}}
    <table class="items">
      <thead><tr><th>Product</th><th>Qty</th></tr></thead>
      <tbody>
        {{#each cartItems}}
        <tr>
          <td>{{this.product.name}}{{#if this.variant}}<br><small style="color:#999">{{this.variant.sku}}</small>{{/if}}</td>
          <td>{{this.quantity}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    {{/if}}
    <div class="info-box">
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">{{message}}</p>
    </div>
    <a href="{{website_url}}/admin/enquiries" class="btn">View Enquiries</a>
`, ''),
    bodyText: 'New Enquiry on {{store_name}}\n\nCustomer: {{customerName}} ({{customerEmail}})\nSubject: {{productName}}\n{{#if cartItems}}\nItems:\n{{#each cartItems}}- {{this.quantity}}x {{this.product.name}}\n{{/each}}{{/if}}\nMessage:\n{{message}}\n\nView: {{website_url}}/admin/enquiries',
  },

  new_enquiry_customer: {
    subject: 'We received your enquiry — {{store_name}}',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Hi {{customerName}},</h2>
    <p>Thank you for getting in touch with us! We have received your enquiry regarding <strong>{{productName}}</strong> and our team will get back to you shortly.</p>
    {{#if cartItems}}
    <table class="items">
      <thead><tr><th>Product</th><th>Qty</th></tr></thead>
      <tbody>
        {{#each cartItems}}
        <tr>
          <td>{{this.product.name}}{{#if this.variant}}<br><small style="color:#999">{{this.variant.sku}}</small>{{/if}}</td>
          <td>{{this.quantity}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    {{/if}}
    <div class="info-box">
      <p><strong>Your Message:</strong></p>
      <p style="white-space: pre-wrap;">{{message}}</p>
    </div>
    <p>If you have any additional information to add, simply reply to this email.</p>
`, ''),
    bodyText: 'Hi {{customerName}},\n\nThank you for getting in touch! We have received your enquiry regarding {{productName}} and will get back to you shortly.\n\n{{#if cartItems}}Items:\n{{#each cartItems}}- {{this.quantity}}x {{this.product.name}}\n{{/each}}\n\n{{/if}}Your Message:\n{{message}}\n\n{{store_name}}',
  },

  enquiry_reply_customer: {
    subject: 'Re: Your Enquiry regarding {{productName}} — {{store_name}}',
    bodyHtml: EMAIL_WRAPPER(`
    <h2>Hi {{customerName}},</h2>
    <p style="white-space: pre-wrap; font-size: 16px;">{{replyMessage}}</p>
    <br/>
    <hr class="divider">
    <p><strong>Your original message:</strong></p>
    <div class="info-box" style="margin-top: 10px;">
      <p style="white-space: pre-wrap; color: #555;">{{message}}</p>
    </div>
    <p>If you have any further questions, simply reply to this email.</p>
`, ''),
    bodyText: 'Hi {{customerName}},\n\n{{replyMessage}}\n\n---\nYour original message:\n{{message}}\n\n{{store_name}}',
  },
};

const TEMPLATE_VARIABLES = {
  order_placed:      ['customer_name','order_number','order_date','order_id','order_total','order_subtotal','shipping_total','tax_total','discount_total','payment_method','items','website_url','store_name','support_email'],
  order_shipped:     ['customer_name','order_number','order_id','tracking_number','tracking_url','courier','items','order_total','website_url','store_name','support_email'],
  order_delivered:   ['customer_name','order_number','order_id','items','order_total','website_url','store_name','support_email'],
  order_cancelled:   ['customer_name','order_number','cancel_reason','refund_amount','items','order_total','website_url','store_name','support_email'],
  order_refunded:    ['customer_name','order_number','order_id','refund_amount','items','order_total','website_url','store_name','support_email'],
  welcome:           ['name','website_url','store_name','support_email'],
  email_verification:['name','verify_url','store_name','support_email'],
  password_reset:    ['name','reset_url','store_name','support_email'],
  low_stock_alert:   ['productName','sku','stock','website_url','store_name','support_email'],
  low_stock_admin:   ['productName','sku','stock','website_url','store_name','support_email'],
  admin_new_order:      ['customer_name','customer_email','order_number','order_date','order_id','order_total','order_subtotal','shipping_total','tax_total','discount_total','payment_method','items','website_url','store_name','support_email'],
  admin_order_cancelled:['customer_name','customer_email','order_number','order_id','cancel_reason','refund_amount','items','order_total','website_url','store_name','support_email'],
  admin_order_failed:   ['customer_name','customer_email','order_number','order_date','order_id','order_total','payment_method','failure_reason','items','website_url','store_name','support_email'],
  new_enquiry_admin:    ['customerName','customerEmail','customerPhone','productName','productSku','quantity','cartItems','message','website_url','store_name','support_email'],
  new_enquiry_customer: ['customerName','productName','cartItems','message','website_url','store_name','support_email'],
  enquiry_reply_customer: ['customerName','productName','message','replyMessage','website_url','store_name','support_email'],
};

const SAMPLE_VARIABLES = {
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com',
  name: 'Jane Doe',
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
  customerPhone: '123-456-7890',
  message: 'I am interested in buying this product in bulk. Do you offer any discounts?',
  replyMessage: 'Thanks for reaching out! Yes, we offer a 15% discount on orders of 10 or more. Let me know how many you need.',
  order_number: 'ORD-2024-00123',
  order_date: new Date().toLocaleDateString(),
  order_id: 'preview-id',
  order_total: '₹1,249.00',
  order_subtotal: '₹1,099.00',
  shipping_total: '₹99.00',
  tax_total: '₹51.00',
  discount_total: null,
  payment_method: 'Credit Card',
  refund_amount: '₹1,249.00',
  cancel_reason: 'Customer requested cancellation',
  failure_reason: 'Insufficient funds',
  tracking_number: 'TRK123456789',
  tracking_url: '#',
  courier: 'FedEx',
  verify_url: '#verify',
  reset_url: '#reset',
  productName: 'Wireless Headphones Pro',
  productSku: 'WHP-001',
  sku: 'WHP-001',
  stock: 3,
  quantity: 1,
  store_name: 'My Store',
  website_url: 'http://localhost:3000',
  support_email: 'support@example.com',
  store_logo: null,
  copyright: `© ${new Date().getFullYear()} My Store. All rights reserved.`,
  current_year: new Date().getFullYear(),
  items: [
    { name: 'Wireless Headphones Pro', variant: 'Color: Black', quantity: 1, price: '₹899.00', subtotal: '₹899.00' },
    { name: 'USB-C Cable 2m', variant: null, quantity: 2, price: '₹100.00', subtotal: '₹200.00' },
  ],
  cartItems: [
    { product: { name: 'Wireless Headphones Pro' }, variant: { sku: 'WHP-BLK-01' }, quantity: 1 },
    { product: { name: 'USB-C Cable 2m' }, variant: null, quantity: 2 },
  ],
};

module.exports = { DEFAULTS, TEMPLATE_VARIABLES, SAMPLE_VARIABLES };
