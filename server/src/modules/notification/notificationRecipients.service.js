'use strict';

const { User, UserProfile, Role, Permission, Setting } = require('../index');
const { getPermissionsForUser, PERMISSIONS } = require('../../config/permissions');
const AppError = require('../../utils/AppError');

const CATEGORIES = {
  orders: { label: 'Order alerts', permission: PERMISSIONS.ORDERS_READ, templates: ['admin_new_order', 'admin_order_cancelled'] },
  payments: { label: 'Payment failures', permission: PERMISSIONS.ORDERS_READ, templates: ['admin_order_failed'] },
  returns: { label: 'Returns and replacements', permission: PERMISSIONS.ORDERS_READ, templates: ['admin_return_requested'] },
  enquiries: { label: 'Customer enquiries', permission: PERMISSIONS.ENQUIRIES_READ, templates: ['new_enquiry_admin'] },
};

const getEligibleUsers = async (transaction = null) => {
  const users = await User.findAll({
    where: { status: 'active', emailVerified: true },
    attributes: ['id', 'email', 'firstName', 'lastName', 'role'],
    include: [
      { model: UserProfile, as: 'profile', required: false },
      { model: Role, as: 'roles', through: { attributes: [] }, include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }] },
    ],
    transaction: transaction || undefined,
  });
  return users.filter((user) => Object.values(CATEGORIES).some((category) => getPermissionsForUser(user.toJSON()).includes(category.permission)));
};

const getConfig = async (transaction = null) => {
  const setting = await Setting.findOne({ where: { group: 'messaging', key: 'eventRecipientUserIds' }, transaction: transaction || undefined });
  return setting?.value && typeof setting.value === 'object' ? setting.value : {};
};

// null means use the existing admin defaults; [] deliberately disables this category.
const getConfiguredRecipients = async (templateName, transaction = null) => {
  const entry = Object.entries(CATEGORIES).find(([, category]) => category.templates.includes(templateName));
  if (!entry) return null;
  const [key, category] = entry;
  const config = await getConfig(transaction);
  if (!Array.isArray(config[key])) return null;
  const ids = new Set(config[key]);
  const users = await getEligibleUsers(transaction);
  return users.filter((user) => ids.has(user.id) && getPermissionsForUser(user.toJSON()).includes(category.permission));
};

const read = async () => {
  const [config, users] = await Promise.all([getConfig(), getEligibleUsers()]);
  return {
    categories: Object.entries(CATEGORIES).map(([key, category]) => ({ key, label: category.label, recipientUserIds: Array.isArray(config[key]) ? config[key] : null })),
    users: users.map((user) => ({
      id: user.id, email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      categories: Object.entries(CATEGORIES).filter(([, category]) => getPermissionsForUser(user.toJSON()).includes(category.permission)).map(([key]) => key),
    })),
  };
};

const update = async (input, actor) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('VALIDATION_ERROR', 400, 'Recipient settings must be an object');
  const users = await getEligibleUsers();
  const config = {};
  for (const key of Object.keys(input)) {
    if (!CATEGORIES[key]) throw new AppError('VALIDATION_ERROR', 400, 'Unknown notification category');
  }
  for (const [key, category] of Object.entries(CATEGORIES)) {
    const ids = input[key];
    if (ids === null || ids === undefined) { config[key] = null; continue; }
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) throw new AppError('VALIDATION_ERROR', 400, 'Recipients must be user IDs');
    const eligibleIds = new Set(users.filter((user) => getPermissionsForUser(user.toJSON()).includes(category.permission)).map((user) => user.id));
    if (ids.some((id) => !eligibleIds.has(id))) throw new AppError('VALIDATION_ERROR', 400, `Select active, verified users with permission to receive ${category.label.toLowerCase()}`);
    config[key] = [...new Set(ids)];
  }
  await require('../settings/settings.service').updateKey('eventRecipientUserIds', config, 'messaging', actor.id, actor);
  return read();
};

module.exports = { read, update, getConfiguredRecipients };
