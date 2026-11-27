'use strict';

const { randomUUID } = require('node:crypto');
const { QueryTypes } = require('sequelize');
const Joi = require('joi');
const { PERMISSIONS: P, isAdminUser, getPermissionsForUser, getRolesForUser } = require('../../config/permissions');
const AppError = require('../../utils/AppError');

const events = {
  staff_access: { label: 'Staff access changed', fields: ['change', 'before', 'after'], audience: ['participant', 'staff_admins'] },
  order_assigned: { label: 'Order assigned', fields: ['reference'], audience: ['participant'] },
  enquiry_assigned: { label: 'Enquiry assigned', fields: ['reference'], audience: ['participant'] },
  order_status: { label: 'Order status changed', fields: ['before', 'after', 'reference'], audience: ['participant'] },
  enquiry_status: { label: 'Enquiry status changed', fields: ['before', 'after', 'reference'], audience: ['participant'] },
};
const alertAdminsByDefault = new Set(['order_placed', 'delivery_exception', 'payment_failed', 'return_requested', 'enquiry_received']);
for (const item of require('./notification.events').EVENTS) {
  const details = ['status_label', 'payment_method', 'request_type'].filter(field => item.variables.includes(field));
  events[item.key] = {
    label: item.label, fields: ['reference', ...details], audience: ['participant', 'store_admins'],
    defaultAudience: alertAdminsByDefault.has(item.key) ? ['store_admins'] : ['participant'], optional: true,
  };
}

const pilot = () => (process.env.ADMIN_ALERTS_PILOT_USERS || '').split(',').map(id => id.trim()).filter(Boolean);
const pilotEligible = id => !pilot().length || pilot().includes(id);
const emailEnabled = () => process.env.ADMIN_ALERTS_EMAIL_ENABLED === 'true';
const assignmentCutover = () => !pilot().length && process.env.ADMIN_ALERTS_ASSIGNMENT_EMAIL === 'true';
const db = () => require('../index');
const sql = (statement, replacements = {}, transaction) =>
  db().sequelize.query(statement, { replacements, transaction, type: QueryTypes.SELECT });
const one = async (...args) => (await sql(...args))[0];
const enabled = async transaction => {
  const policy = await one('SELECT inbox_enabled FROM admin_alert_policy', {}, transaction);
  return policy?.inbox_enabled ?? (process.env.ADMIN_ALERTS_ENABLED === 'true');
};
const available = async id => pilotEligible(id) && await enabled();
const emailPaused = async transaction => (await one('SELECT email_paused FROM admin_alert_policy', {}, transaction)).email_paused;
const json = JSON.stringify;
const fail = (message, status = 400) => { throw new AppError(status === 409 ? 'CONFLICT' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', status, message); };
const uuid = Joi.string().uuid();
const token = /\{\{\s*([\w]+)\s*\}\}/g;
const channels = ['in_app', 'email'];
const isAssignment = event => event === 'order_assigned' || event === 'enquiry_assigned';
const editable = ['name', 'enabled', 'conditions', 'audience', 'channels', 'inAppDefault', 'emailDefault', 'urgent', 'title', 'body', 'subject', 'summary', 'linkLabel'];
const selectors = Joi.array().items(Joi.alternatives().try(
  Joi.string().valid('participant', 'staff_admins', 'store_admins'),
  Joi.string().pattern(/^user:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i),
  Joi.string().pattern(/^role:[\w-]{1,100}$/),
)).unique().max(100);
const configSchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
  enabled: Joi.boolean().required(),
  conditions: Joi.object().pattern(/^\w+$/, Joi.string().max(100)).required(),
  audience: selectors.min(1).required(),
  channels: Joi.array().items(Joi.string().valid(...channels)).unique().required(),
  inAppDefault: Joi.boolean().required(), emailDefault: Joi.boolean().required(),
  urgent: Joi.boolean().required(), required: Joi.boolean().required(),
  title: Joi.string().max(120).required(), body: Joi.string().max(1000).required(),
  subject: Joi.string().max(120).required(), summary: Joi.string().max(400).required(),
  linkLabel: Joi.string().max(50).required(),
});

function valid(schema, input) {
  const result = schema.validate(input, { convert: false });
  if (result.error) fail(result.error.details[0].message);
  return result.value;
}

function definition(event) {
  if (!Object.hasOwn(events, event)) fail('Unknown internal event', 404);
  return events[event];
}

