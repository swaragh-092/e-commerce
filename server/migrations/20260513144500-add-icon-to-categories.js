'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('categories', 'icon', {
            type: Sequelize.STRING(500),
            allowNull: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('categories', 'icon');
    },
};
