'use strict';

const ApiBuilderService = require('./apiBuilder.service');
const { success } = require('../../utils/response');

exports.list = async (req, res, next) => {
  try {
    const apis = await ApiBuilderService.list(req.query);
    return success(res, apis, 'API definitions retrieved successfully');
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const api = await ApiBuilderService.getById(req.params.id);
    return success(res, api, 'API definition retrieved successfully');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const api = await ApiBuilderService.create(req.body, req.user?.id);
    return success(res, api, 'API definition created successfully', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const api = await ApiBuilderService.update(req.params.id, req.body, req.user?.id);
    return success(res, api, 'API definition updated successfully');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await ApiBuilderService.remove(req.params.id);
    return success(res, null, 'API definition deleted successfully');
  } catch (error) {
    next(error);
  }
};

exports.preview = async (req, res, next) => {
  try {
    const data = await ApiBuilderService.executeConfig(req.body.config, { preview: true, query: req.body.query || {} });
    return success(res, data, 'API preview generated successfully');
  } catch (error) {
    next(error);
  }
};

exports.executeBySlug = async (req, res, next) => {
  try {
    const data = await ApiBuilderService.executeBySlug(req.params.slug, req.query || {});
    return success(res, data, 'Custom API generated successfully');
  } catch (error) {
    next(error);
  }
};
