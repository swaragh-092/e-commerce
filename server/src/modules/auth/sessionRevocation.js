'use strict';
const { Op } = require('sequelize');
const db = require('../index');

// Use the caller's transaction: grants and revocation must commit together.
// Authentication checks the durable row, so this works across workers/restarts.
const revokeUserSessions = async (userIds, transaction) => {
  const ids = [...new Set(userIds.filter(Boolean))].sort();
  if (!ids.length) return;
  // Match refresh/logout's lock order so a rotation cannot insert a successor
  // after the revocation snapshot. Sorted acquisition avoids cross-user deadlocks.
  await db.User.findAll({
    where: { id: { [Op.in]: ids } }, attributes: ['id'],
    order: [['id', 'ASC']], transaction, lock: true,
  });
  await db.RefreshToken.update({ revokedAt: new Date() }, {
    where: { userId: { [Op.in]: ids }, revokedAt: null }, transaction,
  });
};
const revokeRoleSessions = async (role, transaction) => {
  const users = await db.sequelize.query(`
    SELECT DISTINCT u.id FROM users u
    WHERE u.deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = :roleId)
      OR (u.role = :roleSlug AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id))
    )
  `, { replacements: { roleId: role.id, roleSlug: role.slug }, type: db.sequelize.QueryTypes.SELECT, transaction });
  await revokeUserSessions(users.map(user => user.id), transaction);
};
module.exports = { revokeUserSessions, revokeRoleSessions };
