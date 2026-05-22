'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { loginLimiter } = require('../../middleware/rateLimiter.middleware');
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

// Delete Account (rate limited: 1 per minute via loginLimiter)
router.delete('/me', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), loginLimiter, validate(require('./user.validation').deleteAccountSchema), userController.deleteAccount);
router.post('/me/cancel-deletion', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), userController.cancelAccountDeletion);

// Session Management
router.get('/me/sessions', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), userController.getSessions);
router.delete('/me/sessions/:id', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), userController.revokeSession);
router.delete('/me/sessions', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), userController.revokeAllOtherSessions);

// Phone Change (OTP verified)
router.post('/me/phone/request', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(require('./user.validation').phoneChangeRequestSchema), userController.requestPhoneChange);
router.post('/me/phone/confirm', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(require('./user.validation').phoneChangeConfirmSchema), userController.confirmPhoneChange);

// Email Change (verify new email)
router.post('/me/email/request', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(require('./user.validation').emailChangeRequestSchema), userController.requestEmailChange);
router.post('/me/email/confirm', validate(require('./user.validation').emailChangeConfirmSchema), userController.confirmEmailChange);

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
router.post('/:id/force-logout', authenticate, authorizePermissions(PERMISSIONS.CUSTOMERS_MANAGE), validate(idParamSchema, 'params'), userController.forceLogout);


module.exports = router;
