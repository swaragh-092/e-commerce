'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('design_draft_versions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      draft_key: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'store' },
      revision: { type: Sequelize.INTEGER, allowNull: false },
      payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      published_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      published_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('design_draft_versions', {
      fields: ['draft_key', 'revision'],
      type: 'unique',
      name: 'design_draft_versions_draft_key_revision_key',
    });
    await queryInterface.addIndex('design_draft_versions', ['draft_key', 'published_at'], {
      name: 'design_draft_versions_draft_key_published_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('design_draft_versions');
  },
};
