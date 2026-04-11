'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('pages', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true
            },
            title: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            slug: {
                type: Sequelize.STRING(255),
                allowNull: false,
                unique: true
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            link_position: {
                type: Sequelize.STRING(20),
                defaultValue: 'none',
                allowNull: false
            },
            link_placement: {
                type: Sequelize.STRING(50),
                allowNull: true
            },
            meta_title: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            meta_description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            banner_url: {
                type: Sequelize.STRING(1000),
                allowNull: true
            },
            status: {
                type: Sequelize.STRING(20),
                defaultValue: 'draft',
                allowNull: false
            },
            is_system: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false
            },
            sort_order: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('NOW()'),
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('NOW()'),
                allowNull: false
            },
            deleted_at: {
                type: Sequelize.DATE,
                allowNull: true
            }
        });

        await queryInterface.addIndex('pages', ['slug'], { name: 'idx_pages_slug' });
        await queryInterface.addIndex('pages', ['link_position'], { name: 'idx_pages_link_position' });
        await queryInterface.addIndex('pages', ['status'], { name: 'idx_pages_status' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('pages');
    }
};
