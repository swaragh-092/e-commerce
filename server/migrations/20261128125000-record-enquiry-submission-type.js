'use strict';

const HISTORY_INDEX = 'enquiries_submitter_history_idx';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('enquiries', 'submitted_while_signed_in', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      }, { transaction });
      await queryInterface.sequelize.query(
        'UPDATE enquiries SET submitted_while_signed_in = true WHERE submitted_by_user_id IS NOT NULL',
        { transaction },
      );
      await queryInterface.addIndex('enquiries', ['submitted_by_user_id', 'created_at', 'id'], {
        name: HISTORY_INDEX,
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('enquiries', HISTORY_INDEX, { transaction });
      await queryInterface.removeColumn('enquiries', 'submitted_while_signed_in', { transaction });
    });
  },
};
