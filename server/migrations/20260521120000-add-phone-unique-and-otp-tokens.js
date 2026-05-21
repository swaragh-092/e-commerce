'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Unique index on phone (partial — only non-null values)
    await queryInterface.addIndex('user_profiles', ['phone'], {
      unique: true,
      where: { phone: { [Sequelize.Op.ne]: null } },
      name: 'user_profiles_phone_unique',
    });

    // OTP tokens table
    await queryInterface.createTable('otp_tokens', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      identifier: { type: Sequelize.STRING(100), allowNull: false }, // phone or email
      otp_hash: { type: Sequelize.STRING(64), allowNull: false },
      purpose: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'login' },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      max_attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      created_by_ip: { type: Sequelize.STRING(100) },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.addIndex('otp_tokens', ['identifier', 'purpose'], { name: 'otp_tokens_identifier_purpose' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('otp_tokens');
    await queryInterface.removeIndex('user_profiles', 'user_profiles_phone_unique');
  }
};
