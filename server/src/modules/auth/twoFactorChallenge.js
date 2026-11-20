'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OtpToken } = require('../index');
const { hashToken, signTempTwoFactorToken } = require('./tokenUtils');

const PURPOSE = '2fa-challenge';

const issue = async (userId, passwordBinding, context = {}, transaction) => {
  const jti = crypto.randomUUID();
  const token = signTempTwoFactorToken(userId, passwordBinding, { ...context, jti });
  const claims = jwt.decode(token);
  const challengeOptions = transaction ? { transaction } : undefined;
  await OtpToken.create({
    identifier: jti,
    purpose: PURPOSE,
    otpHash: hashToken(jti),
    maxAttempts: 1,
    expiresAt: new Date(claims.exp * 1000),
  }, challengeOptions);
  return { token, jti };
};

const lock = (jti, transaction) => OtpToken.findOne({
  where: { identifier: jti, purpose: PURPOSE },
  transaction,
  lock: transaction.LOCK.UPDATE,
});

const isUsable = record => Boolean(record && record.attempts < record.maxAttempts
  && new Date(record.expiresAt) > new Date());

const consume = async (jti, transaction) => {
  const record = await lock(jti, transaction);
  if (!isUsable(record)) return false;
  await record.update({ attempts: record.maxAttempts }, { transaction });
  return true;
};

module.exports = { PURPOSE, issue, lock, isUsable, consume };
