'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('galleries', 'is_showcase', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    // Preserve the gallery already used by the static site; blog galleries stay private to posts.
    await queryInterface.bulkUpdate('galleries', { is_showcase: true }, { slug: 'gallery' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('galleries', 'is_showcase');
  },
};
