'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('payments', 'expires_at', {
            type: Sequelize.DATE,
            allowNull: true,
        });
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('payments', 'expires_at');
    },
};
