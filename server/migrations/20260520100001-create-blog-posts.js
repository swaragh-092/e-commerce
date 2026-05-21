'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('blog_posts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      featured_image_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'media',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      author_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.ENUM('draft', 'published'),
        allowNull: false,
        defaultValue: 'draft',
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      display_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      meta_title: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      meta_description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      meta_keywords: {
        type: Sequelize.STRING(500),
        allowNull: true,
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('blog_posts', ['slug'], { name: 'idx_blog_posts_slug' });
    await queryInterface.addIndex('blog_posts', ['status'], { name: 'idx_blog_posts_status' });
    await queryInterface.addIndex('blog_posts', ['author_id'], { name: 'idx_blog_posts_author_id' });
    await queryInterface.addIndex('blog_posts', ['published_at'], { name: 'idx_blog_posts_published_at' });
    await queryInterface.addIndex('blog_posts', ['display_date'], { name: 'idx_blog_posts_display_date' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('blog_posts');
    // Drop enum type if it exists (for PostgreSQL)
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_blog_posts_status CASCADE;');
    } catch (error) {
      // Enum may not exist on other databases; silently continue
    }
  },
};
