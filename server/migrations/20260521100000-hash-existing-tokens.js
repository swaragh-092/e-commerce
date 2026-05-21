'use strict';

const crypto = require('crypto');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const isAlreadyHashed = (token) => /^[a-f0-9]{64}$/.test(token);

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const tables = ['refresh_tokens', 'password_reset_tokens', 'email_verification_tokens'];

      for (const table of tables) {
        const [rows] = await queryInterface.sequelize.query(
          `SELECT id, token FROM ${table} WHERE token IS NOT NULL`,
          { transaction }
        );
        for (const row of rows) {
          if (isAlreadyHashed(row.token)) continue;
          await queryInterface.sequelize.query(
            `UPDATE ${table} SET token = :hashed WHERE id = :id`,
            { replacements: { hashed: hashToken(row.token), id: row.id }, transaction }
          );
        }
      }
    });
  },

  async down() {
    // Irreversible — cannot unhash tokens
  }
};
