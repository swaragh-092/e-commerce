'use strict';

const { sequelize, Order, Enquiry, User, Role, Permission } = require('../index');
const { PERMISSIONS, getPermissionsForUser } = require('../../config/permissions');
const AppError = require('../../utils/AppError');

const targetFor = (kind, actor) => {
  const target = kind === 'orders' ? { model: Order, manage: PERMISSIONS.ORDERS_UPDATE_STATUS, receive: PERMISSIONS.ORDERS_READ, template: 'order_assigned_staff' }
    : kind === 'enquiries' ? { model: Enquiry, manage: PERMISSIONS.ENQUIRIES_MANAGE, receive: PERMISSIONS.ENQUIRIES_MANAGE, template: 'enquiry_assigned_staff' } : null;
  if (!target) throw new AppError('VALIDATION_ERROR', 400, 'Unknown assignment type');
  if (!getPermissionsForUser(actor).includes(target.manage)) throw new AppError('FORBIDDEN', 403, 'You cannot manage these assignments');
  return target;
};

const eligibleUsers = async (target, transaction = null, userId = null) => {
  const users = await User.findAll({
    where: { status: 'active', emailVerified: true, ...(userId ? { id: userId } : {}) },
    attributes: ['id', 'email', 'firstName', 'lastName', 'role'],
    include: [{ model: Role, as: 'roles', through: { attributes: [] }, include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }] }],
    transaction: transaction || undefined,
  });
  return users.filter((user) => getPermissionsForUser(user.toJSON()).includes(target.receive));
};

const read = async (kind, id, actor) => {
  const target = targetFor(kind, actor);
  const record = await target.model.findByPk(id);
  if (!record) throw new AppError('NOT_FOUND', 404, 'Record not found');
  const users = await eligibleUsers(target);
  return {
    assignedUserId: record.assignedUserId || null,
    candidates: users.map((user) => ({ id: user.id, name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email, email: user.email })),
  };
};

const assign = async (kind, id, assignedUserId, actor) => {
  const target = targetFor(kind, actor);
  const validation = require('joi').string().uuid().allow(null).required().validate(assignedUserId);
  if (validation.error) throw new AppError('VALIDATION_ERROR', 400, 'Select a valid staff account or clear the assignment');
  return sequelize.transaction(async (transaction) => {
    const record = await target.model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!record) throw new AppError('NOT_FOUND', 404, 'Record not found');
    const user = assignedUserId ? (await eligibleUsers(target, transaction)).find((candidate) => candidate.id === assignedUserId) : null;
    if (assignedUserId && !user) throw new AppError('VALIDATION_ERROR', 400, 'Select active, verified staff with the required permissions');
    if ((record.assignedUserId || null) === assignedUserId) return { assignedUserId };
    const previousUserId = record.assignedUserId || null;
    await record.update({ assignedUserId }, { transaction });
    if (user) {
      await require('./notification.service').send(target.template, user.email, {
        name: user.firstName || user.email, order_id: kind === 'orders' ? id : null,
        order_number: record.orderNumber, enquiry_id: kind === 'enquiries' ? id : null,
        customer_name: record.name || 'Customer', customer_email: record.email || '',
      }, user.id, kind === 'orders' ? id : null, 'email', transaction);
    }
    try {
      await require('../audit/audit.service').log({ userId: actor.id, action: 'UPDATE', entity: kind === 'orders' ? 'Order' : 'Enquiry', entityId: id, changes: { assignedUserId: { before: previousUserId, after: assignedUserId } } }, transaction);
    } catch (_) { /* Assignment and email are still committed together. */ }
    return { assignedUserId };
  });
};

const canReceive = async (kind, id, userId, email) => {
  if (!userId || !id) return false;
  const target = kind === 'orders' ? { model: Order, receive: PERMISSIONS.ORDERS_READ } : { model: Enquiry, receive: PERMISSIONS.ENQUIRIES_MANAGE };
  const record = await target.model.findByPk(id);
  if (!record || record.assignedUserId !== userId) return false;
  const users = await eligibleUsers(target, null, userId);
  return users.some((user) => user.email === email);
};

module.exports = { read, assign, canReceive };
