'use strict';

const productAssistantService = require('./productAssistant.service');
const { success } = require('../../utils/response');

exports.generate = async (req, res, next) => {
  try {
    const result = await productAssistantService.generateDraft(req.body);
    return success(res, result, 'AI draft generated');
  } catch (err) {
    next(err);
  }
};

exports.extractSpecs = async (req, res, next) => {
  try {
    const result = await productAssistantService.extractSpecsFromPdf(req.file);
    return success(res, result, 'Product specs extracted');
  } catch (err) {
    next(err);
  }
};
