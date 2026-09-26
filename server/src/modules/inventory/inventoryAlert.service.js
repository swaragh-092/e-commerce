'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../index');
const { PERMISSIONS, getPermissionsForUser } = require('../../config/permissions');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const AuditService = require('../audit/audit.service');
const NotificationService = require('../notification/notification.service');
const {
  normalizeInventoryThreshold,
  getAvailableQuantity,
  getInventoryStatus,
} = require('./inventoryHealth.service');

const {
  InventoryAlert,
  InventoryAlertConfig,
  Product,
  ProductVariant,
  Role,
  Permission,
  Setting,
  User,
} = db;

const INVENTORY_PERMISSION_KEYS = [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_UPDATE];
const INVENTORY_ALERT_TEMPLATE = 'inventory_alert_digest';
const ACTIVE_ALERT_STATES = ['open', 'acknowledged'];

const inventoryRoleInclude = [{
  model: Role,
  as: 'roles',
  attributes: ['id', 'slug', 'name', 'baseRole'],
  through: { attributes: [] },
  include: [{
    model: Permission,
    as: 'permissions',
    attributes: ['id', 'key'],
    through: { attributes: [] },
  }],
}];

const maskEmail = (email) => {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '';
  return `${name[0]}${'*'.repeat(Math.min(Math.max(name.length - 1, 3), 8))}@${domain}`;
};

const parseRecipientList = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));

const getConfig = async (transaction = null) => {
  const [config] = await InventoryAlertConfig.findOrCreate({
    where: { configKey: 'store' },
    defaults: { configKey: 'store' },
    ...(transaction ? { transaction } : {}),
  });
  return config;
};

const getEligibleInventoryUsers = async () => {
  const users = await User.findAll({
    where: { status: 'active', emailVerified: true },
    attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'emailVerified'],
    include: inventoryRoleInclude,
    order: [['firstName', 'ASC'], ['lastName', 'ASC'], ['email', 'ASC']],
  });

  return users.filter((user) => {
    if (user.status !== 'active' || user.emailVerified !== true) return false;
    const roles = user.roles || [];
    const isStaff = user.role === 'admin' || user.role === 'super_admin' || roles.some((role) => {
      if (typeof role === 'string') return ['admin', 'super_admin'].includes(role);
      return ['admin', 'super_admin'].includes(role.baseRole) || ['admin', 'super_admin'].includes(role.slug);
    });
    if (!isStaff) return false;
    const permissions = new Set(getPermissionsForUser(user.toJSON()));
    return INVENTORY_PERMISSION_KEYS.every((permission) => permissions.has(permission));
  });
};

const isSuperAdmin = (user) => user.role === 'super_admin'
  || (user.roles || []).some((role) => role.slug === 'super_admin' || role.baseRole === 'super_admin');

const serializeRecipient = (user) => ({
  id: user.id,
  name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff member',
  email: maskEmail(user.email),
  roles: (user.roles || []).map((role) => role.name || role.slug).filter(Boolean),
});

const getRecipientsForConfig = async (config) => {
  const eligibleUsers = await getEligibleInventoryUsers();
  const byId = new Map(eligibleUsers.map((user) => [user.id, user]));
  const selected = [...new Set(Array.isArray(config.recipientUserIds) ? config.recipientUserIds : [])]
    .map((id) => byId.get(id))
    .filter(Boolean);

  let users = selected;
  let usingFallback = false;
  if (!users.length) {
    users = eligibleUsers.filter(isSuperAdmin);
    usingFallback = true;
  }

  const environmentRecipients = config.includeEnvironmentRecipients
    ? parseRecipientList(process.env.ADMIN_NOTIFICATION_EMAIL).map((email) => ({ id: null, email }))
    : [];
  const seen = new Set();
  const recipients = [...users.map((user) => ({ id: user.id, email: user.email })), ...environmentRecipients]
    .filter((recipient) => {
      const address = String(recipient.email || '').toLowerCase();
      if (!address || seen.has(address)) return false;
      seen.add(address);
      return true;
    });

  return { recipients, users, usingFallback, eligibleUsers };
};

