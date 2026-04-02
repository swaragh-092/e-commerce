'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { 
  updateProfileSchema, 
  changePasswordSchema, 
  updateAvatarSchema,
  updateStatusSchema,
  createAddressSchema,
  updateAddressSchema
} = require('./user.validation');

const userController = require('./user.controller');

// Profile Endpoints
router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, validate(updateProfileSchema), userController.updateMe);
router.post('/me/avatar', authenticate, validate(updateAvatarSchema), userController.updateAvatar);
router.put('/me/password', authenticate, validate(changePasswordSchema), userController.changePassword);

// Address Endpoints
router.get('/me/addresses', authenticate, userController.getAddresses);
router.post('/me/addresses', authenticate, validate(createAddressSchema), userController.createAddress);
router.put('/me/addresses/:id', authenticate, validate(updateAddressSchema), userController.updateAddress);
router.delete('/me/addresses/:id', authenticate, userController.deleteAddress);
router.put('/me/addresses/:id/default', authenticate, userController.setDefaultAddress);

// Admin Endpoints
router.get('/', authenticate, authorize('admin', 'super_admin'), userController.list);
router.get('/:id', authenticate, authorize('admin', 'super_admin'), userController.getOne);
router.put('/:id/status', authenticate, authorize('admin', 'super_admin'), validate(updateStatusSchema), userController.updateStatus);

module.exports = router;
