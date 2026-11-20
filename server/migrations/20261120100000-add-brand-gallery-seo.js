'use strict';

const columns = (Sequelize) => ({
  meta_title: Sequelize.STRING(255),
  meta_description: Sequelize.TEXT,
  meta_keywords: Sequelize.STRING(500),
  og_image: Sequelize.STRING(500),
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ['brands', 'galleries']) {
        for (const [name, type] of Object.entries(columns(Sequelize))) {
          await queryInterface.addColumn(table, name, { type, allowNull: true }, { transaction });
        }
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ['brands', 'galleries']) {
        for (const name of ['meta_title', 'meta_description', 'meta_keywords', 'og_image']) {
          await queryInterface.removeColumn(table, name, { transaction });
        }
      }
    });
  },
};
