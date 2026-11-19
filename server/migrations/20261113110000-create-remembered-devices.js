'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('remembered_devices', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('remembered_devices', ['user_id', 'revoked_at'], { name: 'idx_remembered_devices_user_active' });
  },
  async down(queryInterface) { await queryInterface.dropTable('remembered_devices'); },
};
