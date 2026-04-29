'use strict';

const seoOverrideService = require('./seoOverride.service');
const { success } = require('../../utils/response');

class SeoOverrideController {
  async getAll(req, res, next) {
    try {
      const overrides = await seoOverrideService.getAll();
      return success(res, overrides);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const override = await seoOverrideService.getById(req.params.id);
      return success(res, override);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const override = await seoOverrideService.create(req.body);
      return success(res, override, 'SEO Override created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const override = await seoOverrideService.update(req.params.id, req.body);
      return success(res, override, 'SEO Override updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      await seoOverrideService.delete(req.params.id);
      return success(res, null, 'SEO Override deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SeoOverrideController();
