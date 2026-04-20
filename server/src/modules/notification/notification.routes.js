'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { listTemplates, getTemplate, updateTemplate, sendTestEmail } = require('./notification.controller');

// All notification template endpoints require auth + settings manage permission
router.use(authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE));

router.get('/templates', listTemplates);
router.get('/templates/:name', getTemplate);
router.put('/templates/:name', updateTemplate);
router.post('/templates/test', sendTestEmail);

module.exports = router;
