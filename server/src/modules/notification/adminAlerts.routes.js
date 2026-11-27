'use strict';

const router = require('express').Router();
const Joi = require('joi');
const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const response = require('../../utils/response');
const { PERMISSIONS, getPermissionsForUser } = require('../../config/permissions');
const a = require('./adminAlerts.service');
const db = () => require('../index');

const wrap = (callback, management = false) => async (req, res, next) => {
  try {
    const [user] = await a.staff(req.user.id);
    if (!user) a.fail('Active staff access is required', 403);
    const mayConfigure = management && a.manager(user);
    if (!mayConfigure && !await a.available(req.user.id)) {
      if (req.method === 'GET' && req.path === '/inbox') return response.success(res, { enabled: false, items: [], unread: 0 });
      a.fail('Internal alerts are unavailable', 404);
    }
    return response.success(res, await callback(req, user));
  } catch (error) {
    return next(error);
  }
};

const ruleById = async (id, transaction) => {
  a.valid(a.uuid.required(), id);
  const rule = await a.one('SELECT * FROM admin_alert_rules WHERE id = :id' + (transaction ? ' FOR UPDATE' : ''), { id }, transaction);
  if (!rule) a.fail('Rule not found', 404);
  return rule;
};

const delegation = (id, user, transaction) =>
  a.one('SELECT fields,audience FROM admin_alert_delegations WHERE rule_id = :id AND user_id = :user', { id, user }, transaction);
const adminOnly = user => { if (!a.manager(user)) a.fail('Notification management permission is required', 403); };

async function permittedConfig(rule, user, input, transaction) {
  if (!a.manager(user) && !await delegation(rule.id, user.id, transaction)) a.fail('Rule access is required', 403);
  const config = a.validateConfig(rule.event, input);
  if (!a.manager(user)) {
    const grant = await delegation(rule.id, user.id, transaction);
    if (!grant || Object.keys(config).some(key => !grant.fields.includes(key) && !isDeepStrictEqual(rule.config[key], config[key]))) {
      a.fail('One or more fields are outside your delegation', 403);
    }
    if (!isDeepStrictEqual(rule.config.audience, config.audience) && config.audience.some(selector => !grant.audience.includes(selector))) {
      a.fail('One or more recipients are outside your delegation', 403);
    }
  }
  return config;
}

async function publish(rule, config, user, transaction) {
  const values = { id: rule.id, version: rule.version + 1, editor: user.id, config: a.json(config) };
  await a.sql('UPDATE admin_alert_rules SET version = :version, config = CAST(:config AS jsonb) WHERE id = :id RETURNING id', values, transaction);
  await a.sql(`INSERT INTO admin_alert_rule_versions (rule_id,version,editor_id,config)
    VALUES (:id,:version,:editor,CAST(:config AS jsonb)) RETURNING rule_id`, values, transaction);
  const changes = Object.fromEntries(Object.entries(config)
    .filter(([key, value]) => !isDeepStrictEqual(rule.config?.[key], value))
    .map(([key, value]) => [key, { old: rule.config?.[key] ?? null, new: value }]));
  await db().AuditLog.create({
    userId: user.id, action: rule.version ? 'UPDATE' : 'CREATE', entity: 'NotificationRule',
    entityId: rule.id, changes: { ...changes, version: { old: rule.version || null, new: values.version } },
  }, { transaction });
  return { ...rule, version: values.version, config };
}

