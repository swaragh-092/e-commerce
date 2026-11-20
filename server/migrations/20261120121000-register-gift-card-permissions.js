'use strict';

const { randomUUID } = require('node:crypto');
const { permissionDescriptions } = require('../../shared/authorization.json');

const permissions = {
    read: 'View gift cards',
    manage: 'Manage gift cards',
    issue: 'Issue gift cards',
    refund: 'Refund gift card purchases',
};

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (const [action, name] of Object.entries(permissions)) {
                const key = 'gift_cards.' + action;
                await queryInterface.sequelize.query(`
                    INSERT INTO permissions (id, key, name, permission_group, description, created_at, updated_at)
                    VALUES (:id, :key, :name, 'gift_cards', :description, now(), now())
                    ON CONFLICT (key) DO NOTHING
                `, { replacements: { id: randomUUID(), key, name, description: permissionDescriptions[key] }, transaction });
                await queryInterface.sequelize.query(`
                    INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
                    SELECT gen_random_uuid(), r.id, target.id, now(), now()
                    FROM roles r CROSS JOIN permissions target
                    WHERE target.key = :key AND (
                        r.slug = 'super_admin' OR (
                            EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                                    WHERE rp.role_id = r.id AND p.key IN ('settings.manage', 'settings.advanced'))
                            AND (:requiresRefund = false OR EXISTS (
                                SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                                WHERE rp.role_id = r.id AND p.key = 'orders.refund'
                            ))
                        )
                    )
                    ON CONFLICT (role_id, permission_id) DO NOTHING
                `, { replacements: { key, requiresRefund: action === 'issue' || action === 'refund' }, transaction });
            }
        });
    },

    async down() {
        // Preserve administrator changes to grants across rollback and reapplication.
    },
};
