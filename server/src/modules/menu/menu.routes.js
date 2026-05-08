'use strict';

const express = require('express');
const menuController = require('./menu.controller');
const menuValidation = require('./menu.validation');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizeAnyPermission, authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { auditLog } = require('../audit/audit.middleware');

const { publicApiLimiter } = require('../../middleware/rateLimiter.middleware');


const router = express.Router();

router.get('/public/:location', publicApiLimiter, validate(menuValidation.getPublicMenuSchema, 'params'), menuController.getPublicMenu);



router.get(
    '/',
    authenticate,
    authorizeAnyPermission(PERMISSIONS.MENUS_READ, PERMISSIONS.MENUS_MANAGE),
    validate(menuValidation.queryMenusSchema, 'query'),
    menuController.adminGetMenus
);

router.put(
    '/reorder',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('Menu'),
    validate(menuValidation.reorderMenusSchema),
    menuController.adminReorderMenus
);

router.put(
    '/move',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('Menu'),
    validate(menuValidation.moveItemsSchema),
    menuController.adminMoveMenuItems
);

router.post(
    '/',

    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('Menu'),
    validate(menuValidation.createMenuSchema),
    menuController.adminCreateMenu
);



router.get(
    '/:id',
    authenticate,
    authorizeAnyPermission(PERMISSIONS.MENUS_READ, PERMISSIONS.MENUS_MANAGE),
    validate(menuValidation.idParamSchema, 'params'),
    menuController.adminGetMenuById
);


router.put(
    '/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('Menu'),
    validate(menuValidation.idParamSchema, 'params'),
    validate(menuValidation.updateMenuSchema),
    menuController.adminUpdateMenu
);



router.delete(
    '/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('Menu'),
    validate(menuValidation.idParamSchema, 'params'),
    menuController.adminDeleteMenu
);



router.post(
    '/:menuId/items',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('MenuItem'),
    validate(menuValidation.menuIdParamSchema, 'params'),
    validate(menuValidation.createMenuItemSchema),
    menuController.adminCreateMenuItem
);



router.put(
    '/:menuId/items/reorder',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('MenuItem'),
    validate(menuValidation.menuIdParamSchema, 'params'),
    validate(menuValidation.reorderItemsSchema),
    menuController.adminReorderMenuItems
);



router.put(
    '/:menuId/items/:itemId',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('MenuItem'),
    validate(menuValidation.menuItemIdParamSchema, 'params'),
    validate(menuValidation.updateMenuItemSchema),
    menuController.adminUpdateMenuItem
);



router.delete(
    '/:menuId/items/:itemId',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('MenuItem'),
    validate(menuValidation.menuItemIdParamSchema, 'params'),
    menuController.adminDeleteMenuItem
);
 
router.delete(
    '/:menuId/items',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('MenuItem'),
    validate(menuValidation.menuIdParamSchema, 'params'),
    validate(menuValidation.bulkDeleteItemsSchema),
    menuController.adminBulkDeleteMenuItems
);



router.post(
    '/:id/restore',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('Menu'),
    validate(menuValidation.idParamSchema, 'params'),
    menuController.adminRestoreMenu
);


router.post(
    '/:menuId/items/:itemId/restore',
    authenticate,
    authorizePermissions(PERMISSIONS.MENUS_MANAGE),
    auditLog('MenuItem'),
    validate(menuValidation.menuItemIdParamSchema, 'params'),
    menuController.adminRestoreMenuItem
);




module.exports = router;
