'use strict';

const { Op } = require('sequelize');
const { sequelize, Setting, User, Role, Permission, AuditLog } = require('../index');
const AppError = require('../../utils/AppError');
const { isSuperAdminUser, getPermissionsForUser, PERMISSIONS } = require('../../config/permissions');
const factors = require('./twoFactor.service');
const {
  POLICY_GROUP, POLICY_KEY, policySchema, environmentPolicy,
} = require('./mfaPolicy');

const canManage = user => isSuperAdminUser(user)
  && getPermissionsForUser(user).includes(PERMISSIONS.SETTINGS_MANAGE);
const readSaved = transaction => Setting.findOne({ where: { group: POLICY_GROUP, key: POLICY_KEY }, transaction });
const parsePolicy = input => {
  const { error, value } = policySchema.validate(input);
  if (error) throw new AppError('VALIDATION_ERROR', 400, 'Invalid MFA policy. Choose administrator and staff requirements.');
  if (value.staffMode !== 'selected' && value.requiredRoleIds.length) {
    throw new AppError('VALIDATION_ERROR', 400, 'Selected roles are only allowed with selected-role MFA.');
  }
  if (value.staffMode === 'selected' && !value.requiredRoleIds.length) {
    throw new AppError('VALIDATION_ERROR', 400, 'Select at least one staff role.');
  }
  return value;
};
const staffRoles = () => Role.findAll({
  where: { baseRole: 'admin', isActive: true, slug: { [Op.notIn]: ['admin', 'super_admin', 'customer'] } },
  attributes: ['id', 'name', 'slug'], order: [['name', 'ASC']],
});
const get = async actingUser => {
  const [saved, roles] = await Promise.all([readSaved(), staffRoles()]);
  return {
    policy: saved ? parsePolicy(saved.value) : environmentPolicy(),
    source: saved ? 'settings' : 'environment',
    roles: roles.map(role => ({ id: role.id, name: role.name, slug: role.slug })),
    canManage: canManage(actingUser),
    mfaEnabled: actingUser.twoFactorEnabled === true,
  };
};
const update = async (actingUser, input, request = {}) => {
  if (!canManage(actingUser)) throw new AppError('FORBIDDEN', 403, 'Only a super administrator with settings management permission can change MFA policy.');
  const policy = parsePolicy(input.policy);
  const actor = await User.scope('withPassword').findByPk(actingUser.id, {
    include: [{ model: Role, as: 'roles', include: [{ model: Permission, as: 'permissions' }] }],
  });
  if (!actor || actor.status !== 'active' || !canManage(actor)) throw new AppError('FORBIDDEN', 403, 'Your administrative permissions changed. Sign in again.');
  if (!await actor.validatePassword(input.verification.currentPassword)) {
    throw new AppError('REAUTHENTICATION_FAILED', 403, 'Security verification failed. Check your current password and verification code.');
  }
  if (policy.allowEmailCodes && !actor.twoFactorEnabled) {
    throw new AppError('REAUTHENTICATION_FAILED', 403, 'Set up an authenticator before enabling email codes.');
  }
  if (actor.twoFactorEnabled) {
    let verified = false;
    try { verified = factors.verify(actor, input.verification.code); } catch { /* Use one generic verification error. */ }
    if (!verified) throw new AppError('REAUTHENTICATION_FAILED', 403, 'Security verification failed. Check your current password and verification code.');
  }
  const available = await staffRoles();
  if (policy.requiredRoleIds.some(id => !available.some(role => role.id === id))) {
    throw new AppError('VALIDATION_ERROR', 400, 'Select active staff roles only. Customer MFA cannot be required.');
  }
  await sequelize.transaction(async transaction => {
    const saved = await readSaved(transaction);
    await Setting.upsert({ group: POLICY_GROUP, key: POLICY_KEY, value: policy, updatedBy: actor.id }, { transaction });
    // Verification secrets never enter settings or audit logs.
    await AuditLog.create({ userId: actor.id, action: 'UPDATE', entity: 'Settings', entityId: 'auth.mfaPolicy',
      changes: { policy: { old: saved?.value || environmentPolicy(), new: policy } },
      ipAddress: request.ip || null, userAgent: request.userAgent || null,
    }, { transaction });
  });
  return get(actingUser);
};

module.exports = { get, update };
