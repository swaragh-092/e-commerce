'use strict';

const express = require('express');
const menuController = require('./menu.controller');
const menuValidation = require('./menu.validation');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizeAnyPermission, authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.get('/public/:location', menuController.getPublicMenu);

router.get(
    '/',
    authenticate,
    authorizeAnyPermission(PERMISSIONS.MENUS_READ, PERMISSIONS.MENUS_MANAGE),
    validate(menuValidation.queryMenusSchema, 'query'),
    menuController.adminGetMenus
);

router.post(
    '/',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    validate(menuValidation.createMenuSchema),
    menuController.adminCreateMenu
);

router.get(
    '/:id',
    authenticate,
    authorizeAnyPermission(PERMISSIONS.MENUS_READ, PERMISSIONS.MENUS_MANAGE),
    menuController.adminGetMenuById
);

router.put(
    '/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    validate(menuValidation.updateMenuSchema),
    menuController.adminUpdateMenu
);

router.delete(
    '/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    menuController.adminDeleteMenu
);

router.post(
    '/:menuId/items',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    validate(menuValidation.createMenuItemSchema),
    menuController.adminCreateMenuItem
);

router.put(
    '/:menuId/items/reorder',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    validate(menuValidation.reorderItemsSchema),
    menuController.adminReorderMenuItems
);

router.put(
    '/:menuId/items/:itemId',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    validate(menuValidation.updateMenuItemSchema),
    menuController.adminUpdateMenuItem
);

router.delete(
    '/:menuId/items/:itemId',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    menuController.adminDeleteMenuItem
);

module.exports = router;
