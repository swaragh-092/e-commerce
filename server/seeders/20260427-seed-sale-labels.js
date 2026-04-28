'use strict';

const { v4: uuidv4 } = require('uuid');

const SETTING_KEY = 'sale_labels';
const SETTING_GROUP = 'sales';

const defaultLabels = [
  { id: 'sale', name: 'Sale', color: '#EF4444', priority: 0, isActive: true },
  { id: 'flash-sale', name: 'Flash Sale', color: '#F97316', priority: 1, isActive: true },
  { id: 'clearance', name: 'Clearance', color: '#8B5CF6', priority: 2, isActive: true },
  { id: 'new-arrival', name: 'New Arrival', color: '#10B981', priority: 3, isActive: true },
  { id: 'hot-deal', name: 'Hot Deal', color: '#EAB308', priority: 4, isActive: true },
  { id: 'limited-time', name: 'Limited Time', color: '#3B82F6', priority: 5, isActive: true },
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Check if the settings group exists in the Settings table for this key
      const [existingSetting] = await queryInterface.sequelize.query(
        `SELECT id FROM settings WHERE "key" = '${SETTING_KEY}' AND "group" = '${SETTING_GROUP}'`,
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      if (!existingSetting) {
        const id = uuidv4();
        await queryInterface.sequelize.query(
          `INSERT INTO settings (id, "key", value, "group", created_at, updated_at) 
           VALUES (:id, :key, :value, :group, NOW(), NOW())`,
          {
            replacements: {
              id,
              key: SETTING_KEY,
              value: JSON.stringify(defaultLabels),
              group: SETTING_GROUP,
            },
            transaction,
          }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error seeding sale labels:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      `DELETE FROM settings WHERE "key" = '${SETTING_KEY}' AND "group" = '${SETTING_GROUP}'`
    );
  },
};
