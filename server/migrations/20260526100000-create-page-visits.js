'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('page_visits', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      path: { type: Sequelize.STRING(500), allowNull: false },
      referrer_source: { type: Sequelize.STRING(255), allowNull: true },
      user_id: { type: Sequelize.UUID, allowNull: true },
      session_id: { type: Sequelize.STRING(255), allowNull: true },
      user_agent: { type: Sequelize.STRING(500), allowNull: true },
      ip: { type: Sequelize.STRING(45), allowNull: true },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('page_visits', ['created_at']);
    await queryInterface.addIndex('page_visits', ['referrer_source']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('page_visits');
  },
};