function defaults(event) {
  const { label, fields, audience, defaultAudience, optional } = definition(event);
  const detail = fields.includes('after') ? ' New value: {{after}}.' : '';
  return {
    name: label, enabled: !optional, conditions: {}, audience: defaultAudience || audience, channels: isAssignment(event) ? channels : ['in_app'],
    inAppDefault: true, emailDefault: isAssignment(event),
    urgent: false, required: false, title: label, body: label + '.' + detail,
    subject: event === 'order_assigned' ? 'Order #{{reference}} assigned to you'
      : event === 'enquiry_assigned' ? 'Customer enquiry assigned to you' : label,
    summary: event === 'order_assigned' ? 'Order #{{reference}} has been assigned to you.' : label + '.' + detail,
    linkLabel: 'Open admin panel',
  };
}

function validateConfig(event, input) {
  const { fields, audience } = definition(event);
  const config = valid(configSchema, input);
  if (config.required && !config.channels.includes('in_app')) fail('Required alerts must include the inbox');
  if (Object.keys(config.conditions).some(key => !fields.includes(key))) fail('Unknown event condition');
  if (config.audience.some(key => !key.includes(':') && !audience.includes(key))) fail('Audience selector does not apply to this event');
  for (const field of ['title', 'body', 'subject', 'summary', 'linkLabel']) {
    const template = config[field];
    if ([...template.matchAll(token)].some(([, key]) => !fields.includes(key)) || /\{\{|\}\}/.test(template.replace(token, ''))) fail('Unknown template variable');
  }
  return config;
}

const ruleId = event => {
  const hex = require('node:crypto').createHash('sha256').update('admin-alert:' + event).digest('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), '4' + hex.slice(13, 16), '8' + hex.slice(17, 20), hex.slice(20, 32)].join('-');
};

async function seed(transaction) {
  const builtIns = Object.keys(events).map(event => ({ id: ruleId(event), event, config: defaults(event) }));
  const assignments = builtIns.filter(rule => isAssignment(rule.event));
  const existing = await sql('SELECT id FROM admin_alert_rules WHERE id IN (:ids)', { ids: assignments.map(rule => rule.id) }, transaction);
  const missing = assignments.filter(rule => !existing.some(row => row.id === rule.id));
  if (missing.length) {
    const templates = await db().NotificationTemplate.findAll({
      where: { channel: 'email', name: missing.map(rule => rule.event + '_staff') }, transaction,
    });
    for (const rule of missing) {
      const template = templates.find(item => item.name === rule.event + '_staff');
      if (!template) continue;
      rule.config.emailDefault = template.isActive;
      // Import compatible copy, dropping links and legacy customer/contact variables from internal mail.
      const adapt = (copy, max) => {
        const value = (copy || '').trim().replace(/\{\{\s*order_number\s*\}\}/g, '{{reference}}')
          .replace(/\{\{\s*name\s*\}\}/g, 'there');
        return value && value.length <= max && !/[<>\r\n]/.test(value) && !/https?:|www\.|@|mailto:/i.test(value)
          && !/\{\{|\}\}/.test(value.replace(/\{\{reference\}\}/g, '')) ? value : null;
      };
      rule.config.subject = adapt(template.subject, 120) || rule.config.subject;
      rule.config.summary = adapt(template.bodyText?.split(/\r?\n\s*\r?\n/)[0], 400) || rule.config.summary;
    }
  }
  await sql(`WITH created AS (
    INSERT INTO admin_alert_rules (id,event,version,config)
      SELECT id,event,1,config FROM jsonb_to_recordset(CAST(:rules AS jsonb)) AS input(id uuid,event text,config jsonb)
      ORDER BY id ON CONFLICT DO NOTHING RETURNING id, config
    ) INSERT INTO admin_alert_rule_versions (rule_id,version,config)
      SELECT id,1,config FROM created RETURNING rule_id`, { rules: json(builtIns) }, transaction);
}

async function capture(event, data, transaction, occurrence = null) {
  if (!await enabled(transaction)) return false;
  definition(event);
  if (!transaction && !occurrence) throw new Error('Admin alert events require a source transaction or occurrence key');
  await sql(`INSERT INTO admin_alert_events (id,event,data,occurrence)
    VALUES (:id,:event,CAST(:data AS jsonb),:occurrence) ON CONFLICT (occurrence) DO NOTHING RETURNING id`,
    { id: randomUUID(), event, data: json(data), occurrence }, transaction);
  return true;
}

const permission = (user, key) => getPermissionsForUser(user).includes(key);
const activeStaff = user => user?.status === 'active' && isAdminUser(user);
const manager = user => permission(user, P.NOTIFICATIONS_MANAGE);

async function staff(id, transaction) {
  const { User, Role, Permission } = db();
  const users = await User.findAll({
    where: { status: 'active', ...(id ? { id } : {}) },
    attributes: ['id', 'status', 'role', 'email', 'emailVerified', 'firstName', 'lastName'],
    include: [{ model: Role, as: 'roles', through: { attributes: [] }, include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }] }],
    transaction,
  });
  return users.map(user => user.toJSON()).filter(activeStaff);
}

