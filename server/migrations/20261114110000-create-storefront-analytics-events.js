'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('storefront_analytics_events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      event_name: { type: Sequelize.STRING(40), allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: true },
      session_id: { type: Sequelize.STRING(255), allowNull: true },
      checkout_session_id: { type: Sequelize.UUID, allowNull: true },
      product_id: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('storefront_analytics_events', ['created_at']);
    await queryInterface.addIndex('storefront_analytics_events', ['event_name', 'created_at']);
    await queryInterface.addIndex('storefront_analytics_events', ['session_id', 'created_at']);
    await queryInterface.addIndex('storefront_analytics_events', ['checkout_session_id', 'created_at']);
    await queryInterface.addIndex('storefront_analytics_events', ['event_name', 'checkout_session_id'], {
      name: 'storefront_analytics_events_checkout_dedupe',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('storefront_analytics_events');
  },
};
