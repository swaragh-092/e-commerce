'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn('audit_logs', 'entity_id', {
            type: Sequelize.STRING(255),
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.changeColumn('audit_logs', 'entity_id', {
            type: Sequelize.UUID,
        });
    },
};
