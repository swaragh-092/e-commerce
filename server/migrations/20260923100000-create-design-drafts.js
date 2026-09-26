'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('design_drafts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      draft_key: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'store', unique: true },
      revision: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
      payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      base_snapshot: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      published_at: { type: Sequelize.DATE, allowNull: true },
      published_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('design_drafts', ['status'], { name: 'design_drafts_status' });
    await queryInterface.addIndex('design_drafts', ['updated_at'], { name: 'design_drafts_updated_at' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('design_drafts');
  },
};
