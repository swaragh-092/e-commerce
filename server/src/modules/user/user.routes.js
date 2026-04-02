'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { 
  updateProfileSchema, 
  changePasswordSchema, 
  updateStatusSchema 
} = require('./user.validation');

const userController = require('./user.controller');

// Profile Endpoints
router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, validate(updateProfileSchema), userController.updateMe);
router.put('/me/password', authenticate, validate(changePasswordSchema), userController.changePassword);

// Admin Endpoints
router.get('/', authenticate, authorize('admin', 'super_admin'), userController.list);
router.get('/:id', authenticate, authorize('admin', 'super_admin'), userController.getOne);
router.put('/:id/status', authenticate, authorize('admin', 'super_admin'), validate(updateStatusSchema), userController.updateStatus);

module.exports = router;
