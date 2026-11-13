'use strict';
const jwt = require('jsonwebtoken');
const { isAdminUser } = require('../../config/permissions');
const AppError = require('../../utils/AppError');
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const IDLE_MS = 30 * 60 * 1000;
const expired = () => new AppError('ADMIN_SESSION_EXPIRED', 401, 'Admin session expired; sign in again');
const deadlines = session => {
  if (!session) return { absolute: NaN, idle: NaN };
  const started = new Date(session.createdAt).getTime();
  const absolute = Math.min(started + ABSOLUTE_MS, session.absoluteExpiresAt ? +new Date(session.absoluteExpiresAt) : Infinity, session.expiresAt ? +new Date(session.expiresAt) : Infinity);
  return { absolute, idle: +new Date(session.lastActiveAt || session.createdAt) + IDLE_MS };
};
const enforce = (user, session) => {
  if (!isAdminUser(user)) return;
  const { absolute, idle } = deadlines(session);
  if (!Number.isFinite(absolute) || !Number.isFinite(idle) || absolute <= Date.now() || idle <= Date.now()) throw expired();
};
const status = (user, session) => {
  enforce(user, session);
  const { absolute, idle } = deadlines(session);
  return {
    userId: user.id,
    serverTime: new Date(),
    startedAt: session.createdAt,
    absoluteExpiresAt: new Date(absolute),
    idleExpiresAt: new Date(idle),
    reauthContext: jwt.sign({ id: user.id, sid: session.id, purpose: 'admin_reauth' }, process.env.JWT_ACCESS_SECRET, {
      issuer: process.env.JWT_ISSUER || 'ecommerce-pro', audience: process.env.JWT_AUDIENCE || 'ecommerce-pro-client', expiresIn: '30d',
    }),
  };
};
const recordActivity = async (user, sessionId) => {
  const { sequelize, User, RefreshToken } = require('../index');
  return sequelize.transaction(async transaction => {
    await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
    const session = await RefreshToken.findByPk(sessionId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!session || session.userId !== user.id || session.revokedAt) throw new AppError('UNAUTHORIZED', 401, 'Session has been revoked');
    enforce(user, session);
    await session.update({ lastActiveAt: new Date() }, { transaction });
    return status(user, session);
  });
};
module.exports = { ABSOLUTE_MS, IDLE_MS, deadlines, enforce, status, recordActivity };
