'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('galleries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
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
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable('gallery_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      gallery_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'galleries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      media_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'media', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint('gallery_items', {
      fields: ['gallery_id', 'media_id'],
      type: 'unique',
      name: 'gallery_items_gallery_media_unique',
    });

    await queryInterface.addIndex('gallery_items', ['gallery_id', 'priority'], {
      name: 'gallery_items_gallery_priority_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('gallery_items');
    await queryInterface.dropTable('galleries');
  },
};