router.get('/inbox', wrap(async (req, user) => {
  const unreadOnly = req.query.unread === 'true';
  const offset = Math.max(0, Math.min(2147483647, Number.parseInt(req.query.offset, 10) || 0));
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
  const permissions = getPermissionsForUser(user);
  // Apply access before counting or paging so the bell cannot reveal a hidden item's existence.
  const result = await a.one(`WITH visible AS (
      SELECT i.id,i.message,i.read_at,i.created_at FROM admin_alert_inbox i
      JOIN admin_alert_events e ON e.id = i.event_id
      LEFT JOIN enquiries q ON e.event LIKE 'enquiry_%' AND q.id = CAST(e.data->>'sourceId' AS uuid) AND q.deleted_at IS NULL
      LEFT JOIN orders o ON e.event NOT LIKE 'enquiry_%' AND o.id = CAST(e.data->>'sourceId' AS uuid)
      WHERE i.user_id = :user AND CASE
        WHEN e.data->>'test' = 'true' THEN CAST(e.data->>'userId' AS uuid) = :user
        WHEN e.event = 'staff_access' THEN :manageStaff OR CAST(e.data->>'userId' AS uuid) = :user
        WHEN e.event LIKE 'enquiry_%' THEN :readEnquiries AND q.id IS NOT NULL
          AND (e.event <> 'enquiry_assigned' OR q.assigned_user_id = :user)
        ELSE :readOrders AND o.id IS NOT NULL
          AND (e.event <> 'order_assigned' OR o.assigned_user_id = :user)
      END
    ), page AS (
      SELECT * FROM visible WHERE NOT :unreadOnly OR read_at IS NULL ORDER BY created_at DESC, id DESC
      LIMIT :limit OFFSET :offset
    )
    SELECT count(*) FILTER (WHERE read_at IS NULL)::integer AS unread,
      count(*) FILTER (WHERE NOT :unreadOnly OR read_at IS NULL)::integer AS total,
      (SELECT COALESCE(jsonb_agg(page ORDER BY created_at DESC,id DESC),'[]') FROM page) AS items
    FROM visible`, {
    user: user.id, readOrders: permissions.includes(PERMISSIONS.ORDERS_READ),
    readEnquiries: permissions.includes(PERMISSIONS.ENQUIRIES_READ), manageStaff: permissions.includes(PERMISSIONS.USERS_ASSIGN_ROLES),
    unreadOnly, limit, offset,
  });
  return { enabled: true, ...result };
}));
router.patch('/inbox/:id', wrap(async (req, user) => {
  const id = a.valid(a.uuid.required(), req.params.id);
  const read = a.valid(Joi.boolean().required(), req.body.read);
  await a.sql('UPDATE admin_alert_inbox SET read_at = CASE WHEN :read THEN COALESCE(read_at, now()) ELSE NULL END WHERE id = :id AND user_id = :user RETURNING id',
    { id, user: user.id, read });
  return {};
}));
router.post('/inbox/read-all', wrap(async (_, user) => {
  await a.sql('UPDATE admin_alert_inbox SET read_at = now() WHERE user_id = :user AND read_at IS NULL RETURNING id', { user: user.id });
  return {};
}));

const time = Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/).required();
const preferenceSchema = Joi.object({
  events: Joi.object().pattern(Joi.string().valid(...Object.keys(a.events)), Joi.object({
    in_app: Joi.boolean(), email: Joi.boolean(),
  })).required(),
  quiet: Joi.object({ start: time, end: time, zone: Joi.string().max(100).required() }).allow(null).required(),
});

router.get('/preferences', wrap(async (_, user) => {
  await a.seed();
  const rules = await a.sql('SELECT event, config FROM admin_alert_rules');
  const preferences = await a.preference(user.id);
  const sendEmail = await a.emailActive();
  const events = Object.entries(a.events).map(([key, event]) => {
    const configs = rules.filter(row => row.event === key && row.config.enabled).map(row => row.config);
    return { key, label: event.label, required: configs.some(config => config.required),
      in_app: configs.some(config => a.allowed(key, config, preferences, 'in_app', user)),
      email: sendEmail && (!a.isAssignment(key) || a.assignmentCutover()) && configs.some(config => a.allowed(key, config, preferences, 'email', user)) };
  });
  return { preferences, events, canEmail: Boolean(user.emailVerified), emailPaused: !sendEmail };
}));
router.put('/preferences', wrap(async (req, user) => {
  const preferences = a.valid(preferenceSchema, req.body);
  if (preferences.quiet) {
    try { new Intl.DateTimeFormat('en', { timeZone: preferences.quiet.zone }); }
    catch { a.fail('Enter a valid IANA time zone'); }
  }
  await a.sql(`INSERT INTO admin_alert_preferences VALUES (:id,CAST(:value AS jsonb))
    ON CONFLICT (user_id) DO UPDATE SET preferences = EXCLUDED.preferences RETURNING user_id`, { id: user.id, value: a.json(preferences) });
  return preferences;
}));

