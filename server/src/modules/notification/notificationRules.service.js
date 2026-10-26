'use strict';

const { createHash, randomUUID } = require('crypto');
const Joi = require('joi');
const handlebars = require('handlebars');
const { Op } = require('sequelize');
const { Setting, User, UserProfile, Role, Order, OrderItem, Enquiry, NotificationTemplate, NotificationQueue } = require('../index');
const { DEFAULTS, SAMPLE_VARIABLES } = require('./notification.defaults');
const { EVENTS, findEvent, eventForTemplate } = require('./notification.events');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const PREFIX = 'notificationRules_';
const CHANNELS = ['email', 'sms', 'whatsapp'];
const META = '__notificationRule';
const optionsFor = (transaction) => transaction ? { transaction } : {};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const storeContacts = () => [
  ...String(process.env.ADMIN_NOTIFICATION_EMAIL || '').split(',').filter(value => value.trim()).map(email => ({ name: 'Store contact', email: email.trim(), phone: '' })),
  ...String(process.env.ADMIN_NOTIFICATION_PHONE || '').split(',').filter(value => value.trim()).map(phone => ({ name: 'Store contact', email: '', phone: phone.trim() })),
];
const requireEvent = (key) => {
  const event = findEvent(key);
  if (!event) throw new AppError('NOT_FOUND', 404, 'Notification event not found');
  return event;
};
const configFor = async (key, transaction) => {
  const row = await Setting.findOne({ where: { group: 'messaging', key: PREFIX + key }, ...optionsFor(transaction) });
  return row?.value?.version === 1 && Array.isArray(row.value.rules) ? row.value : null;
};

const recipientOptions = async (transaction) => {
  const [users, roles] = await Promise.all([
    User.findAll({
      where: { status: 'active', role: { [Op.ne]: 'customer' } },
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'emailVerified'],
      include: [{ model: UserProfile, as: 'profile', required: false }, { model: Role, as: 'roles', through: { attributes: [] }, required: false }],
      order: [['firstName', 'ASC']], ...optionsFor(transaction),
    }),
    Role.findAll({ where: { isActive: true, baseRole: { [Op.ne]: 'customer' } }, order: [['name', 'ASC']], ...optionsFor(transaction) }),
  ]);
  return {
    users: users.map(user => ({ id: user.id, name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      email: user.email, phone: user.profile?.phone || '', emailVerified: user.emailVerified,
      isStoreAdmin: user.roles?.length ? user.roles.some(role => role.isActive && ['admin', 'super_admin'].includes(role.slug)) : ['admin', 'super_admin'].includes(user.role),
      role: user.role, roleIds: (user.roles || []).filter(role => role.isActive && role.baseRole !== 'customer').map(role => role.id) })),
    roles: roles.map(role => ({ id: role.id, name: role.name, slug: role.slug })),
  };
};

const defaultRules = async (event) => {
  const templates = await NotificationTemplate.findAll({ where: { name: { [Op.in]: [event.customerTemplate, event.internalTemplate].filter(Boolean) } } });
  const configured = event.internalTemplate ? await require('./notificationRecipients.service').getConfiguredRecipients(event.internalTemplate) : null;
  const messaging = event.key === 'enquiry_received' ? await require('../settings/settings.service').getByGroup('messaging') : {};
  const acknowledgementDisabled = [false, 'false'].includes(messaging.enquiryCustomerAcknowledgementEnabled);
  const rules = [[event.customerTemplate, 'customer', 'Customer confirmation'], [event.internalTemplate, 'internal', 'Admin alert']]
    .filter(([name]) => name).map(([name, audience, label]) => {
      const matches = templates.filter(template => template.name === name);
      const activeChannels = matches.filter(template => template.isActive && event.defaultChannels.includes(template.channel)).map(template => template.channel);
      const messages = Object.fromEntries(CHANNELS.map(channel => {
        const saved = matches.find(template => template.channel === channel);
        const base = saved || DEFAULTS[name] || {};
        return [channel, { subject: base.subject || event.label, bodyHtml: channel === 'email' ? base.bodyHtml || '' : '', bodyText: base.bodyText || '' }];
      }));
      return {
        id: randomUUID(), name: audience === 'internal' ? label : event.key === 'order_placed' ? 'Customer confirmation' : event.key === 'enquiry_received' ? 'Customer acknowledgement' : event.key === 'enquiry_replied' ? 'Customer reply' : 'Customer update',
        audience, isActive: activeChannels.length > 0 && !(audience === 'internal' && configured?.length === 0) && !(audience === 'customer' && acknowledgementDisabled),
        channels: activeChannels,
        recipients: { defaultAdmins: audience === 'internal' && configured === null,
          userIds: audience === 'internal' && configured ? configured.map(user => user.id) : [], roleIds: [], contacts: audience === 'internal' && configured === null ? storeContacts() : [] }, messages,
      };
    });
  // Existing email recipient overrides never applied to SMS or WhatsApp. Keep those audiences separate on import.
  const internal = rules.find(rule => rule.audience === 'internal');
  if (internal && configured !== null) {
    const mobileChannels = internal.channels.filter(channel => channel !== 'email');
    internal.channels = internal.channels.filter(channel => channel === 'email');
    internal.isActive = internal.isActive && internal.channels.length > 0;
    if (mobileChannels.length) rules.push({ ...internal, id: randomUUID(), name: 'Admin mobile alerts', isActive: true,
      channels: mobileChannels, recipients: { defaultAdmins: true, userIds: [], roleIds: [], contacts: storeContacts().filter(contact => contact.phone) } });
  }
  return rules;
};

