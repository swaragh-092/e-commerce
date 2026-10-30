'use strict';
const router = require('express').Router();
const service = require('./tag.service');
const { tagWriteSchema, tagListSchema, bulkProductTagsSchema, tagSlugSchema } = require('./tag.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions, authorizeAnyPermission } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { idParamSchema } = require('../../utils/common.validation');
const { PERMISSIONS } = require('../../config/permissions');
const { success, paginated } = require('../../utils/response');

router.get('/public/:slug', validate(tagSlugSchema, 'params'), async (req, res, next) => {
  try { return success(res, await service.getPublicTagBySlug(req.params.slug)); }
  catch (err) { next(err); }
});
router.use(authenticate);
router.get('/', authorizeAnyPermission(PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_UPDATE), validate(tagListSchema, 'query'), async (req, res, next) => {
  try {
    const { rows, count } = await service.listTags(req.query);
    return paginated(res, rows, count, req.query.page, req.query.limit);
  } catch (err) { next(err); }
});
router.post('/', authorizeAnyPermission(PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_UPDATE), validate(tagWriteSchema), auditLog('Tag'), async (req, res, next) => {
  try { return success(res, await service.addTag(req.validated.name, req.validated.description, req.validated.imageId), 'Tag created', 201); }
  catch (err) { next(err); }
});
router.patch('/products', authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE), validate(bulkProductTagsSchema), auditLog('Product'), async (req, res, next) => {
  try {
    const result = await service.bulkUpdateProductTags(req.validated);
    req._auditChanges = { ...req.validated, ...result };
    return success(res, result, 'Product tags updated');
  } catch (err) { next(err); }
});
router.patch('/:id', authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE), validate(idParamSchema, 'params'), validate(tagWriteSchema), auditLog('Tag'), async (req, res, next) => {
  try { return success(res, await service.renameTag(req.params.id, req.validated.name, req.validated.description, req.validated.imageId), 'Tag renamed'); }
  catch (err) { next(err); }
});
router.delete('/:id', authorizePermissions(PERMISSIONS.PRODUCTS_DELETE), validate(idParamSchema, 'params'), auditLog('Tag'), async (req, res, next) => {
  try { await service.deleteTag(req.params.id); return success(res, null, 'Tag deleted. Products are unchanged.'); }
  catch (err) { next(err); }
});
module.exports = router;
