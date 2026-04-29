'use strict';

const { AuditLog } = require('../index');
const logger = require('../../utils/logger');

/**
 * Log an admin action to the audit_logs table.
 * Always called fire-and-forget — failures are caught and logged to console,
 * never rethrown so they don't break the main transaction.
 *
 * @param {object} payload
 * @param {string} payload.userId      - UUID of the acting user
 * @param {string} payload.action      - CREATE | UPDATE | DELETE | STATUS_CHANGE
 * @param {string} payload.entity      - Product | Order | User | Coupon | Settings | Review
 * @param {string} payload.entityId    - VARCHAR(255) — NOT uuid-typed (supports any ID form)
 * @param {object|null} payload.changes        - { field: { old, new } } diff or null
 * @param {string|null} payload.ipAddress
 * @param {string|null} payload.userAgent
 * @param {import('sequelize').Transaction|null} [transaction]
 */
const log = async (
  { userId, action, entity, entityId, changes = null, ipAddress = null, userAgent = null, req = null },
  transaction = null,
) => {
  try {
    // If request context is provided, enrich metadata and mark as logged to prevent double-logging via middleware
    let finalIp = ipAddress;
    let finalUA = userAgent;
    let finalUserId = userId;

    if (req) {
      finalIp = finalIp || req.ip;
      finalUA = finalUA || req.get?.('user-agent') || null;
      finalUserId = finalUserId || req.user?.id;
      req._auditLogged = true; // Mark as logged so middleware doesn't double-log
    }

    await AuditLog.create(
      { userId: finalUserId, action, entity, entityId: String(entityId ?? ''), changes, ipAddress: finalIp, userAgent: finalUA },
      // audit log uses its own insert — never inherit the caller's transaction
    );
  } catch (err) {
    // Audit failures must NEVER crash the main flow
    logger.error('Audit log write failed', {
      userId,
      action,
      entity,
      entityId: String(entityId ?? ''),
      errorMessage: err.message,
    });
  }
};

/**
 * List audit logs with optional filters and pagination.
 */
const list = async ({ entity, action, userId, from, to, page = 1, limit = 20 }) => {
  const { Op } = require('sequelize');
  const { User } = require('../index');
  const offset = (page - 1) * limit;
  const where = {};

  if (entity) where.entity = entity;
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to) where.createdAt[Op.lte] = new Date(to);
  }

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    include: [
      {
        model: User,
        attributes: ['id', 'firstName', 'lastName', 'email'],
        required: false,
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit, 10),
    offset,
  });

  return { rows, count };
};

module.exports = { log, list };