const list = async () => {
  const rows = await Setting.findAll({ where: { group: 'messaging', key: { [Op.like]: PREFIX + '%' } } });
  return EVENTS.map(event => {
    const config = rows.find(row => row.key === PREFIX + event.key)?.value;
    return { ...event, managed: config?.version === 1, notificationCount: config?.rules?.length || 0 };
  });
};
const read = async (key) => {
  const event = requireEvent(key);
  const config = await configFor(key);
  return { event, managed: Boolean(config), revision: config?.revision || null, rules: config?.rules || await defaultRules(event) };
};

const messageSchema = Joi.object({ subject: Joi.string().max(500).allow('').default(''), bodyHtml: Joi.string().max(150000).allow('').default(''), bodyText: Joi.string().max(50000).allow('').default('') });
const ruleSchema = Joi.object({
  id: Joi.string().uuid().required(), name: Joi.string().trim().min(1).max(100).required(),
  audience: Joi.string().valid('customer', 'internal', 'mixed').required(), isActive: Joi.boolean().required(),
  separateRuleIds: Joi.array().items(Joi.string().uuid()).unique().max(29).default([]),
  channels: Joi.array().items(Joi.string().valid(...CHANNELS)).unique().max(3).required(),
  recipients: Joi.object({
    defaultAdmins: Joi.boolean().default(false), userIds: Joi.array().items(Joi.string().uuid()).unique().max(100).default([]),
    roleIds: Joi.array().items(Joi.string().uuid()).unique().max(100).default([]),
    contacts: Joi.array().items(Joi.object({ name: Joi.string().trim().max(100).allow('').default(''),
      email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).allow('').default(''),
      phone: Joi.string().trim().pattern(/^\+[1-9]\d{6,14}$/).allow('').default(''),
    }).or('email', 'phone')).max(100).default([]),
  }).required(),
  messages: Joi.object(Object.fromEntries(CHANNELS.map(channel => [channel, messageSchema.required()]))).required(),
});
const validate = async (input) => {
  const { value, error } = Joi.object({ revision: Joi.string().allow(null).required(), rules: Joi.array().items(ruleSchema).unique('id').max(30).required() }).validate(input);
  if (error) {
    const detail = error.details[0];
    const name = input?.rules?.[detail.path[1]]?.name || 'Notification';
    const field = detail.path[detail.path.length - 1];
    const explanation = field === 'phone' ? 'enter phone numbers with a country code, such as +919876543210'
      : field === 'email' ? 'enter a valid email address'
        : field === 'name' ? 'use a name between 1 and 100 characters'
          : detail.path.includes('messages') ? 'check the message content and its length'
            : 'check the recipients and selected channels, then try again';
    throw new AppError('VALIDATION_ERROR', 400, `${name}: ${explanation}`);
  }
  const options = await recipientOptions();
  // A shared message can delegate recipients to separate messages. Reject dangling links and cycles.
  const byId = new Map(value.rules.map(rule => [rule.id, rule]));
  const checked = new Set();
  const visit = (rule, path = new Set()) => {
    if (path.has(rule.id)) throw new AppError('VALIDATION_ERROR', 400, 'Separate messages cannot refer back to each other');
    if (checked.has(rule.id)) return;
    const nextPath = new Set([...path, rule.id]);
    for (const id of rule.separateRuleIds) {
      if (!byId.has(id)) throw new AppError('VALIDATION_ERROR', 400, 'A separate message was removed. Reload and review the recipients.');
      visit(byId.get(id), nextPath);
    }
    checked.add(rule.id);
  };
  value.rules.forEach(rule => visit(rule));
  for (const rule of value.rules) {
    const recipients = rule.recipients;
    if (rule.audience === 'customer' && (recipients.defaultAdmins || recipients.userIds.length || recipients.roleIds.length || recipients.contacts.length)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Customer notifications can only go to the customer involved in the event');
    }
    if (recipients.userIds.some(id => !options.users.some(user => user.id === id)) || recipients.roleIds.some(id => !options.roles.some(role => role.id === id))) {
      throw new AppError('VALIDATION_ERROR', 400, 'Choose active people and roles; customers cannot be selected as internal recipients');
    }
    if (recipients.contacts.some(contact => !contact.email && !contact.phone)) throw new AppError('VALIDATION_ERROR', 400, 'Each additional contact needs an email address or phone number');
    if (rule.isActive && !rule.channels.length) throw new AppError('VALIDATION_ERROR', 400, `${rule.name}: select at least one channel`);
    if (rule.isActive && rule.audience === 'internal' && !recipients.defaultAdmins && !recipients.userIds.length && !recipients.roleIds.length && !recipients.contacts.length) {
      throw new AppError('VALIDATION_ERROR', 400, `${rule.name}: select at least one recipient`);
    }
    for (const channel of rule.channels) {
      const message = rule.messages[channel];
      if (rule.isActive && (channel === 'email' ? !message.subject.trim() || (!message.bodyHtml.trim() && !message.bodyText.trim()) : !message.bodyText.trim())) {
        throw new AppError('VALIDATION_ERROR', 400, `${rule.name}: complete the ${channel} message`);
      }
      try { for (const text of Object.values(message)) handlebars.precompile(text); }
      catch (_) { throw new AppError('VALIDATION_ERROR', 400, `${rule.name}: check your message variables and template syntax`); }
    }
  }
  return value;
};
const save = async (key, input, actor) => {
  requireEvent(key);
  const value = await validate(input);
  const { sequelize } = require('../index');
  await sequelize.transaction(async transaction => {
    // Serialize updates to this event, including its first save, without locking other events.
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: PREFIX + key }, transaction });
    const current = await configFor(key, transaction);
    if ((current?.revision || null) !== value.revision) throw new AppError('CONFLICT', 409, 'These notifications were updated by someone else. Reload before saving.');
    const config = { version: 1, revision: randomUUID(), rules: value.rules };
    await Setting.upsert({ group: 'messaging', key: PREFIX + key, value: config, updatedBy: actor.id }, { transaction });
    await require('../audit/audit.service').log({ userId: actor.id, action: 'UPDATE', entity: 'Setting', entityId: PREFIX + key,
      changes: { event: key, notifications: value.rules.map(rule => ({ id: rule.id, name: rule.name, audience: rule.audience, channels: rule.channels, isActive: rule.isActive })) } }, transaction);
  });
  return read(key);
};