router.get('/internal-rules', wrap(async (_, user) => {
  const manage = a.manager(user);
  const inboxEnabled = await a.enabled();
  const inboxAvailable = await a.available(user.id);
  const { enabled: emailEnabled, paused: emailPaused } = await a.emailPolicy();
  if (manage && !inboxAvailable) return { manage, inboxEnabled, inboxAvailable, emailEnabled, emailPaused, rules: [] };
  if (manage) await a.seed();
  const rules = manage
    ? await a.sql('SELECT * FROM admin_alert_rules ORDER BY event,id')
    : await a.sql(`SELECT r.*,d.fields AS allowed_fields,d.audience AS allowed_audience
      FROM admin_alert_rules r JOIN admin_alert_delegations d ON d.rule_id = r.id WHERE d.user_id = :user ORDER BY r.event,r.id`, { user: user.id });
  const grantedUsers = new Set(rules.flatMap(rule => (rule.allowed_audience || [])
    .filter(selector => selector.startsWith('user:')).map(selector => selector.slice(5))));
  const people = manage ? await a.staff() : (await Promise.all([...grantedUsers].map(id => a.staff(id)))).flat();
  return { manage, inboxEnabled, inboxAvailable, rules, events: a.events, fields: a.editable, emailEnabled, emailPaused,
    staff: people.map(person => ({ id: person.id, label: [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email })),
    roles: [...new Set(people.flatMap(person => (person.roles || []).map(role => role.slug)))].sort() };
}, true));
router.put('/internal-rules/inbox-policy', wrap(async (req, user) => {
  adminOnly(user);
  const enabled = a.valid(Joi.boolean().required(), req.body.enabled);
  await db().sequelize.transaction(async transaction => {
    const previous = await a.one('SELECT inbox_enabled FROM admin_alert_policy FOR UPDATE', {}, transaction);
    await a.sql('UPDATE admin_alert_policy SET inbox_enabled = :enabled RETURNING singleton', { enabled }, transaction);
    await db().AuditLog.create({
      userId: user.id, action: 'UPDATE', entity: 'Settings', entityId: 'admin_alert_inbox',
      changes: { enabled: { old: previous.inbox_enabled, new: enabled } },
    }, { transaction });
  });
  return { enabled };
}, true));
router.put('/internal-rules/email-policy', wrap(async (req, user) => {
  adminOnly(user);
  const paused = a.valid(Joi.boolean().required(), req.body.paused);
  const enabled = !paused;
  await db().sequelize.transaction(async transaction => {
    await a.one('SELECT singleton FROM admin_alert_policy FOR UPDATE', {}, transaction);
    const previous = await a.emailActive(transaction);
    await a.sql('UPDATE admin_alert_policy SET email_enabled = :enabled, email_paused = false RETURNING singleton', { enabled }, transaction);
    await db().AuditLog.create({
      userId: user.id, action: 'UPDATE', entity: 'Settings', entityId: 'admin_alert_email',
      changes: { enabled: { old: previous, new: enabled } },
    }, { transaction });
  });
  return { enabled, paused };
}, true));
router.post('/internal-rules', wrap(async (req, user) => {
  adminOnly(user);
  const { event, config: input } = req.body;
  const config = a.validateConfig(event, input);
  return db().sequelize.transaction(async transaction => {
    const id = randomUUID();
    await a.sql('INSERT INTO admin_alert_rules VALUES (:id,:event,0,CAST(:config AS jsonb)) RETURNING id', { id, event, config: a.json(config) }, transaction);
    return publish({ id, event, version: 0 }, config, user, transaction);
  });
}));
router.put('/internal-rules/:id', wrap((req, user) => db().sequelize.transaction(async transaction => {
  const rule = await ruleById(req.params.id, transaction);
  const config = await permittedConfig(rule, user, req.body.config, transaction);
  if (rule.version !== req.body.version) a.fail('This rule changed. Reload it before publishing.', 409);
  return publish(rule, config, user, transaction);
})));
router.get('/internal-rules/:id/history', wrap(async (req, user) => {
  adminOnly(user);
  const { id } = await ruleById(req.params.id);
  return {
    versions: await a.sql('SELECT * FROM admin_alert_rule_versions WHERE rule_id = :id ORDER BY version DESC LIMIT 100', { id }),
    deliveries: await a.sql(`SELECT id,user_id,version,status,attempts,error,due_at FROM admin_alert_email
      WHERE rule_id = :id ORDER BY due_at DESC LIMIT 100`, { id }),
    delegations: await a.sql('SELECT user_id,fields,audience FROM admin_alert_delegations WHERE rule_id = :id', { id }),
    pending: await a.one(`SELECT count(*)::integer AS count, min(created_at) AS oldest FROM admin_alert_events WHERE rule_versions IS NULL`),
  };
}));
router.post('/internal-rules/:id/restore', wrap((req, user) => {
  adminOnly(user);
  return db().sequelize.transaction(async transaction => {
    const rule = await ruleById(req.params.id, transaction);
    if (rule.version !== req.body.currentVersion) a.fail('This rule changed. Reload it before restoring.', 409);
    const old = await a.one('SELECT config FROM admin_alert_rule_versions WHERE rule_id = :id AND version = :version',
      { id: rule.id, version: a.valid(Joi.number().integer().min(1).required(), req.body.version) }, transaction);
    if (!old) a.fail('Version not found', 404);
    return publish(rule, a.validateConfig(rule.event, old.config), user, transaction);
  });
}));
router.put('/internal-rules/:id/delegations/:userId', wrap(async (req, user) => {
  adminOnly(user);
  const recipient = a.valid(a.uuid.required(), req.params.userId);
  return db().sequelize.transaction(async transaction => {
    const rule = await ruleById(req.params.id, transaction);
    if (!(await a.staff(recipient, transaction)).length) a.fail('Choose an active staff member');
    const fields = a.valid(Joi.array().items(Joi.string().valid(...a.editable)).unique().min(1).required(), req.body.fields);
    const audience = a.valid(a.selectors.required(), req.body.audience);
    if (audience.some(selector => !selector.includes(':') && !a.definition(rule.event).audience.includes(selector))) a.fail('Audience selector does not apply to this event');
    await a.sql(`INSERT INTO admin_alert_delegations VALUES (:id,:user,CAST(:fields AS jsonb),CAST(:audience AS jsonb))
      ON CONFLICT (rule_id,user_id) DO UPDATE SET fields = EXCLUDED.fields, audience = EXCLUDED.audience RETURNING rule_id`,
    { id: rule.id, user: recipient, fields: a.json(fields), audience: a.json(audience) }, transaction);
    return {};
  });
}));
router.delete('/internal-rules/:id/delegations/:userId', wrap(async (req, user) => {
  adminOnly(user);
  const recipient = a.valid(a.uuid.required(), req.params.userId);
  return db().sequelize.transaction(async transaction => {
    const rule = await ruleById(req.params.id, transaction);
    await a.sql('DELETE FROM admin_alert_delegations WHERE rule_id = :id AND user_id = :user RETURNING rule_id', { id: rule.id, user: recipient }, transaction);
    return {};
  });
}));
for (const action of ['preview', 'test']) {
  router.post('/internal-rules/:id/' + action, wrap((req, user) => db().sequelize.transaction(async transaction => {
    const rule = await ruleById(req.params.id, transaction);
    const config = await permittedConfig(rule, user, req.body.config, transaction);
    const example = {
      before: 'pending', after: 'processing', reference: 'EXAMPLE-123', change: 'status',
      status_label: 'Delivered', payment_method: 'cod', request_type: 'Return',
    };
    const sample = Object.fromEntries(a.definition(rule.event).fields.map(field => [field, config.conditions[field] || example[field]]));
    const message = a.render(rule.event, config, sample);
    if (action === 'preview') return message;
    const channel = a.valid(Joi.string().valid('in_app', 'email').required(), req.body.channel);
    if (channel === 'email' && (!await a.emailActive(transaction) || !user.emailVerified)) a.fail('A verified email and internal email delivery are required');
    const id = randomUUID();
    const data = { test: true, userId: user.id, testConfig: { ...config, channels: [channel] } };
    await a.sql(`INSERT INTO admin_alert_events (id,event,data,rule_versions) VALUES (:id,:event,CAST(:data AS jsonb),'[]') RETURNING id`,
      { id, event: rule.event, data: a.json(data) }, transaction);
    await a.queueDelivery(channel === 'email' ? 'admin_alert_email' : 'admin_alert_inbox',
      { id }, { id: rule.id, version: 0 }, user, { ...message, link: '/admin/notifications' }, transaction);
    return { channel };
  })));
}

module.exports = router;
