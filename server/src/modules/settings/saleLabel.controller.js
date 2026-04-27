'use strict';

const SaleLabelService = require('./saleLabel.service');
const { success } = require('../../utils/response');

/**
 * GET /api/settings/sale-labels
 * Public — returns the active preset catalog for dropdown population.
 */
const list = async (req, res, next) => {
  try {
    const labels = await SaleLabelService.getSaleLabels();
    return success(res, labels);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/settings/sale-labels
 * Admin — append a new label to the catalog.
 */
const create = async (req, res, next) => {
  try {
    const label = await SaleLabelService.createSaleLabel(req.body, req.user.id);
    return success(res, label, 'Sale label created', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/settings/sale-labels
 * Admin — replace the entire catalog (for drag-to-reorder saves).
 */
const replaceAll = async (req, res, next) => {
  try {
    const labels = await SaleLabelService.replaceSaleLabels(req.body, req.user.id);
    return success(res, labels, 'Sale labels updated');
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/settings/sale-labels/:id
 * Admin — update name / color / priority / isActive of a single label.
 */
const update = async (req, res, next) => {
  try {
    const label = await SaleLabelService.updateSaleLabel(req.params.id, req.body, req.user.id);
    return success(res, label, 'Sale label updated');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/settings/sale-labels/:id
 * Admin — remove a label from the catalog.
 */
const remove = async (req, res, next) => {
  try {
    await SaleLabelService.deleteSaleLabel(req.params.id, req.user.id);
    return success(res, null, 'Sale label deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { list, create, replaceAll, update, remove };