const customerContext = async ({ event, orderId, variables, transaction, customer }) => {
  const context = { variables: { ...variables }, customer: null, occurrence: null, order: null };
  if (orderId) {
    const order = await Order.findByPk(orderId, { include: [{ model: OrderItem, as: 'items' }], ...optionsFor(transaction) });
    if (!order) return context;
    context.order = order;
    const user = order.userId ? await User.findByPk(order.userId, { include: [{ model: UserProfile, as: 'profile', required: false }], ...optionsFor(transaction) }) : null;
    const address = order.shippingAddressSnapshot || {};
    context.customer = { id: user?.id || null, name: `${user?.firstName || address.firstName || ''} ${user?.lastName || address.lastName || ''}`.trim() || address.name || 'Customer',
      email: address.email || user?.email || '', phone: address.phone || user?.profile?.phone || '' };
    context.variables = { order_number: order.orderNumber, order_id: order.id, order_date: order.createdAt,
      order_total: order.total, order_subtotal: order.subtotal, shipping_total: order.shippingCost, tax_total: order.tax,
      discount_total: order.discountAmount, payment_method: order.paymentMethod,
      items: (order.items || []).map(item => ({ name: item.snapshotName, quantity: item.quantity, price: item.snapshotPrice, total: item.total, sku: item.snapshotSku })), ...variables };
    context.occurrence = [order.id, variables.notification_event_id || '', variables.tracking_number || '', variables.status_label || '', variables.return_id || '', variables.refund_id || '', variables.request_type || ''];
  } else if (variables.enquiry_id || variables.enquiryId) {
    const enquiry = await Enquiry.findByPk(variables.enquiry_id || variables.enquiryId, optionsFor(transaction));
    if (enquiry) {
      context.customer = { id: null, name: enquiry.name, email: enquiry.email, phone: enquiry.phone || '' };
      context.variables.enquiry_id = enquiry.id;
      context.occurrence = [enquiry.id, variables.notification_event_id || variables.replyMessage || ''];
    }
  }
  // Only explicit customer call sites may provide a fallback; admin recipients are never inferred as customers.
  if (!context.customer && !orderId && customer) context.customer = customer;
  if (context.customer) Object.assign(context.variables, { customer_name: context.customer.name, customer_email: context.customer.email,
    customer_phone: context.customer.phone, customerName: context.customer.name, customerEmail: context.customer.email, customerPhone: context.customer.phone });
  const paymentMethods = { cod: 'Cash on Delivery', razorpay: 'Razorpay', stripe: 'Stripe', payu: 'PayU', cashfree: 'Cashfree' };
  if (paymentMethods[context.variables.payment_method]) context.variables.payment_method = paymentMethods[context.variables.payment_method];
  return context;
};