const getRecipientConfig = async () => {
  const config = await getConfig();
  const { users, usingFallback, eligibleUsers } = await getRecipientsForConfig(config);
  const selectedIds = Array.isArray(config.recipientUserIds) ? config.recipientUserIds : [];
  const SettingsService = require('../settings/settings.service');
  const [credentials, messaging] = await Promise.all([
    SettingsService.getByGroup('messaging_credentials', { maskSensitive: false }),
    SettingsService.getByGroup('messaging'),

  ]);
  const emailDeliveryEnabled = !['false', '0', 'no', 'off'].includes(String(messaging.emailEnabled).toLowerCase());
  return {
    config: {
      recipientUserIds: selectedIds,
      timezone: config.timezone,
      digestHour: config.digestHour,
      reminderIntervalDays: config.reminderIntervalDays,
      immediateOutOfStock: config.immediateOutOfStock,
      includeEnvironmentRecipients: config.includeEnvironmentRecipients,
    },
    eligibleRecipients: eligibleUsers.map(serializeRecipient),
    fallbackRecipients: eligibleUsers.filter(isSuperAdmin).map(serializeRecipient),
    selectedRecipientCount: users.length,
    usingFallback,
    invalidSelectedRecipientCount: Math.max(selectedIds.length - eligibleUsers.filter((user) => selectedIds.includes(user.id)).length, 0),
    hasEmailDeliveryConfigured: Boolean(
      emailDeliveryEnabled
      && (credentials.smtp_host || process.env.SMTP_HOST)
      && (credentials.smtp_user || process.env.SMTP_USER)
      && (credentials.smtp_pass || process.env.SMTP_PASS)
    ),
  };
};

const validateTimezone = (timezone) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const saveRecipientConfig = async (input, actor) => {
  const eligibleUsers = await getEligibleInventoryUsers();
  const eligibleIds = new Set(eligibleUsers.map((user) => user.id));
  const recipientUserIds = [...new Set(input.recipientUserIds || [])];
  const invalidIds = recipientUserIds.filter((id) => !eligibleIds.has(id));
  if (invalidIds.length) {
    throw new AppError('VALIDATION_ERROR', 400, 'Recipients must be active, verified staff with product read and update permissions.');
  }
  if (!validateTimezone(input.timezone)) {
    throw new AppError('VALIDATION_ERROR', 400, 'A valid IANA timezone is required.');
  }

  const config = await getConfig();
  const before = {
    recipientUserIds: config.recipientUserIds,
    timezone: config.timezone,
    digestHour: config.digestHour,
    reminderIntervalDays: config.reminderIntervalDays,
    immediateOutOfStock: config.immediateOutOfStock,
    includeEnvironmentRecipients: config.includeEnvironmentRecipients,
  };
  await config.update({
    recipientUserIds,
    timezone: input.timezone,
    digestHour: input.digestHour,
    reminderIntervalDays: input.reminderIntervalDays,
    immediateOutOfStock: input.immediateOutOfStock,
    includeEnvironmentRecipients: input.includeEnvironmentRecipients,
    updatedBy: actor.id,
  });
  await AuditService.log({
    userId: actor.id,
    action: 'UPDATE',
    entity: 'InventoryAlertConfig',
    entityId: config.id,
    changes: {
      recipientUserIds: { old: before.recipientUserIds, new: recipientUserIds },
      timezone: { old: before.timezone, new: input.timezone },
      digestHour: { old: before.digestHour, new: input.digestHour },
      reminderIntervalDays: { old: before.reminderIntervalDays, new: input.reminderIntervalDays },
      immediateOutOfStock: { old: before.immediateOutOfStock, new: input.immediateOutOfStock },
      includeEnvironmentRecipients: { old: before.includeEnvironmentRecipients, new: input.includeEnvironmentRecipients },
    },
  });
  return getRecipientConfig();
};

const testRecipientDelivery = async (actor) => {
  const user = await User.findByPk(actor.id, {
    attributes: ['id', 'email', 'emailVerified', 'status'],
  });
  if (!user || user.status !== 'active' || !user.emailVerified) {
    throw new AppError('VALIDATION_ERROR', 400, 'A verified active staff email is required to send a test.');
  }

  return NotificationService.sendImmediate(
    INVENTORY_ALERT_TEMPLATE,
    user.email,
    {
      isTest: true,
      alert_count: 1,
      out_of_stock_count: 1,
      alerts: [{
        product_name: 'Example product',
        sku: 'TEST-SKU',
        severity: 'out_of_stock',
        status_label: 'Out of stock',
        available_qty: 0,
        threshold: 10,
        product_id: 'test',
      }],
    },
    user.id,
    null,
    'email',
  );
};

