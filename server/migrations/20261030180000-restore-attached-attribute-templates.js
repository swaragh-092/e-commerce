'use strict';

const attachedTemplates = `
    SELECT t.id
    FROM attribute_templates t
    WHERE t.deleted_at IS NOT NULL AND (
        EXISTS (SELECT 1 FROM product_attributes pa JOIN products p ON p.id = pa.product_id
                WHERE pa.attribute_id = t.id AND p.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM variant_options vo
                   JOIN product_variants v ON v.id = vo.variant_id
                   JOIN products p ON p.id = v.product_id
                   WHERE vo.attribute_id = t.id AND v.deleted_at IS NULL AND p.deleted_at IS NULL)
    )
`;

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query('LOCK TABLE attribute_templates IN SHARE ROW EXCLUSIVE MODE', { transaction });
            const [conflicts] = await queryInterface.sequelize.query(`
                WITH attached AS (${attachedTemplates})
                SELECT original.id
                FROM attribute_templates original
                JOIN attribute_templates other ON other.id <> original.id
                  AND (other.name = original.name OR other.slug = original.slug)
                WHERE original.id IN (SELECT id FROM attached)
                  AND (other.deleted_at IS NULL OR other.id IN (SELECT id FROM attached))
                LIMIT 1
            `, { transaction });
            if (conflicts.length) {
                throw new Error('Cannot restore an attached attribute because another active or attached template uses its name or slug. Resolve the duplicate name/slug and rerun this migration. No attributes or product links have been changed.');
            }
            await queryInterface.sequelize.query(`
                UPDATE attribute_templates SET deleted_at = NULL, updated_at = NOW()
                WHERE id IN (${attachedTemplates})
            `, { transaction });
        });
    },
    async down() {
        // Do not re-delete templates still used by products when rolling back a data repair.
    },
};
