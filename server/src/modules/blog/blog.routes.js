'use strict';

const express = require('express');
const blogController = require('./blog.controller');
const blogValidation = require('./blog.validation');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, slugParamSchema } = require('../../utils/common.validation');

const router = express.Router();

router.get('/posts', featureGate('blogs'), validate(blogValidation.queryBlogPostsSchema, 'query'), blogController.getPublicPosts);
router.get('/posts/:slug', featureGate('blogs'), validate(slugParamSchema, 'params'), blogController.getPublicPostBySlug);
router.get('/categories', featureGate('blogs'), blogController.getPublicCategories);
router.get('/categories/:slug', featureGate('blogs'), validate(slugParamSchema, 'params'), blogController.getPublicCategoryBySlug);

router.get(
  '/admin/posts',
  authenticate,
  authorizePermissions(PERMISSIONS.BLOGS_READ),
  validate(blogValidation.queryBlogPostsSchema, 'query'),
  blogController.adminGetPosts
);

router.get(
  '/admin/posts/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.BLOGS_READ),
  validate(idParamSchema, 'params'),
  blogController.adminGetPostById
);

router.post(
  '/admin/posts',
  authenticate,
  authorizePermissions(PERMISSIONS.BLOGS_MANAGE),
  featureGate('blogs'),
  validate(blogValidation.createBlogPostSchema),
  blogController.adminCreatePost
);

router.put(
  '/admin/posts/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.BLOGS_MANAGE),
  featureGate('blogs'),
  validate(idParamSchema, 'params'),
  validate(blogValidation.updateBlogPostSchema),
  blogController.adminUpdatePost
);

router.delete(
  '/admin/posts/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.BLOGS_MANAGE),
  featureGate('blogs'),
  validate(idParamSchema, 'params'),
  blogController.adminDeletePost
);

router.post(
  '/categories',
  authenticate,
  authorizePermissions(PERMISSIONS.BLOGS_MANAGE),
  featureGate('blogs'),
  validate(blogValidation.createBlogCategorySchema),
  blogController.adminCreateCategory
);

router.put(
  '/categories/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.BLOGS_MANAGE),
  featureGate('blogs'),
  validate(idParamSchema, 'params'),
  validate(blogValidation.updateBlogCategorySchema),
  blogController.adminUpdateCategory
);

router.delete(
  '/categories/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.BLOGS_MANAGE),
  featureGate('blogs'),
  validate(idParamSchema, 'params'),
  blogController.adminDeleteCategory
);

module.exports = router;
