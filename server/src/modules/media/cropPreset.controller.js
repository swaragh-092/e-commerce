'use strict';
const service = require('./cropPreset.service');
const { success } = require('../../utils/response');
exports.list = async (req, res, next) => { try { return success(res, await service.list(), 'Crop presets found'); } catch (error) { next(error); } };
exports.create = async (req, res, next) => { try { return success(res, await service.create(req.validated), 'Crop preset saved', 201); } catch (error) { next(error); } };
exports.update = async (req, res, next) => { try { return success(res, await service.update(req.params.id, req.validated), 'Crop preset updated'); } catch (error) { next(error); } };
exports.remove = async (req, res, next) => { try { return success(res, await service.remove(req.params.id), 'Crop preset removed'); } catch (error) { next(error); } };
exports.restore = async (req, res, next) => { try { return success(res, await service.restore(req.params.id), 'Crop preset restored'); } catch (error) { next(error); } };