const buildInventoryTargets = (products, threshold, now = new Date()) => {
  const normalizedThreshold = normalizeInventoryThreshold(threshold);
  const targets = [];

  for (const product of products || []) {
    if (product.status !== 'published' || product.isEnabled === false) continue;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const tracksVariants = product.type === 'variable' || variants.length > 0;

    if (tracksVariants) {
      for (const variant of variants) {
        if (variant.isActive === false) continue;
        const quantity = Math.max(Number(variant.stockQty) || 0, 0);
        const reservedQty = Math.max(Number(variant.reservedQty) || 0, 0);
        const availableQty = getAvailableQuantity(quantity, reservedQty);
        const status = getInventoryStatus(availableQty, normalizedThreshold);
        if (status === 'healthy') continue;
        targets.push({
          inventoryKey: `variant:${variant.id}`,
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          sku: variant.sku || product.sku || '',
          quantity,
          reservedQty,
          availableQty,
          threshold: normalizedThreshold,
          severity: status,
          detectedAt: now,
        });
      }
      continue;
    }

    const quantity = Math.max(Number(product.quantity) || 0, 0);
    const reservedQty = Math.max(Number(product.reservedQty) || 0, 0);
    const availableQty = getAvailableQuantity(quantity, reservedQty);
    const status = getInventoryStatus(availableQty, normalizedThreshold);
    if (status === 'healthy') continue;
    targets.push({
      inventoryKey: `product:${product.id}`,
      productId: product.id,
      variantId: null,
      productName: product.name,
      sku: product.sku || '',
      quantity,
      reservedQty,
      availableQty,
      threshold: normalizedThreshold,
      severity: status,
      detectedAt: now,
    });
  }

  return targets;
};

const getCurrentTargets = async (threshold) => {
  const products = await Product.findAll({
    attributes: ['id', 'name', 'sku', 'type', 'quantity', 'reservedQty', 'status', 'isEnabled'],
    where: { status: 'published', isEnabled: true },
    include: [{
      model: ProductVariant,
      as: 'variants',
      attributes: ['id', 'sku', 'stockQty', 'reservedQty', 'isActive'],
      required: false,
    }],
  });
  return buildInventoryTargets(products.map((product) => product.toJSON()), threshold);
};

const getConfiguredThreshold = async () => {
  const setting = await Setting.findOne({ where: { group: 'catalog', key: 'lowStockThreshold' } });
  return normalizeInventoryThreshold(setting?.value);
};

