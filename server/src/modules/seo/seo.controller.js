'use strict';

const seoService = require('./seo.service');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');

class SeoController {
  async getSitemap(req, res, next) {
    try {
      const sitemap = await seoService.generateSitemap();
      res.header('Content-Type', 'application/xml');
      res.header('Cache-Control', 'public, max-age=3600');
      return res.send(sitemap);
    } catch (err) {
      logger.error('Sitemap generation error:', err);
      return error(res, 'INTERNAL_SERVER_ERROR', 500, 'Sitemap generation failed');
    }
  }

  async getRobots(req, res, next) {
    try {
      const robots = await seoService.generateRobots();
      res.header('Content-Type', 'text/plain');
      return res.send(robots);
    } catch (err) {
      logger.error('Robots generation error:', err);
      return error(res, 'INTERNAL_SERVER_ERROR', 500, 'Robots file generation failed');
    }
  }

  async getMetadata(req, res, next) {
    try {
      const { path: urlPath } = req.query;
      if (!urlPath) {
        return error(res, 'BAD_REQUEST', 400, 'Path query parameter is required');
      }
      const metadata = await seoService.getMetadataByPath(urlPath);
      return success(res, metadata);
    } catch (err) {
      logger.error('Metadata fetch error:', err);
      return error(res, 'INTERNAL_SERVER_ERROR', 500, 'Failed to fetch SEO metadata');
    }
  }
}

module.exports = new SeoController();
