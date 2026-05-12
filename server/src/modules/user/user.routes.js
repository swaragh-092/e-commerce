'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { 
  updateProfileSchema, 
  changePasswordSchema, 
  updateAvatarSchema,
  updateStatusSchema,
  createAddressSchema,
  updateAddressSchema
} = require('./user.validation');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema } = require('../../utils/common.validation');


const userController = require('./user.controller');

// Profile Endpoints
router.get('/me', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), userController.getMe);
router.put('/me', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(updateProfileSchema), userController.updateMe);
router.post('/me/avatar', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(updateAvatarSchema), userController.updateAvatar);
router.put('/me/password', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(changePasswordSchema), userController.changePassword);

// Address Endpoints
router.get('/me/addresses', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), userController.getAddresses);
router.post('/me/addresses', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(createAddressSchema), userController.createAddress);
router.put('/me/addresses/:id', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(idParamSchema, 'params'), validate(updateAddressSchema), userController.updateAddress);
router.delete('/me/addresses/:id', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(idParamSchema, 'params'), userController.deleteAddress);
router.put('/me/addresses/:id/default', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(idParamSchema, 'params'), userController.setDefaultAddress);


// Admin Endpoints
router.get('/', authenticate, authorizePermissions(PERMISSIONS.CUSTOMERS_READ), userController.list);
router.get('/:id', authenticate, authorizePermissions(PERMISSIONS.CUSTOMERS_READ), validate(idParamSchema, 'params'), userController.getOne);
router.put('/:id/status', authenticate, authorizePermissions(PERMISSIONS.CUSTOMERS_MANAGE), validate(idParamSchema, 'params'), validate(updateStatusSchema), userController.updateStatus);


module.exports = router;