const synchronizeInventoryAlerts = async ({ now = new Date() } = {}) => {
  const threshold = await getConfiguredThreshold();
  const targets = await getCurrentTargets(threshold);
  const currentKeys = new Set(targets.map((target) => target.inventoryKey));
  const newlyOutOfStock = [];

  await db.sequelize.transaction(async (transaction) => {
    const existingRows = await InventoryAlert.findAll({
      where: {
        [Op.or]: [
          { status: { [Op.in]: ACTIVE_ALERT_STATES } },
          ...(currentKeys.size ? [{ inventoryKey: { [Op.in]: [...currentKeys] } }] : []),
        ],
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const byKey = new Map(existingRows.map((row) => [row.inventoryKey, row]));

    for (const target of targets) {
      const row = byKey.get(target.inventoryKey);
      if (!row) {
        const created = await InventoryAlert.create({
          ...target,
          firstDetectedAt: now,
          lastDetectedAt: now,
          status: 'open',
        }, { transaction });
        if (target.severity === 'out_of_stock') newlyOutOfStock.push({ ...target, id: created.id });
        continue;
      }

      if (row.status === 'resolved') {
        await row.update({
          ...target,
          status: 'open',
          firstDetectedAt: now,
          lastDetectedAt: now,
          lastNotifiedAt: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
          resolvedAt: null,
        }, { transaction });
        if (target.severity === 'out_of_stock') newlyOutOfStock.push({ ...target, id: row.id });
        byKey.delete(target.inventoryKey);
        continue;
      }

      const worsened = row.severity === 'low_stock' && target.severity === 'out_of_stock';
      await row.update({
        severity: target.severity,
        quantity: target.quantity,
        reservedQty: target.reservedQty,
        availableQty: target.availableQty,
        threshold: target.threshold,
        lastDetectedAt: now,
        ...(worsened ? {
          status: 'open',
          acknowledgedBy: null,
          acknowledgedAt: null,
          resolvedAt: null,
        } : {}),
      }, { transaction });
      if (worsened) newlyOutOfStock.push({ ...target, id: row.id });
      byKey.delete(target.inventoryKey);
    }

    for (const [inventoryKey, row] of byKey) {
      if (currentKeys.has(inventoryKey)) continue;
      if (row.status === 'resolved') continue;
      await row.update({ status: 'resolved', resolvedAt: now, lastDetectedAt: now }, { transaction });
    }

    // Previously resolved items that have become at-risk are re-opened.
    const resolvedRows = await InventoryAlert.findAll({
      where: { inventoryKey: { [Op.in]: [...currentKeys] }, status: 'resolved' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    for (const row of resolvedRows) {
      const target = targets.find((item) => item.inventoryKey === row.inventoryKey);
      if (!target) continue;
      await row.update({
        ...target,
        status: 'open',
        firstDetectedAt: now,
        lastDetectedAt: now,
        lastNotifiedAt: null,
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolvedAt: null,
      }, { transaction });
      if (target.severity === 'out_of_stock') newlyOutOfStock.push({ ...target, id: row.id });
    }
  });

  return { threshold, targets, newlyOutOfStock };
};

const alertIncludes = [
  { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
  { model: ProductVariant, as: 'variant', attributes: ['id', 'sku'] },
  { model: User, as: 'assignee', attributes: ['id', 'firstName', 'lastName'] },
  { model: User, as: 'acknowledger', attributes: ['id', 'firstName', 'lastName'] },
];

const listActiveAlerts = async ({ synchronize = true, limit = 200 } = {}) => {
  if (synchronize) await synchronizeInventoryAlerts();
  const query = {
    where: { status: { [Op.in]: ACTIVE_ALERT_STATES } },
    include: alertIncludes,
    order: [
      ['severity', 'DESC'],
      ['availableQty', 'ASC'],
      ['lastDetectedAt', 'ASC'],
    ],
  };
  if (limit !== null) query.limit = limit;
  const rows = await InventoryAlert.findAll(query);
  return rows.map((row) => row.toJSON());
};

const updateAlertOwnership = async (alertId, input, actor) => {
  const alert = await InventoryAlert.findByPk(alertId);
  if (!alert) throw new AppError('NOT_FOUND', 404, 'Inventory alert not found.');
  if (alert.status === 'resolved') throw new AppError('CONFLICT', 409, 'Resolved inventory alerts cannot be assigned.');

  const eligibleUsers = await getEligibleInventoryUsers();
  const eligibleById = new Map(eligibleUsers.map((user) => [user.id, user]));
  const assignedTo = input.assignedTo === undefined ? alert.assignedTo : input.assignedTo;
  if (assignedTo && !eligibleById.has(assignedTo)) {
    throw new AppError('VALIDATION_ERROR', 400, 'The assignee must be active, verified staff with product read and update permissions.');
  }

  let status = input.status || alert.status;
  if (status === 'acknowledged' && !assignedTo) {
    if (!eligibleById.has(actor.id)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Choose an eligible inventory owner before acknowledging this alert.');
    }
  }
  const finalAssignee = status === 'acknowledged' ? (assignedTo || actor.id) : assignedTo;
  const before = {
    status: alert.status,
    assignedTo: alert.assignedTo,
    note: alert.note,
    expectedRestockAt: alert.expectedRestockAt,
  };
  const changes = {
    status,
    assignedTo: finalAssignee,
    note: input.note === undefined ? alert.note : input.note.trim(),
    expectedRestockAt: input.expectedRestockAt === undefined ? alert.expectedRestockAt : input.expectedRestockAt,
    ...(status === 'acknowledged' && alert.status !== 'acknowledged'
      ? { acknowledgedBy: actor.id, acknowledgedAt: new Date() }
      : {}),
    ...(status === 'open' ? { acknowledgedBy: null, acknowledgedAt: null } : {}),
  };
  await alert.update(changes);
  await AuditService.log({
    userId: actor.id,
    action: 'UPDATE',
    entity: 'InventoryAlert',
    entityId: alert.id,
    changes: {
      status: { old: before.status, new: changes.status },
      assignedTo: { old: before.assignedTo, new: changes.assignedTo },
      noteChanged: { old: Boolean(before.note), new: Boolean(changes.note) },
      expectedRestockAt: { old: before.expectedRestockAt, new: changes.expectedRestockAt },
    },
  });
  await alert.reload({ include: alertIncludes });
  return alert.toJSON();
};

const getLocalTimeParts = (date, timezone) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

const digestAlertVariables = (alerts, isTest = false) => ({
  isTest,
  alert_count: alerts.length,
  out_of_stock_count: alerts.filter((alert) => alert.severity === 'out_of_stock').length,
  alerts: alerts.map((alert) => ({
    product_id: alert.productId,
    product_name: alert.productName || alert.product?.name || 'Product',
    sku: alert.sku || alert.variant?.sku || alert.product?.sku || '',
    severity: alert.severity,
    status_label: alert.severity === 'out_of_stock' ? 'Out of stock' : 'Low stock',
    available_qty: alert.availableQty,
    threshold: alert.threshold,
  })),
});

const recipientDedupeId = ({ id, email }) => id || crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

const sendAlertToRecipients = async ({ recipients, variables, dedupePrefix, now }) => {
  const sentRecipients = [];
  for (const recipient of recipients) {
    const dedupeKey = `${dedupePrefix}:${recipientDedupeId(recipient)}`.slice(0, 255);
    const queued = await NotificationService.sendOnce(
      INVENTORY_ALERT_TEMPLATE,
      recipient.email,
      variables,
      recipient.id || null,
      null,
      'email',
      dedupeKey,
    );
    if (queued) sentRecipients.push(recipient);
  }
  return sentRecipients;
};

const runAlertCycle = async ({ now = new Date() } = {}) => {
  const { threshold, newlyOutOfStock } = await synchronizeInventoryAlerts({ now });
  const config = await getConfig();
  const { recipients } = await getRecipientsForConfig(config);
  if (!recipients.length) {
    // The dashboard remains usable; logging makes an email-routing failure visible to operators.
    logger.warn('[inventoryAlert] No eligible recipient configured; inventory alerts were not queued.');
    return { queued: 0, reason: 'no_recipients' };
  }

  let queued = 0;
  if (config.immediateOutOfStock && newlyOutOfStock.length) {
    const immediateAlerts = newlyOutOfStock;
    const sent = await sendAlertToRecipients({
      recipients,
      variables: digestAlertVariables(immediateAlerts),
      dedupePrefix: `inventory-out:${now.toISOString()}`,
      now,
    });
    queued += sent.length;
    if (sent.length) {
      await InventoryAlert.update(
        { lastNotifiedAt: now },
        { where: { id: { [Op.in]: newlyOutOfStock.map((row) => row.id) } } },
      );
    }
  }

  let localTime;
  try {
    localTime = getLocalTimeParts(now, config.timezone);
  } catch {
    localTime = getLocalTimeParts(now, 'Asia/Kolkata');
  }
  if (Number(localTime.hour) !== Number(config.digestHour) || Number(localTime.minute) !== 0) {
    return { queued, reason: 'outside_digest_window' };
  }

  const reminderMs = Number(config.reminderIntervalDays || 1) * 24 * 60 * 60 * 1000;
  const alerts = await listActiveAlerts({ synchronize: false, limit: null });
  const dueAlerts = alerts.filter((alert) => (
    !alert.lastNotifiedAt || now.getTime() - new Date(alert.lastNotifiedAt).getTime() >= reminderMs
  ));
  if (!dueAlerts.length) return { queued, reason: 'no_due_alerts' };

  const dateKey = `${localTime.year}-${localTime.month}-${localTime.day}`;
  const sent = await sendAlertToRecipients({
    recipients,
    variables: digestAlertVariables(dueAlerts),
    dedupePrefix: `inventory-digest:${dateKey}`,
    now,
  });
  queued += sent.length;
  if (sent.length) {
    await InventoryAlert.update(
      { lastNotifiedAt: now },
      { where: { id: { [Op.in]: dueAlerts.map((alert) => alert.id) } } },
    );
  }
  return { queued, reason: sent.length ? 'digest_queued' : 'already_queued' };
};

const getDashboardAlertData = async () => {
  const rows = await listActiveAlerts();
  const [eligibleUsers, lowStockCount, outOfStockCount] = await Promise.all([
    getEligibleInventoryUsers(),
    InventoryAlert.count({
      where: { status: { [Op.in]: ACTIVE_ALERT_STATES }, severity: 'low_stock' },
    }),
    InventoryAlert.count({
      where: { status: { [Op.in]: ACTIVE_ALERT_STATES }, severity: 'out_of_stock' },
    }),
  ]);
  return {
    rows,
    eligibleAssignees: eligibleUsers.map((user) => ({
      id: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff member',
    })),
    totalCount: lowStockCount + outOfStockCount,
    lowStockCount,
    outOfStockCount,
  };
};
module.exports = {
  ACTIVE_ALERT_STATES,
  INVENTORY_PERMISSION_KEYS,
  maskEmail,
  buildInventoryTargets,
  getEligibleInventoryUsers,
  getRecipientConfig,
  saveRecipientConfig,
  testRecipientDelivery,
  synchronizeInventoryAlerts,
  listActiveAlerts,
  updateAlertOwnership,
  getDashboardAlertData,
  runAlertCycle,
  getLocalTimeParts,
};
