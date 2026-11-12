'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('design_draft_archives', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      draft_key: { type: Sequelize.STRING(50), allowNull: false },
      revision: { type: Sequelize.INTEGER, allowNull: false },
      payload: { type: Sequelize.JSONB, allowNull: false },
      base_snapshot: { type: Sequelize.JSONB, allowNull: false },
      archived_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('design_draft_archives', ['draft_key', 'created_at'], { name: 'design_draft_archives_key_created_at' });
  },
  async down(queryInterface) { await queryInterface.dropTable('design_draft_archives'); },
};
