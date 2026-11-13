'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const getIssAud = () => ({
  issuer: process.env.JWT_ISSUER || 'ecommerce-pro',
  audience: process.env.JWT_AUDIENCE || 'ecommerce-pro-client',
});

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateTokens = (user, sessionId = null, { mfaVerified = false, mfaMethod, mfaBinding } = {}) => {
  const { issuer, audience } = getIssAud();
  const payload = { id: user.id, role: user.role, ...(mfaVerified ? { mfa: true, ...(mfaMethod ? { mfaMethod } : {}), ...(mfaBinding ? { mfaBinding } : {}) } : {}), ...(sessionId ? { sid: sessionId } : {}) };
  return {
    accessToken: jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
      issuer,
      audience,
    }),
    refreshToken: jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
      issuer,
      audience,
    }),
  };
};

const signTempTwoFactorToken = (userId, passwordBinding, context = {}) => {
  const { issuer, audience } = getIssAud();
  return jwt.sign({ id: userId, purpose: '2fa', ...(passwordBinding ? { passwordBinding } : {}), ...context }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '5m',
    issuer,
    audience,
  });
};

// This is deliberately not an access token: it can only start and complete
// authenticator enrollment after a successful password sign-in.
const signMfaEnrollmentToken = (userId) => {
  const { issuer, audience } = getIssAud();
  return jwt.sign({ id: userId, purpose: 'mfa_enrollment' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '10m',
    issuer,
    audience,
  });
};
const verifyMfaEnrollmentToken = (token) => {
  const { issuer, audience } = getIssAud();
  const claims = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer, audience });
  if (claims.purpose !== 'mfa_enrollment' || !claims.id) throw new jwt.JsonWebTokenError('Invalid MFA enrollment token');
  return claims;
};

module.exports = { getIssAud, hashToken, generateTokens, signTempTwoFactorToken, signMfaEnrollmentToken, verifyMfaEnrollmentToken };
