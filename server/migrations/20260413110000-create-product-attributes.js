'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('product_attributes', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
            },
            product_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'products', key: 'id' },
                onDelete: 'CASCADE',
            },
            // Null when using a custom (free-form) attribute
            attribute_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'attribute_templates', key: 'id' },
                onDelete: 'SET NULL',
            },
            // Null when using a custom value or a free-form attribute
            value_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'attribute_values', key: 'id' },
                onDelete: 'SET NULL',
            },
            // Used when attribute_id IS NULL (free-form attribute name)
            custom_name: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            // Used when value_id IS NULL (free-form attribute value)
            custom_value: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            // Marks attributes that form the variant matrix
            is_variant_attr: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            sort_order: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('NOW()'),
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('NOW()'),
            },
        });

        // Enforce: either (attribute_id + value_id) OR (custom_name + custom_value)
        await queryInterface.sequelize.query(`
            ALTER TABLE product_attributes
            ADD CONSTRAINT chk_product_attr_mode CHECK (
                (attribute_id IS NOT NULL AND value_id IS NOT NULL)
                OR
                (custom_name IS NOT NULL AND custom_value IS NOT NULL)
            )
        `);

        await queryInterface.addIndex('product_attributes', ['product_id'], {
            name: 'idx_product_attrs_product_id',
        });
        await queryInterface.addIndex('product_attributes', ['attribute_id'], {
            name: 'idx_product_attrs_attribute_id',
            where: { attribute_id: { [Sequelize.Op.ne]: null } },
        });
        await queryInterface.addIndex('product_attributes', ['is_variant_attr'], {
            name: 'idx_product_attrs_is_variant',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('product_attributes');
    },
};
