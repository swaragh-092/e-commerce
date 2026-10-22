'use strict';

const standardUnits = require('../../shared/units.json');

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn('attribute_templates', 'unit_category', {
                type: Sequelize.STRING(50), allowNull: true,
            }, { transaction });
            const [settings] = await queryInterface.sequelize.query(
                "SELECT value FROM settings WHERE key = 'unitCatalog' AND \"group\" = 'catalog'", { transaction }
            );
            const catalog = new Map(standardUnits.map((unit) => [unit.value.toLowerCase(), unit]));
            for (const unit of Array.isArray(settings[0]?.value) ? settings[0].value : []) {
                if (unit && typeof unit.value === 'string') catalog.set(unit.value.toLowerCase(), unit);
            }
            // Preserve legacy defaults and value labels. Only add the category.
            for (const unit of catalog.values()) {
                if (unit.deleted || !unit.category) continue;
                await queryInterface.sequelize.query(`
                    UPDATE attribute_templates SET unit_category = :category
                    WHERE unit_category IS NULL AND LOWER(BTRIM(unit)) IN (:symbol, :label)
                `, { replacements: { category: unit.category, symbol: unit.value.toLowerCase(), label: (unit.label || unit.value).toLowerCase() }, transaction });
            }
        });
    },
    async down(queryInterface) {
        await queryInterface.removeColumn('attribute_templates', 'unit_category');
    },
};
