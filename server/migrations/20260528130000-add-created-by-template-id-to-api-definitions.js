'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('api_definitions', 'created_by_template_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    // B-tree index — the theme service does
    //   WHERE createdByTemplateId = ?   on every apply/rollback.
    // Without this, every theme operation full-scans api_definitions.
    await queryInterface.addIndex('api_definitions', ['created_by_template_id'], {
      name: 'api_definitions_created_by_template_id',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('api_definitions', 'api_definitions_created_by_template_id');
    await queryInterface.removeColumn('api_definitions', 'created_by_template_id');
  },
};
