'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Drop existing SET NULL constraints
        await queryInterface.sequelize.query(`
            ALTER TABLE product_attributes 
            DROP CONSTRAINT IF EXISTS product_attributes_attribute_id_fkey,
            DROP CONSTRAINT IF EXISTS product_attributes_value_id_fkey
        `);

        // Re-add as CASCADE
        await queryInterface.sequelize.query(`
            ALTER TABLE product_attributes
            ADD CONSTRAINT product_attributes_attribute_id_fkey 
                FOREIGN KEY (attribute_id) REFERENCES attribute_templates(id) ON DELETE CASCADE,
            ADD CONSTRAINT product_attributes_value_id_fkey 
                FOREIGN KEY (value_id) REFERENCES attribute_values(id) ON DELETE CASCADE
        `);
    },

    async down(queryInterface, Sequelize) {
        // Revert to SET NULL
        await queryInterface.sequelize.query(`
            ALTER TABLE product_attributes 
            DROP CONSTRAINT IF EXISTS product_attributes_attribute_id_fkey,
            DROP CONSTRAINT IF EXISTS product_attributes_value_id_fkey
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE product_attributes
            ADD CONSTRAINT product_attributes_attribute_id_fkey 
                FOREIGN KEY (attribute_id) REFERENCES attribute_templates(id) ON DELETE SET NULL,
            ADD CONSTRAINT product_attributes_value_id_fkey 
                FOREIGN KEY (value_id) REFERENCES attribute_values(id) ON DELETE SET NULL
        `);
    }
};
