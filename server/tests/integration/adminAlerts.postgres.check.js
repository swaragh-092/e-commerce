'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const express = require('express');

if (!/^ecommerce_alert_verify(?:_[a-z0-9]+)?$/.test(process.env.DB_NAME || '')) {
  throw new Error('Set DB_NAME to a disposable ecommerce_alert_verify database.');
}
process.env.ADMIN_ALERTS_ENABLED = 'true';
process.env.ADMIN_ALERTS_EMAIL_ENABLED = 'true';
process.env.ADMIN_ALERTS_ASSIGNMENT_EMAIL = 'true';
process.env.ADMIN_ALERTS_PILOT_USERS = '';
process.env.ADMIN_ALERTS_PUBLIC_URL = 'https://example.test';

const { sequelize } = require('../../src/modules');
sequelize.options.logging = false;
const alerts = require('../../src/modules/notification/adminAlerts.service');
const dispatcher = require('../../src/modules/notification/notification.dispatcher');
const assignment = require('../../src/modules/notification/notificationAssignment.service');
const orderService = require('../../src/modules/order/order.service');
const enquiryService = require('../../src/modules/enquiry/enquiry.service');
const adminService = require('../../src/modules/admin/admin.service');
const existingRules = require('../../src/modules/notification/notificationRules.service');

async function createStaff(role, id) {
  await alerts.sql(`INSERT INTO users (id,email,password,role,status,email_verified)
    VALUES (:id,:email,'unused','admin','active',true) RETURNING id`, { id, email: id + '@example.test' });
  await alerts.sql('INSERT INTO user_roles (user_id,role_id) SELECT :id,id FROM roles WHERE slug = :role RETURNING user_id', { id, role });
}

