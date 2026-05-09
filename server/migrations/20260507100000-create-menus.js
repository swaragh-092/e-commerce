'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { ROLES } = require('../src/config/constants');
const { PERMISSIONS } = require('../src/config/permissions');

const now = new Date();

const ensurePermission = async (queryInterface, key, name, description) => {
    const existing = await queryInterface.sequelize.query(
        'SELECT id FROM permissions WHERE key = :key LIMIT 1',
        { type: QueryTypes.SELECT, replacements: { key } }
    );

    if (existing[0]?.id) return existing[0].id;

    const id = crypto.randomUUID();
    await queryInterface.bulkInsert('permissions', [{
        id,
        key,
        name,
        permission_group: 'menus',
        description,
        created_at: now,
        updated_at: now,
    }]);
    return id;
};

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('menus', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            name: { type: Sequelize.STRING(120), allowNull: false },
            slug: { type: Sequelize.STRING(120), allowNull: false, unique: true },
            location: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'header' },
            is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            deleted_at: { type: Sequelize.DATE, allowNull: true },
        });

        await queryInterface.createTable('menu_items', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            menu_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'menus', key: 'id' },
                onDelete: 'CASCADE',
            },
            parent_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'menu_items', key: 'id' },
                onDelete: 'CASCADE',
            },
            label: { type: Sequelize.STRING(120), allowNull: false },
            target_type: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'custom_url' },
            target_id: { type: Sequelize.UUID, allowNull: true },
            url: { type: Sequelize.STRING(1000), allowNull: true },
            placement: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'center' },
            sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            is_visible: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            open_in_new_tab: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            deleted_at: { type: Sequelize.DATE, allowNull: true },
        });

        await queryInterface.addIndex('menus', ['location', 'is_active'], { name: 'idx_menus_location_active' });
        await queryInterface.addIndex('menu_items', ['menu_id', 'parent_id'], { name: 'idx_menu_items_menu_parent' });
        await queryInterface.addIndex('menu_items', ['placement', 'sort_order'], { name: 'idx_menu_items_placement_sort' });

        const headerMenuId = crypto.randomUUID();
        const footerMenuId = crypto.randomUUID();
        await queryInterface.bulkInsert('menus', [
            { id: headerMenuId, name: 'Header Menu', slug: 'header-menu', location: 'header', is_active: true, sort_order: 0, created_at: now, updated_at: now },
            { id: footerMenuId, name: 'Footer Quick Links', slug: 'footer-quick-links', location: 'footer', is_active: true, sort_order: 0, created_at: now, updated_at: now },
        ]);

        const menuItems = [
            { id: crypto.randomUUID(), menu_id: headerMenuId, label: 'Home', target_type: 'system_route', url: '/', placement: 'center', sort_order: 0, is_visible: true, open_in_new_tab: false, created_at: now, updated_at: now },
            { id: crypto.randomUUID(), menu_id: headerMenuId, label: 'Shop', target_type: 'system_route', url: '/products', placement: 'center', sort_order: 10, is_visible: true, open_in_new_tab: false, created_at: now, updated_at: now },
        ];

        const topPages = await queryInterface.sequelize.query(
            "SELECT title, slug, sort_order FROM pages WHERE link_position = 'top' AND status = 'published' AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC",
            { type: QueryTypes.SELECT }
        );
        topPages.forEach((page, index) => {
            menuItems.push({
                id: crypto.randomUUID(),
                menu_id: headerMenuId,
                label: page.title,
                target_type: 'custom_url',
                url: `/p/${page.slug}`,
                placement: 'center',
                sort_order: 20 + index * 10,
                is_visible: true,
                open_in_new_tab: false,
                created_at: now,
                updated_at: now,
            });
        });

        const footerLinkSettings = await queryInterface.sequelize.query(
            "SELECT value FROM settings WHERE \"group\" = 'footer' AND key = 'links' LIMIT 1",
            { type: QueryTypes.SELECT }
        );
        const footerLinks = Array.isArray(footerLinkSettings[0]?.value) ? footerLinkSettings[0].value : [];
        footerLinks.forEach((link, index) => {
            if (!link?.label) return;
            menuItems.push({
                id: crypto.randomUUID(),
                menu_id: footerMenuId,
                label: link.label,
                target_type: 'custom_url',
                url: link.url || '/',
                placement: 'quick_links',
                sort_order: index * 10,
                is_visible: true,
                open_in_new_tab: Boolean(link.openInNewTab),
                created_at: now,
                updated_at: now,
            });
        });

        const bottomPages = await queryInterface.sequelize.query(
            "SELECT title, slug, sort_order FROM pages WHERE link_position = 'bottom' AND status = 'published' AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC",
            { type: QueryTypes.SELECT }
        );
        bottomPages.forEach((page, index) => {
            menuItems.push({
                id: crypto.randomUUID(),
                menu_id: footerMenuId,
                label: page.title,
                target_type: 'custom_url',
                url: `/p/${page.slug}`,
                placement: 'quick_links',
                sort_order: footerLinks.length * 10 + index * 10,
                is_visible: true,
                open_in_new_tab: false,
                created_at: now,
                updated_at: now,
            });
        });

        await queryInterface.bulkInsert('menu_items', menuItems);

        const menuReadId = await ensurePermission(queryInterface, PERMISSIONS.MENUS_READ, 'Menus Read', 'View navigation menus');
        const menuManageId = await ensurePermission(queryInterface, PERMISSIONS.MENUS_MANAGE, 'Menus Manage', 'Create, edit, delete, and reorder navigation menus');

        const roles = await queryInterface.sequelize.query(
            'SELECT id FROM roles WHERE slug IN (:slugs)',
            { type: QueryTypes.SELECT, replacements: { slugs: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } }
        );

        for (const role of roles) {
            for (const permissionId of [menuReadId, menuManageId]) {
                const existing = await queryInterface.sequelize.query(
                    'SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1',
                    { type: QueryTypes.SELECT, replacements: { roleId: role.id, permissionId } }
                );
                if (!existing[0]?.id) {
                    await queryInterface.bulkInsert('role_permissions', [{
                        id: crypto.randomUUID(),
                        role_id: role.id,
                        permission_id: permissionId,
                        created_at: now,
                        updated_at: now,
                    }]);
                }
            }
        }
    },

    async down(queryInterface) {
        await queryInterface.dropTable('menu_items');
        await queryInterface.dropTable('menus');

        const keys = [PERMISSIONS.MENUS_READ, PERMISSIONS.MENUS_MANAGE];
        const permissions = await queryInterface.sequelize.query(
            'SELECT id FROM permissions WHERE key IN (:keys)',
            { type: QueryTypes.SELECT, replacements: { keys } }
        );
        const ids = permissions.map((permission) => permission.id);
        if (ids.length) {
            await queryInterface.sequelize.query('DELETE FROM role_permissions WHERE permission_id IN (:ids)', { replacements: { ids } });
            await queryInterface.sequelize.query('DELETE FROM permissions WHERE id IN (:ids)', { replacements: { ids } });
        }
    },
};
