'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('theme_packages', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      slug: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      version: { type: Sequelize.STRING(20), allowNull: false, defaultValue: '1.0.0' },
      author: { type: Sequelize.STRING(255), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      category: { type: Sequelize.STRING(50), allowNull: true },
      tags: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      preview_image: { type: Sequelize.TEXT, allowNull: true },
      package_data: { type: Sequelize.JSONB, allowNull: false },
      source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'imported' },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('theme_packages', ['source'], { name: 'theme_packages_source' });
    await queryInterface.addIndex('theme_packages', ['category'], { name: 'theme_packages_category' });

    await queryInterface.createTable('theme_activations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      theme_package_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'theme_packages', key: 'id' }, onDelete: 'SET NULL' },
      theme_name: { type: Sequelize.STRING(255), allowNull: false },
      theme_version: { type: Sequelize.STRING(20), allowNull: true },
      applied_scopes: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      before_snapshot: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      after_snapshot: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      // Audit-eligible column — must NOT cascade-delete on user removal,
      // otherwise we lose activation history when a user is hard-deleted.
      // Matches the rolledBackBy column on the next line and every other
      // audit table in the codebase.
      applied_by: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      rolled_back_at: { type: Sequelize.DATE, allowNull: true },
      rolled_back_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('theme_activations', ['created_at'], { name: 'theme_activations_created_at' });
    await queryInterface.addIndex('theme_activations', ['theme_package_id'], { name: 'theme_activations_package_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('theme_activations');
    await queryInterface.dropTable('theme_packages');
  },
};
