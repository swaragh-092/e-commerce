'use strict';

const crypto = require('crypto');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Hash all existing plaintext refresh tokens
    const [refreshTokens] = await queryInterface.sequelize.query(
      `SELECT id, token FROM refresh_tokens WHERE LENGTH(token) != 64`
    );
    for (const row of refreshTokens) {
      await queryInterface.sequelize.query(
        `UPDATE refresh_tokens SET token = :hashed WHERE id = :id`,
        { replacements: { hashed: hashToken(row.token), id: row.id } }
      );
    }

    // Hash all existing plaintext password reset tokens
    const [resetTokens] = await queryInterface.sequelize.query(
      `SELECT id, token FROM password_reset_tokens WHERE LENGTH(token) != 64`
    );
    for (const row of resetTokens) {
      await queryInterface.sequelize.query(
        `UPDATE password_reset_tokens SET token = :hashed WHERE id = :id`,
        { replacements: { hashed: hashToken(row.token), id: row.id } }
      );
    }

    // Hash all existing plaintext email verification tokens
    const [verifyTokens] = await queryInterface.sequelize.query(
      `SELECT id, token FROM email_verification_tokens WHERE LENGTH(token) != 64`
    );
    for (const row of verifyTokens) {
      await queryInterface.sequelize.query(
        `UPDATE email_verification_tokens SET token = :hashed WHERE id = :id`,
        { replacements: { hashed: hashToken(row.token), id: row.id } }
      );
    }
  },

  async down() {
    // Irreversible — cannot unhash tokens
  }
};
