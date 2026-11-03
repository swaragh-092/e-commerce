'use strict';
const AppError = require('../../utils/AppError');

// Include both the legacy role and persisted custom-role base roles.
const requiresAdminMfa = (user) => {
  const isAdmin = (role) => ['admin', 'super_admin'].includes(role);
  return isAdmin(user?.role) || (user?.roles || []).some((role) =>
    typeof role === 'string' ? isAdmin(role) : isAdmin(role.baseRole) || isAdmin(role.slug)
  );
};
const assertMfaEnrollment = (user) => {
  if (requiresAdminMfa(user) && !user.twoFactorEnabled) {
    throw new AppError('MFA_REQUIRED', 403, 'Administrator MFA enrollment is required. Contact your operator.');
  }
};
const assertMfaSession = (user, claims) => {
  assertMfaEnrollment(user);
  if (requiresAdminMfa(user) && claims.mfa !== true) {
    throw new AppError('UNAUTHORIZED', 401, 'Sign in again with administrator MFA.');
  }
};
module.exports = { requiresAdminMfa, assertMfaEnrollment, assertMfaSession };
