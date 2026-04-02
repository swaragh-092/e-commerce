'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addIndex('products', ['deleted_at'], {
            name: 'idx_products_deleted_at',
            where: {
                deleted_at: { [Sequelize.Op.ne]: null }
            }
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('products', 'idx_products_deleted_at');
    },
};
