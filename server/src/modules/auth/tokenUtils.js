'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const getIssAud = () => ({
  issuer: process.env.JWT_ISSUER || 'ecommerce-pro',
  audience: process.env.JWT_AUDIENCE || 'ecommerce-pro-client',
});

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateTokens = (user, sessionId = null) => {
  const { issuer, audience } = getIssAud();
  const payload = { id: user.id, role: user.role, ...(sessionId ? { sid: sessionId } : {}) };
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

const signTempTwoFactorToken = (userId) => {
  const { issuer, audience } = getIssAud();
  return jwt.sign({ id: userId, purpose: '2fa' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '5m',
    issuer,
    audience,
  });
};

module.exports = { getIssAud, hashToken, generateTokens, signTempTwoFactorToken };