const internalRecipients = async (rule, event, options, transaction) => {
  const selection = rule.recipients;
  const ids = new Set(selection.userIds);
  const roleIds = new Set(selection.roleIds);
  let recipients = options.users.filter(user => ids.has(user.id) || user.roleIds.some(id => roleIds.has(id)));
  if (selection.defaultAdmins) {
      recipients.push(...options.users.filter(user => user.isStoreAdmin));
  }
  return recipients.concat(selection.contacts);
};

const includesCustomer = rule => ['customer', 'mixed'].includes(rule.audience);
const normalizeAddress = (recipient, channel) => channel === 'email'
  ? (recipient.email || '').trim().toLowerCase()
  : (recipient.phone || '').replace(/^whatsapp:/, '').replace(/[\s()-]/g, '');
const selectedRecipients = async (rule, context, options) => [
  ...(includesCustomer(rule) && context.customer ? [{ ...context.customer, audience: 'customer' }] : []),
  ...(rule.audience !== 'customer' ? (await internalRecipients(rule, null, options)).map(recipient => ({ ...recipient, audience: 'internal' })) : []),
];
const isSameRecipient = (a, b, channel) => (a.id && b.id && a.id === b.id)
  || Boolean(normalizeAddress(a, channel) && normalizeAddress(a, channel) === normalizeAddress(b, channel));
const recipientsForRules = async (rules, context, options) => new Map(await Promise.all(rules.map(async rule => [rule.id, await selectedRecipients(rule, context, options)])));
const delegatedRecipients = (rule, selections) => (rule.separateRuleIds || []).flatMap(id => selections.get(id) || []);

