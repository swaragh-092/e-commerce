'use strict';

const MenuService = require('./menu.service');
const { success } = require('../../utils/response');

exports.getPublicMenu = async (req, res, next) => {
    try { 
        const menu = await MenuService.getPublicMenuByLocation(req.params.location);
        return success(res, menu, 'Menu retrieved successfully');
    } catch (err) {
        next(err);
    }
};
exports.getPublicCustomMenu = async (req, res, next) => {
    try {
        console.log(req.params);
        const menu = await MenuService.getPublicMenuBySlug(req.params.slug);
        return success(res, menu, 'Menu retrieved successfully');
    } catch (err) {
        next(err);
    }
};

exports.adminGetMenus = async (req, res, next) => {
    try {
        const menus = await MenuService.getMenus(req.query);
        return success(res, menus, 'Menus retrieved successfully');
    } catch (err) {
        next(err);
    }
};

exports.adminGetMenuById = async (req, res, next) => {
    try {
        const menu = await MenuService.getMenuById(req.params.id);
        return success(res, menu, 'Menu retrieved successfully');
    } catch (err) {
        next(err);
    }
};

exports.adminCreateMenu = async (req, res, next) => {
    try {
        const menu = await MenuService.createMenu(req.body);
        return success(res, menu, 'Menu created successfully', 201);
    } catch (err) {
        next(err);
    }
};

exports.adminUpdateMenu = async (req, res, next) => {
    try {
        const menu = await MenuService.updateMenu(req.params.id, req.body);
        return success(res, menu, 'Menu updated successfully');
    } catch (err) {
        next(err);
    }
};

exports.adminDeleteMenu = async (req, res, next) => {
    try {
        await MenuService.deleteMenu(req.params.id);
        return success(res, null, 'Menu deleted successfully');
    } catch (err) {
        next(err);
    }
};

exports.adminCreateMenuItem = async (req, res, next) => {
    try {
        const item = await MenuService.createMenuItem(req.params.menuId, req.body);
        return success(res, item, 'Menu item created successfully', 201);
    } catch (err) {
        next(err);
    }
};

exports.adminUpdateMenuItem = async (req, res, next) => {
    try {
        const item = await MenuService.updateMenuItem(req.params.menuId, req.params.itemId, req.body);
        return success(res, item, 'Menu item updated successfully');
    } catch (err) {
        next(err);
    }
};

exports.adminDeleteMenuItem = async (req, res, next) => {
    try {
        await MenuService.deleteMenuItem(req.params.menuId, req.params.itemId);
        return success(res, null, 'Menu item deleted successfully');
    } catch (err) {
        next(err);
    }
};
 
exports.adminBulkDeleteMenuItems = async (req, res, next) => {
    try {
        await MenuService.bulkDeleteMenuItems(req.params.menuId, req.body.itemIds);
        return success(res, null, 'Menu items deleted successfully');
    } catch (err) {
        next(err);
    }
};


exports.adminReorderMenuItems = async (req, res, next) => {
    try {
        const menu = await MenuService.reorderItems(req.params.menuId, req.body.items);
        return success(res, menu, 'Menu items reordered successfully');
    } catch (err) {
        next(err);
    }
};

exports.adminReorderMenus = async (req, res, next) => {
    try {
        await MenuService.reorderMenus(req.body.menus);
        return success(res, null, 'Menus reordered successfully');
    } catch (err) {
        next(err);
    }
};

exports.adminMoveMenuItems = async (req, res, next) => {
    try {
        await MenuService.moveItems(req.body.itemIds, req.body.targetMenuId);
        return success(res, null, 'Menu items moved successfully');
    } catch (err) {
        next(err);
    }
};

exports.adminRestoreMenu = async (req, res, next) => {
    try {
        const menu = await MenuService.restoreMenu(req.params.id);
        return success(res, menu, 'Menu restored successfully');
    } catch (err) {
        next(err);
    }
};

exports.adminRestoreMenuItem = async (req, res, next) => {
    try {
        const item = await MenuService.restoreMenuItem(req.params.menuId, req.params.itemId);
        return success(res, item, 'Menu item restored successfully');
    } catch (err) {
        next(err);
    }
};