async function run() {
  const admin = randomUUID();
  const staff = randomUUID();
  const order = randomUUID();
  const role = 'alert-editor-' + staff;
  const [createdRole] = await alerts.sql('INSERT INTO roles (name,slug) VALUES (:role,:role) RETURNING id', { role });
  await alerts.sql(`INSERT INTO role_permissions (role_id,permission_id)
    SELECT :id,id FROM permissions WHERE key IN ('orders.read','enquiries.manage') RETURNING role_id`, { id: createdRole.id });
  await createStaff('super_admin', admin);
  await createStaff(role, staff);
  await alerts.sql(`INSERT INTO orders (id,order_number,subtotal,total,payment_method,status)
    VALUES (:order,:reference,10,10,'cod','confirmed') RETURNING id`, { order, reference: order });
  const [actor] = await alerts.staff(admin);

  const app = express();
  app.use(express.json(), (req, _, next) => { req.user = { id: req.get('test-user') }; next(); });
  app.use(require('../../src/modules/notification/adminAlerts.routes'));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const call = async (method, route, user, data, expected = 200) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + route, {
      method, headers: { 'test-user': user, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result.data;
  };

  try {
    const isFresh = !(await alerts.one('SELECT id FROM admin_alert_rules LIMIT 1'));
    if (isFresh) {
      await alerts.sql(`INSERT INTO notification_templates (id,name,channel,subject,body_html,body_text,is_active,created_at,updated_at)
        VALUES (:id,'order_assigned_staff','email','Packing order {{order_number}}','<p>Legacy</p>',
          'Pack order {{order_number}}',true,now(),now())
        ON CONFLICT (name,channel) DO UPDATE SET subject = EXCLUDED.subject, body_text = EXCLUDED.body_text, is_active = true RETURNING id`,
      { id: randomUUID() });
    }
    const { rules } = await call('GET', '/internal-rules', admin);
    if (isFresh) assert.equal(rules.find(item => item.event === 'order_assigned').config.subject, 'Packing order {{reference}}');
    const rule = rules.find(item => item.event === 'order_status');
    const path = '/internal-rules/' + rule.id;
    const grant = path + '/delegations/' + staff;
    await call('PUT', grant, admin, { fields: ['title'], audience: [] });
    assert.equal((await call('GET', '/internal-rules', staff)).rules.length, 1);
    const config = { ...rule.config, title: 'Order is now {{after}}' };
    await call('PUT', path, staff, { version: rule.version, config: { ...config, required: true } }, 403);
    const published = await call('PUT', path, staff, { version: rule.version, config });
    await call('PUT', path, staff, { version: rule.version, config }, 409);
    await call('DELETE', grant, admin);
    await call('PUT', path, staff, { version: published.version, config }, 403);
    assert.equal((await call('GET', path + '/history', admin)).versions[0].editor_id, staff);
    await call('PUT', '/preferences', staff, { events: { order_status: { in_app: true } }, quiet: null });

    const sent = [];
    dispatcher.dispatch = async (_, message) => {
      sent.push(message);
      if (sent.length === 1) throw Object.assign(new Error('Temporary failure'), { responseCode: 451 });
      return true;
    };
    await assignment.assign('orders', order, staff, actor);
    await orderService.updateStatus(order, 'processing', admin);
    await assert.rejects(() => sequelize.transaction(async transaction => {
      await alerts.capture('staff_access', { userId: staff, change: 'status', before: 'active', after: 'inactive' }, transaction);
      throw new Error('rollback');
    }), /rollback/);
    const replay = 'check:' + order;
    for (let i = 0; i < 2; i++) await alerts.capture('order_delivered', { sourceId: order, reference: order }, null, replay);
    assert.equal((await alerts.one('SELECT count(*)::integer AS count FROM admin_alert_events WHERE occurrence = :replay', { replay })).count, 1);
    await Promise.all([alerts.process(), alerts.process()]);
    const inbox = await call('GET', '/inbox?unread=true', staff);
    assert.equal(inbox.unread, 2);
    assert.ok(inbox.items.some(item => item.message.title === 'Order is now processing'));
    assert.equal((await call('GET', '/inbox', admin)).unread, 0);
    await call('PATCH', '/inbox/' + inbox.items[0].id, admin, { read: true });
    assert.equal((await call('GET', '/inbox', staff)).unread, 2);
    await call('PATCH', '/inbox/' + inbox.items[0].id, staff, { read: true });
    assert.equal((await call('GET', '/inbox', staff)).unread, 1);
    await call('POST', '/inbox/read-all', staff);
    assert.equal((await call('GET', '/inbox', staff)).unread, 0);
    await alerts.sql("UPDATE admin_alert_email SET due_at = now() WHERE user_id = :staff AND status = 'queued' RETURNING id", { staff });
    await alerts.process();
    assert.equal(sent.length, 2);
    assert.equal(sent[0].messageId, sent[1].messageId);
    assert.equal(sent[1].sensitive, true);
    assert.match(sent[1].text, /https:\/\/example.test\/admin\/login/);
    assert.equal((await alerts.one('SELECT status FROM admin_alert_email WHERE user_id = :staff', { staff })).status, 'sent');

    await call('POST', path + '/restore', admin, { currentVersion: published.version, version: rule.version });
    assert.ok((await call('GET', '/inbox', staff)).items.some(item => item.message.title === 'Order is now processing'));
    await assignment.assign('orders', order, null, actor);
    assert.equal((await call('GET', '/inbox', staff)).items.length, 1);
    const enquiry = randomUUID();
    await alerts.sql(`INSERT INTO enquiries (id,name,email,message,created_at,updated_at)
      VALUES (:id,'Test customer','customer@example.test','Test enquiry',now(),now()) RETURNING id`, { id: enquiry });
    await call('PUT', '/internal-rules/email-policy', staff, { paused: true }, 403);
    await call('PUT', '/internal-rules/email-policy', admin, { paused: true });
    await assignment.assign('enquiries', enquiry, staff, actor);
    await enquiryService.updateStatus(enquiry, 'responded', admin);
    await alerts.process();
    assert.equal(sent.length, 2);
    assert.equal((await call('GET', '/inbox', staff)).items.filter(item => item.message.link.endsWith(enquiry)).length, 2);

    await call('PUT', '/internal-rules/email-policy', admin, { paused: false });
    const deliveryRule = rules.find(item => item.event === 'order_delivered');
    const previousDelivery = deliveryRule.config;
    const activated = await call('PUT', '/internal-rules/' + deliveryRule.id, admin, {
      version: deliveryRule.version, config: { ...previousDelivery, enabled: true, audience: ['user:' + staff],
        channels: ['in_app', 'email'], emailDefault: true },
    });
    dispatcher.dispatch = async () => { throw Object.assign(new Error('Permanent failure'), { responseCode: 550 }); };
    const variables = { notification_event_id: randomUUID() };
    await existingRules.route({ sourceTemplate: 'order_delivered', orderId: order, variables });
    await existingRules.route({ sourceTemplate: 'order_delivered', orderId: order, variables });
    await alerts.process();
    assert.equal((await call('GET', '/inbox', staff)).items.filter(item => item.message.title === 'Order delivered').length, 1);
    assert.equal((await alerts.one('SELECT status FROM admin_alert_email WHERE user_id = :staff AND rule_id = :rule', { staff, rule: deliveryRule.id })).status, 'failed');
    await alerts.sql(`UPDATE admin_alert_email SET status = 'sending', due_at = now() - interval '1 minute'
      WHERE user_id = :staff AND rule_id = :rule RETURNING id`, { staff, rule: deliveryRule.id });
    await alerts.process();
    assert.equal((await alerts.one('SELECT status FROM admin_alert_email WHERE user_id = :staff AND rule_id = :rule', { staff, rule: deliveryRule.id })).status, 'ambiguous');
    await call('POST', '/internal-rules/' + deliveryRule.id + '/restore', admin, {
      currentVersion: activated.version, version: deliveryRule.version,
    });

    await adminService.updateStaffStatus(staff, 'inactive', 'Integration test', actor);
    await alerts.process();
    await call('GET', '/inbox', staff, undefined, 403);
    assert.ok((await call('GET', '/inbox', admin)).items.some(item => item.message.title === 'Staff access changed'));
    await adminService.updateStaffStatus(staff, 'active', 'Integration test', actor);
    await alerts.process();
    await alerts.sql('DELETE FROM user_roles WHERE user_id = :staff RETURNING user_id', { staff });
    await call('GET', '/inbox', staff, undefined, 403);
    assert.equal(alerts.quietDelay({ start: '22:00', end: '07:00', zone: 'Asia/Kolkata' }, new Date('2026-11-27T01:00:00Z')), 1800000);
    console.log('Admin alert workflow wiring, rollback, deduplication, inbox permissions, delegated publishing, email pause, retry, failure, ambiguous recovery and restoration passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => sequelize.close());
