'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('blog_post_categories', {
      blog_post_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'blog_posts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      blog_category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'blog_categories',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
        allowNull: false,
      },
    });

    await queryInterface.addIndex('blog_post_categories', ['blog_post_id'], {
      name: 'idx_blog_post_categories_blog_post_id',
    });
    await queryInterface.addIndex('blog_post_categories', ['blog_category_id'], {
      name: 'idx_blog_post_categories_blog_category_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('blog_post_categories');
  },
};
