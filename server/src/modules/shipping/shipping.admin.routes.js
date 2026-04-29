'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const shippingController = require('./shipping.controller');
const {
    providerUpdateSchema,
    zoneSchema,
    zoneUpdateSchema,
    ruleSchema,
    ruleUpdateSchema,
} = require('./shipping.validation');

const manageShipping = [
    authenticate,
    authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
];

router.get('/shipping/providers', ...manageShipping, shippingController.listProviders);
router.patch('/shipping/providers/:id', ...manageShipping, validate(providerUpdateSchema), shippingController.updateProvider);

router.get('/shipping/zones', ...manageShipping, shippingController.listZones);
router.post('/shipping/zones', ...manageShipping, validate(zoneSchema), shippingController.createZone);
router.patch('/shipping/zones/:id', ...manageShipping, validate(zoneUpdateSchema), shippingController.updateZone);
router.delete('/shipping/zones/:id', ...manageShipping, shippingController.deleteZone);

router.get('/shipping/rules', ...manageShipping, shippingController.listRules);
router.post('/shipping/rules', ...manageShipping, validate(ruleSchema), shippingController.createRule);
router.patch('/shipping/rules/:id', ...manageShipping, validate(ruleUpdateSchema), shippingController.updateRule);
router.delete('/shipping/rules/:id', ...manageShipping, shippingController.deleteRule);

module.exports = router;
