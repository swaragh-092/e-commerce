'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn('coupon_usages', 'user_id', {
            type: Sequelize.UUID,
            allowNull: true,
        });
        await queryInterface.addColumn('coupon_usages', 'guest_session_id', {
            type: Sequelize.STRING(255),
            allowNull: true,
        });
        await queryInterface.addIndex('coupon_usages', ['coupon_id', 'guest_session_id'], {
            name: 'idx_coupon_usage_guest_session',
        });
        await queryInterface.sequelize.query(`
            ALTER TABLE coupon_usages
            ADD CONSTRAINT coupon_usages_principal_check
            CHECK ((user_id IS NOT NULL AND guest_session_id IS NULL)
                OR (user_id IS NULL AND guest_session_id IS NOT NULL))
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('DELETE FROM coupon_usages WHERE user_id IS NULL');
        await queryInterface.sequelize.query('ALTER TABLE coupon_usages DROP CONSTRAINT coupon_usages_principal_check');
        await queryInterface.removeIndex('coupon_usages', 'idx_coupon_usage_guest_session');
        await queryInterface.removeColumn('coupon_usages', 'guest_session_id');
        await queryInterface.changeColumn('coupon_usages', 'user_id', {
            type: Sequelize.UUID,
            allowNull: false,
        });
    },
};
