'use strict';
const AppError = require('../../utils/AppError');

const Joi = require('joi');
const POLICY_KEY = 'mfaPolicy';
const POLICY_GROUP = 'auth';
const policySchema = Joi.object({
  allowEmailCodes: Joi.boolean().strict().optional(),
  requireAdministrators: Joi.boolean().strict().required(),
  staffMode: Joi.string().valid('optional', 'all', 'selected').required(),
  requiredRoleIds: Joi.array().items(Joi.string().uuid()).unique().max(100).required(),
}).unknown(false);

// Persisted custom admin roles represent staff. Do not let their legacy
// user.role=admin alias override the selected-role policy.
const classifyUser = (user) => {
  const roles = (user?.roles || []).map(role => typeof role === 'string' ? { slug: role } : role);
  const staffRoles = roles.filter(role => role?.baseRole === 'admin' && !['admin', 'super_admin'].includes(role.slug));
  const administrator = user?.role === 'super_admin'
    || roles.some(role => ['admin', 'super_admin'].includes(role?.slug) || role?.baseRole === 'super_admin')
    || (user?.role === 'admin' && !staffRoles.length);
  return { administrator, staffRoles, administrative: administrator || staffRoles.length > 0 };
};
const environmentPolicy = () => ({
  requireAdministrators: process.env.REQUIRE_ADMIN_MFA !== 'false',
  staffMode: process.env.REQUIRE_ADMIN_MFA === 'false' ? 'optional' : 'all',
  requiredRoleIds: [],
});
const loadMfaPolicy = async (user, transaction) => {
  if (user && !classifyUser(user).administrative) return environmentPolicy();
  const { Setting } = require('../index');
  const saved = await Setting.findOne({ where: { group: POLICY_GROUP, key: POLICY_KEY }, transaction });
  if (!saved) return environmentPolicy();
  const { error, value } = policySchema.validate(saved.value);
  if (error) throw new AppError('MFA_POLICY_INVALID', 503, 'MFA settings are invalid. Contact your operator.');
  return value;
};
const isEnrollmentRequired = (user, policy = environmentPolicy()) => {
  const { administrator, staffRoles } = classifyUser(user);
  return (administrator && policy.requireAdministrators)
    || (staffRoles.length > 0 && (policy.staffMode === 'all'
      || (policy.staffMode === 'selected' && staffRoles.some(role => policy.requiredRoleIds.includes(role.id)))));
};
const requiresAdminMfa = (user, policy = environmentPolicy()) =>
  isEnrollmentRequired(user, policy) || (classifyUser(user).administrative && user?.twoFactorEnabled === true);
const canUseEmailMfa = (user, policy) => policy.allowEmailCodes === true
  && classifyUser(user).administrative && user.twoFactorEnabled === true
  && user.emailVerified === true && Boolean(user.email) && !user.email.endsWith('@phone.local');
const assertMfaEnrollment = (user, policy) => {
  if (isEnrollmentRequired(user, policy) && !user.twoFactorEnabled) {
    throw new AppError('MFA_REQUIRED', 403, 'Staff MFA enrollment is required. Contact your operator.');
  }
};
const assertMfaSession = (user, claims, policy) => {
  assertMfaEnrollment(user, policy);
  if (claims.mfaMethod === 'email' && !canUseEmailMfa(user, policy)) {
    throw new AppError('UNAUTHORIZED', 401, 'Sign in again with your authenticator.');
  }
  if (claims.mfaMethod === 'email'
      && (!claims.mfaBinding || claims.mfaBinding !== user.emailMfaPasswordBinding)) {
    throw new AppError('UNAUTHORIZED', 401, 'Sign in again with your authenticator.');
  }
  if (requiresAdminMfa(user, policy) && claims.mfa !== true) {
    throw new AppError('UNAUTHORIZED', 401, 'Sign in again with MFA.');
  }
};
module.exports = {
  POLICY_KEY, POLICY_GROUP, policySchema, classifyUser, environmentPolicy, loadMfaPolicy,
  isEnrollmentRequired, requiresAdminMfa, canUseEmailMfa, assertMfaEnrollment, assertMfaSession,
};
