'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add missing fields
    await queryInterface.addColumn('media', 'original_name', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('media', 'alt', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('media', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('media', 'caption', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    // Change size type to BIGINT
    await queryInterface.changeColumn('media', 'size', {
      type: Sequelize.BIGINT,
      allowNull: false,
    });

    // Add indexes
    await queryInterface.addIndex('media', ['mime_type'], {
      name: 'idx_media_mime_type',
    });
    await queryInterface.addIndex('media', ['provider'], {
      name: 'idx_media_provider',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('media', 'idx_media_mime_type');
    await queryInterface.removeIndex('media', 'idx_media_provider');

    // Revert size type to INTEGER (caution: may lose data if > 2GB)
    await queryInterface.changeColumn('media', 'size', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    // Remove columns
    await queryInterface.removeColumn('media', 'caption');
    await queryInterface.removeColumn('media', 'description');
    await queryInterface.removeColumn('media', 'alt');
    await queryInterface.removeColumn('media', 'original_name');
  },
};