async function source(event, transaction) {
  const { data } = event;
  if (data.test || event.event === 'staff_access') return {};
  const enquiry = event.event.startsWith('enquiry_');
  const model = enquiry ? db().Enquiry : db().Order;
  return model.findByPk(data.sourceId, { attributes: ['id', 'assignedUserId'], transaction });
}

function canRead(event, record, user) {
  if (!user || !pilotEligible(user.id)) return false;
  if (event.data.test) return event.data.userId === user.id;
  if (event.event === 'staff_access') return event.data.userId === user.id || permission(user, P.USERS_ASSIGN_ROLES);
  if (!record) return false;
  if (!permission(user, event.event.startsWith('enquiry_') ? P.ENQUIRIES_READ : P.ORDERS_READ)) return false;
  return !event.event.endsWith('_assigned') || record.assignedUserId === user.id;
}

function matchesAudience(config, event, record, user) {
  const participant = event.data.userId || record?.assignedUserId;
  return config.audience.some(selector => selector === 'participant' ? user.id === participant
    : selector === 'staff_admins' ? permission(user, P.USERS_ASSIGN_ROLES)
      : selector === 'store_admins' ? getRolesForUser(user).some(role => role === 'admin' || role === 'super_admin')
        : selector === 'user:' + user.id || user.roles?.some(role => selector === 'role:' + role.slug));
}

const preference = async (id, transaction) =>
  (await one('SELECT preferences FROM admin_alert_preferences WHERE user_id = :id', { id }, transaction))?.preferences || { events: {}, quiet: null };

function allowed(event, config, prefs, channel, user) {
  if (!config.channels.includes(channel)) return false;
  if (channel === 'in_app' && config.required) return true;
  if (channel === 'email' && (!emailEnabled() || !user.emailVerified || !user.email)) return false;
  const choice = prefs.events[event]?.[channel];
  return choice ?? (channel === 'email' ? config.emailDefault : config.inAppDefault);
}

function render(event, config, data) {
  const text = value => value.replace(token, (_, key) => String(data[key] ?? ''));
  const link = event === 'staff_access' ? '/admin/access-control'
    : event.startsWith('enquiry_') ? '/admin/enquiries' + (data.sourceId ? '?enquiry=' + data.sourceId : '')
      : data.sourceId ? '/admin/orders/' + data.sourceId : '/admin/notifications';
  return { title: text(config.title), body: text(config.body), subject: text(config.subject), summary: text(config.summary), linkLabel: text(config.linkLabel), link };
}

function quietDelay(quiet, now = new Date()) {
  if (!quiet || quiet.start === quiet.end) return 0;
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: quiet.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const isQuiet = date => {
    const time = format.format(date);
    return quiet.start < quiet.end ? time >= quiet.start && time < quiet.end : time >= quiet.start || time < quiet.end;
  };
  if (!isQuiet(now)) return 0;
  for (let minute = 1; minute <= 1560; minute++) {
    if (!isQuiet(new Date(+now + minute * 60000))) return minute * 60000;
  }
  return 3600000;
}

async function queueDelivery(table, event, rule, user, message, transaction) {
  await sql(`INSERT INTO ${table} (id,event_id,rule_id,version,user_id,message)
    VALUES (:id,:event,:rule,:version,:user,CAST(:message AS jsonb))
    ON CONFLICT (event_id,rule_id,user_id) DO NOTHING RETURNING id`, {
    id: randomUUID(), event: event.id, rule: rule.id, version: rule.version, user: user.id, message: json(message),
  }, transaction);
}

async function expandEvent() {
  return db().sequelize.transaction(async transaction => {
    if (!await enabled(transaction)) return false;
    const event = await one(`SELECT * FROM admin_alert_events WHERE rule_versions IS NULL
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`, {}, transaction);
    if (!event) return false;
    const rules = await sql('SELECT * FROM admin_alert_rules WHERE event = :event ORDER BY id', { event: event.event }, transaction);
    const record = await source(event, transaction);
    const users = await staff(null, transaction);
    const paused = await emailPaused(transaction);
    for (const rule of rules) {
      const config = rule.config;
      if (!config.enabled || Object.entries(config.conditions).some(([key, value]) => event.data[key] !== value)) continue;
      const message = render(event.event, config, event.data);
      for (const user of users) {
        if (!canRead(event, record, user) || !matchesAudience(config, event, record, user)) continue;
        const prefs = await preference(user.id, transaction);
        const personalized = event.event === 'staff_access' && !permission(user, P.USERS_ASSIGN_ROLES)
          ? { ...message, link: '/admin/profile' } : message;
        if (allowed(event.event, config, prefs, 'in_app', user)) await queueDelivery('admin_alert_inbox', event, rule, user, personalized, transaction);
        if (isAssignment(event.event) && (!event.data.configurableEmail || !assignmentCutover())) continue;
        if (!paused && allowed(event.event, config, prefs, 'email', user)) await queueDelivery('admin_alert_email', event, rule, user, message, transaction);
      }
    }
    await sql('UPDATE admin_alert_events SET rule_versions = CAST(:versions AS jsonb) WHERE id = :id RETURNING id',
      { id: event.id, versions: json(rules.map(({ id, version }) => ({ id, version }))) }, transaction);
    return true;
  });
}

