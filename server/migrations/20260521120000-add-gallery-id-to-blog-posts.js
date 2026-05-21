'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('blog_posts', 'gallery_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'galleries',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('blog_posts', ['gallery_id'], {
      name: 'idx_blog_posts_gallery_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('blog_posts', 'idx_blog_posts_gallery_id');
    await queryInterface.removeColumn('blog_posts', 'gallery_id');
  },
};
