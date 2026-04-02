'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('product_variants', 'deleted_at', {
            type: Sequelize.DATE,
        });

        await queryInterface.addIndex('product_variants', ['deleted_at'], {
            name: 'idx_variants_deleted_at',
            where: {
                deleted_at: { [Sequelize.Op.ne]: null }
            }
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('product_variants', 'deleted_at');
    },
};
