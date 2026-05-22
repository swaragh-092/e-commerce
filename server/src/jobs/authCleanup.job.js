'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { RefreshToken, PasswordResetToken, EmailVerificationToken, OtpToken, User } = require('../modules');
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

      // Hard-delete users past their 30-day grace period
      const usersDeleted = await User.destroy({
        where: { scheduledDeletionAt: { [Op.lt]: now } },
        force: true, // bypass paranoid soft-delete
      });

      logger.info('authCleanup complete', {
        refreshDeleted, resetDeleted, verifyDeleted, otpDeleted, usersDeleted,
      });
    } catch (error) {
      logger.error('Error in authCleanup job:', error);
    }
  });
};

module.exports = { run };
