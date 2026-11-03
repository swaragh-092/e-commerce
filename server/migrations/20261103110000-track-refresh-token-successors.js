'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('refresh_tokens', 'replaced_by_token_id', { type: Sequelize.UUID, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('refresh_tokens', 'replaced_by_token_id');
  },
};