async function deliver() {
  if (!await enabled()) return false;
  const row = await one(`WITH next AS (
      SELECT id FROM admin_alert_email WHERE status = 'queued' AND due_at <= now()
      ORDER BY due_at LIMIT 1 FOR UPDATE SKIP LOCKED
    ) UPDATE admin_alert_email q SET status = 'sending', due_at = now() + interval '10 minutes'
      FROM next WHERE q.id = next.id RETURNING q.*`);
  if (!row) return false;
  const finish = (status, error = null, delay = 0, attempted = false) => sql(`UPDATE admin_alert_email
    SET status = :status, error = :error, due_at = now() + :delay * interval '1 millisecond',
      attempts = attempts + :attempted WHERE id = :id AND status = 'sending' RETURNING id`,
  { status, error, delay, attempted: Number(attempted), id: row.id });
  let attempted = false;
  try {
    const event = await one('SELECT * FROM admin_alert_events WHERE id = :id', { id: row.event_id });
    const [user] = await staff(row.user_id);
    const version = await one('SELECT v.config,r.config AS current FROM admin_alert_rule_versions v JOIN admin_alert_rules r ON r.id = v.rule_id WHERE v.rule_id = :id AND v.version = :version', { id: row.rule_id, version: row.version });
    const config = version?.config || event.data.testConfig;
    const prefs = await preference(row.user_id);
    const stillSending = event.data.test || (version?.current.enabled && version.current.channels.includes('email'));
    if (!stillSending || !canRead(event, await source(event), user) || !config || !allowed(event.event, config, event.data.test ? { events: { [event.event]: { email: true } } } : prefs, 'email', user)
      || (!event.data.test && event.event.endsWith('_assigned') && !assignmentCutover())) {
      await finish('skipped', 'Recipient or email channel is no longer eligible');
      return true;
    }
    const delay = await emailPaused() ? 60000 : config.urgent || event.data.test ? 0 : quietDelay(prefs.quiet);
    if (delay) {
      await finish('queued', null, delay);
      return true;
    }
    const origin = new URL(process.env.ADMIN_ALERTS_PUBLIC_URL || require('../auth/authRedirects').getClientBaseUrl());
    if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('Invalid public URL');
    const signIn = new URL('/admin/login', origin);
    attempted = true;
    const sent = await require('./notification.dispatcher').dispatch('email', {
      to: user.email, subject: row.message.subject, text: row.message.summary + '\n\n' + signIn.href,
      sensitive: true, messageId: '<' + row.id + '@' + origin.hostname + '>',
    });
    await finish(sent ? 'sent' : 'skipped', sent ? null : 'Messaging email is disabled', 0, sent);
  } catch (error) {
    const code = Number(error.responseCode);
    const temporary = (code >= 400 && code < 500) || ['ECONNECTION', 'EDNS', 'ECONNREFUSED'].includes(error.code);
    const status = temporary && row.attempts < 3 ? 'queued'
      : attempted && !temporary && !(code >= 500) && ['ETIMEDOUT', 'ESOCKET'].includes(error.code) ? 'ambiguous' : 'failed';
    await finish(status, code ? 'SMTP response ' + code : status === 'ambiguous' ? 'SMTP acknowledgement uncertain' : 'Email delivery failed',
      status === 'queued' ? 60000 * 2 ** row.attempts : 0, attempted);
  }
  return true;
}

async function processAlerts() {
  if (!await enabled()) return;
  await seed();
  await sql(`UPDATE admin_alert_email SET status = 'ambiguous', error = 'Worker stopped before recording the SMTP outcome'
    WHERE status = 'sending' AND due_at <= now() RETURNING id`);
  for (let i = 0; i < 50; i++) {
    if (!await expandEvent()) break;
  }
  for (let i = 0; i < 50; i++) {
    if (!await deliver()) break;
  }
}

module.exports = {
  events, enabled, available, assignmentCutover, capture, process: processAlerts, seed, sql, one, json, fail, valid, uuid,
  staff, manager, editable, selectors, validateConfig, definition, preference, render, queueDelivery,
  allowed, emailEnabled, emailPaused, quietDelay, isAssignment,
};
