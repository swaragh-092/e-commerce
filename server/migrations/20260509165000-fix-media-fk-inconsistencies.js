'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Fix missing index on product_variants.media_id (Issue 6)
    await queryInterface.addIndex('product_variants', ['media_id'], {
      name: 'idx_product_variants_media',
    });

    // 2. Fix inconsistency in product_images.media_id FK (Issue 5)
    // To update onUpdate behavior in Postgres, we typically need to drop and recreate the constraint
    // But since this is a schema hardening task, we will add the index first and then ensure the column definition is consistent
    await queryInterface.changeColumn('product_images', 'media_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'media',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert product_images.media_id to original state (no onUpdate CASCADE)
    await queryInterface.changeColumn('product_images', 'media_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'media',
        key: 'id',
      },
      onDelete: 'SET NULL',
    });

    // Remove the index from product_variants
    await queryInterface.removeIndex('product_variants', 'idx_product_variants_media');
  },
};
