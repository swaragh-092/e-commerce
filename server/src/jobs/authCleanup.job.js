'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { sequelize, AuditLog, Order, RefreshToken, PasswordResetToken, EmailVerificationToken, OtpToken, User } = require('../modules');
const logger = require('../utils/logger');

const run = () => {
  // Run every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running authCleanup job...');
    try {
      const now = new Date();

      // Delete expired/revoked refresh tokens older than 7 days
      const refreshDeleted = await RefreshToken.destroy({
        where: {
          [Op.or]: [
            { expiresAt: { [Op.lt]: now } },
            { revokedAt: { [Op.lt]: new Date(now - 7 * 24 * 60 * 60 * 1000) } },
          ],
        },
      });

      // Delete expired password reset tokens
      const resetDeleted = await PasswordResetToken.destroy({
        where: { expiresAt: { [Op.lt]: now } },
      });

      // Delete expired email verification tokens
      const verifyDeleted = await EmailVerificationToken.destroy({
        where: { expiresAt: { [Op.lt]: now } },
      });

      // Delete expired OTP tokens
      const otpDeleted = await OtpToken.destroy({
        where: { expiresAt: { [Op.lt]: now } },
      });

      // Hard-delete users past their 30-day grace period — but ONLY when they
      // have no orders. User -> Order has no CASCADE, so force-deleting an
      // ordering customer would FK-fail (and loop forever). Order owners are
      // kept with access blocked and reported for manual handling.
      const graceUsers = await User.findAll({
        where: { scheduledDeletionAt: { [Op.lt]: now } },
        attributes: ['id'],
        paranoid: false,
      });
      let usersDeleted = 0;
      let usersSkippedOrders = 0;
      for (const graceUser of graceUsers) {
        try {
          usersDeleted += await sequelize.transaction(async (transaction) => {
            const user = await User.findOne({
              where: { id: graceUser.id, scheduledDeletionAt: { [Op.lt]: now } },
              attributes: ['id'],
              paranoid: false,
              transaction,
              lock: transaction.LOCK.UPDATE,
            });
            if (!user) return 0;

            const orderCount = await Order.count({ where: { userId: user.id }, transaction });
            if (orderCount > 0) {
              usersSkippedOrders += 1;
              logger.warn('authCleanup skipped grace-deletion user with orders', { userId: user.id, orderCount });
              return 0;
            }

            // Preserve audit entries while releasing their foreign key to the user.
            await AuditLog.update({ userId: null }, { where: { userId: user.id }, transaction });
            await user.destroy({ force: true, transaction });
            return 1;
          });
        } catch (userErr) {
          logger.error('authCleanup failed to delete grace user', {
            userId: graceUser.id,
            error: userErr.message,
          });
        }
      }

      logger.info('authCleanup complete', {
        refreshDeleted, resetDeleted, verifyDeleted, otpDeleted, usersDeleted, usersSkippedOrders,
      });
    } catch (error) {
      logger.error('Error in authCleanup job:', error);
    }
  });
};

module.exports = { run };