// null means the event still uses its existing delivery behavior; [] means explicitly disabled.
const route = async ({ sourceTemplate, variables = {}, orderId = null, transaction = null, customer = null }) => {
  const event = eventForTemplate(sourceTemplate);
  if (!event) return null;
  const config = await configFor(event.key, transaction);
  if (!config) return null;
  const rules = config.rules.filter(rule => rule.isActive);
  if (!rules.length) return [];
  const context = await customerContext({ event, variables, orderId, transaction, customer });
  // Unknown customer context must never result in a broadcast to unrelated customers.
  if (!context.occurrence) context.occurrence = variables.notification_event_id || hash([variables, customer?.id || customer?.email || '']);
  const options = config.rules.some(rule => rule.audience !== 'customer') ? await recipientOptions(transaction) : null;
  const selections = await recipientsForRules(config.rules, context, options);
  const results = [];
  for (const rule of rules) {
    // Timing belongs to the recipient, including when one message has both audiences.
    const recipients = selections.get(rule.id).filter(recipient => {
      if (event.key !== 'order_placed') return true;
      return recipient.audience === 'customer'
        ? sourceTemplate !== 'admin_new_order' || context.order?.paymentMethod === 'cod'
        : sourceTemplate !== 'order_placed';
    });
    const delegated = delegatedRecipients(rule, selections);
    for (const channel of rule.channels) {
      const seen = new Set();
      for (const recipient of recipients) {
        if (delegated.some(other => isSameRecipient(recipient, other, channel))) continue;
        const normalized = normalizeAddress(recipient, channel);
        const identity = normalized || recipient.id || hash(recipient);
        if (seen.has(identity)) continue;
        seen.add(identity);
        const messageVariables = Object.fromEntries(Object.entries(context.variables).filter(([key]) => event.variables.includes(key)));
        messageVariables.recipient_name = recipient.name || recipient.email || 'there';
        const meta = { eventKey: event.key, ruleId: rule.id, ruleName: rule.name, audience: recipient.audience, message: rule.messages[channel] };
        const missing = !normalized;
        const invalidPhone = channel !== 'email' && normalized && !/^\+[1-9]\d{6,14}$/.test(normalized);
        const skipReason = missing ? `Recipient has no ${channel === 'email' ? 'email address' : 'phone number'}` : invalidPhone ? 'Recipient needs a phone number with a country code' : null;
        try {
          const [job, created] = await NotificationQueue.findOrCreate({
            where: { dedupeKey: 'rule:' + hash([event.key, context.occurrence, rule.id, channel, identity]) },
            defaults: { templateName: `rule_${event.key}_${rule.id}`, channel,
              recipientEmail: channel === 'email' ? normalized || null : null, recipientPhone: channel !== 'email' ? normalized || null : null,
              userId: recipient.id || null, orderId, variables: { ...messageVariables, [META]: meta },
              status: skipReason ? 'skipped' : 'queued', error: skipReason,
              nextAttemptAt: skipReason ? null : new Date() }, ...optionsFor(transaction),
          });
          results.push(created ? !skipReason : ['queued', 'processing', 'sent'].includes(job.status));
        } catch (error) { logger.error('Could not queue notification rule', { event: event.key, rule: rule.id, error: error.message }); results.push(false); }
      }
    }
  }
  return results;
};

const canDeliver = async (job) => {
  const meta = job.variables?.[META];
  if (!meta) return true;
  const config = await configFor(meta.eventKey);
  const rule = config?.rules.find(rule => rule.id === meta.ruleId && rule.isActive && rule.channels.includes(job.channel));
  if (!rule || (meta.audience === 'customer' ? !includesCustomer(rule) : rule.audience === 'customer')) return false;
  const event = requireEvent(meta.eventKey);
  const context = await customerContext({ event, orderId: job.orderId, variables: job.variables, customer: meta.audience === 'customer'
    ? { id: job.userId, email: job.recipientEmail, phone: job.recipientPhone } : null });
  const options = config.rules.some(item => item.audience !== 'customer') ? await recipientOptions() : null;
  const selections = await recipientsForRules(config.rules, context, options);
  const queued = { id: job.userId, email: job.recipientEmail, phone: job.recipientPhone };
  if (delegatedRecipients(rule, selections).some(recipient => isSameRecipient(recipient, queued, job.channel))) return false;
  const eligible = selections.get(rule.id).some(recipient => recipient.audience === meta.audience
    && normalizeAddress(recipient, job.channel) === normalizeAddress(queued, job.channel) && (!job.userId || recipient.id === job.userId));
  return eligible && (meta.audience !== 'customer' || !job.userId || Boolean(await User.findOne({ where: { id: job.userId, status: 'active' } })));
};
const history = async (key) => {
  requireEvent(key);
  const jobs = await NotificationQueue.findAll({ where: { templateName: { [Op.like]: `rule_${key}_%` } }, order: [['createdAt', 'DESC']], limit: 100 });
  return jobs.map(job => ({ id: job.id, name: job.variables?.[META]?.ruleName || 'Notification',
    recipient: job.recipientEmail || job.recipientPhone || 'Missing contact details', channel: job.channel,
    status: job.status, error: job.error, createdAt: job.createdAt, sentAt: job.sentAt, attempts: job.attempts }));
};
const preview = async (key, message) => {
  const event = requireEvent(key);
  const { value, error } = messageSchema.required().validate(message);
  if (error) throw new AppError('VALIDATION_ERROR', 400, error.message);
  try { for (const text of Object.values(value)) handlebars.precompile(text); }
  catch (_) { throw new AppError('VALIDATION_ERROR', 400, 'Check the message template syntax'); }
  const sample = Object.fromEntries(Object.entries(SAMPLE_VARIABLES).filter(([name]) => event.variables.includes(name)));
  return require('./notification.service').compileTemplate(value, { ...sample, recipient_name: 'Alex', customer_phone: '+15551234567' });
};

module.exports = { PREFIX, META, list, read, save, validate, recipientOptions, route, canDeliver, history, preview };
