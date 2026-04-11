'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('refresh_tokens', 'created_by_ip', {
            type: Sequelize.STRING(100),
            allowNull: true,
        });

        await queryInterface.addColumn('refresh_tokens', 'revoked_at', {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await queryInterface.addIndex('refresh_tokens', ['revoked_at'], {
            name: 'idx_refresh_tokens_revoked_at',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('refresh_tokens', 'idx_refresh_tokens_revoked_at');
        await queryInterface.removeColumn('refresh_tokens', 'revoked_at');
        await queryInterface.removeColumn('refresh_tokens', 'created_by_ip');
    },
};