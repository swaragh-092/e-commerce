'use strict';

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.addColumn('admin_alert_policy', 'inbox_enabled', { type: Sequelize.BOOLEAN, allowNull: true });
  },
  down(queryInterface) {
    return queryInterface.removeColumn('admin_alert_policy', 'inbox_enabled');
  },
};
