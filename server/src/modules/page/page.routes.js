'use strict';

const express = require('express');
const pageController = require('./page.controller');
const pageValidation = require('./page.validation');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizeAnyPermission, authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const sanitizeHtml = require('sanitize-html');

const router = express.Router();

/**
 * Middleware: sanitizes all req.body fields EXCEPT 'content'.
 * The 'content' field is a trusted rich-HTML field handled by sanitizeRichText() in the service.
 */
const sanitizeBodyExceptContent = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        const sanitized = {};
        for (const [k, v] of Object.entries(req.body)) {
            if (k === 'content') {
                sanitized[k] = v; // preserve HTML — service runs sanitizeRichText on it
            } else if (typeof v === 'string') {
                sanitized[k] = sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} });
            } else {
                sanitized[k] = v;
            }
        }
        req.body = sanitized;
    }
    next();
};

/**
 * Public Routes
 */
router.get('/public', pageController.getPublicPages);
router.get('/public/:slug', pageController.getPageBySlug);

/**
 * Admin Routes
 */
router.get(
    '/',
    authenticate,
    authorizeAnyPermission(PERMISSIONS.PAGES_READ, PERMISSIONS.PAGES_MANAGE),
    validate(pageValidation.queryPageSchema, 'query'),
    pageController.adminGetPages
);

router.get(
    '/:id',
    authenticate,
    authorizeAnyPermission(PERMISSIONS.PAGES_READ, PERMISSIONS.PAGES_MANAGE),
    pageController.adminGetPageById
);

router.post(
    '/',
    authenticate,
    authorizePermissions(PERMISSIONS.PAGES_MANAGE),
    sanitizeBodyExceptContent,
    validate(pageValidation.createPageSchema),
    pageController.adminCreatePage
);

router.put(
    '/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.PAGES_MANAGE),
    sanitizeBodyExceptContent,
    validate(pageValidation.updatePageSchema),
    pageController.adminUpdatePage
);

router.delete(
    '/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.PAGES_MANAGE),
    pageController.adminDeletePage
);

module.exports = router;
