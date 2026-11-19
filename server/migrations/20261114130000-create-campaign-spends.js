'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('campaign_spends', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      spend_date: { type: Sequelize.DATEONLY, allowNull: false },
      source: { type: Sequelize.STRING(255), allowNull: false },
      medium: { type: Sequelize.STRING(255), allowNull: false, defaultValue: '' },
      campaign: { type: Sequelize.STRING(255), allowNull: false },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addConstraint('campaign_spends', {
      fields: ['spend_date', 'source', 'medium', 'campaign'],
      type: 'unique',
      name: 'campaign_spends_date_campaign_unique',
    });
    await queryInterface.addIndex('campaign_spends', ['spend_date'], { name: 'campaign_spends_date_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('campaign_spends');
  },
};
