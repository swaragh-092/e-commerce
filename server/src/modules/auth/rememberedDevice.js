'use strict';

const crypto = require('crypto');
const { RememberedDevice } = require('../index');

const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const issue = async userId => {
  const token = crypto.randomBytes(32).toString('base64url');
  await RememberedDevice.create({ userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
  return token;
};
const recognize = async (token, userId) => Boolean(token && userId && await RememberedDevice.findOne({
  where: { userId, tokenHash: hash(token), revokedAt: null, expiresAt: { [require('sequelize').Op.gt]: new Date() } },
  attributes: ['id'],
}));
const revoke = async token => token ? RememberedDevice.update({ revokedAt: new Date() }, { where: { tokenHash: hash(token), revokedAt: null } }) : null;
const revokeAll = async (userId, transaction) => RememberedDevice.update({ revokedAt: new Date() }, { where: { userId, revokedAt: null }, transaction });
module.exports = { issue, recognize, revoke, revokeAll, hash };
