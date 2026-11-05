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
      return error(res, 'Sitemap generation failed', 500, 'INTERNAL_SERVER_ERROR');
    }
  }

  async getRobots(req, res, next) {
    try {
      const robots = await seoService.generateRobots();
      res.header('Content-Type', 'text/plain');
      return res.send(robots);
    } catch (err) {
      logger.error('Robots generation error:', err);
      return error(res, 'Robots file generation failed', 500, 'INTERNAL_SERVER_ERROR');
    }
  }

  async getMetadata(req, res, next) {
    try {
      const { path: urlPath } = req.query;
      if (!urlPath) {
        return error(res, 'Path query parameter is required', 400, 'BAD_REQUEST');
      }
      const metadata = await seoService.getMetadataByPath(urlPath);
      return success(res, metadata);
    } catch (err) {
      logger.error('Metadata fetch error:', err);
      if (err.statusCode === 404) return error(res, err.message || 'SEO metadata not found', 404, 'NOT_FOUND');
      if (err.statusCode === 400) return error(res, err.message, 400, 'VALIDATION_ERROR');
      return error(res, 'Failed to fetch SEO metadata', 500, 'INTERNAL_SERVER_ERROR');
    }
  }

  async prerender(req, res, next) {
    try {
      const rawTarget = req.query.path || req.query.url || req.path || '/';
      let cleanTarget = '/';
      try {
        const parsed = new URL(String(rawTarget), 'http://localhost');
        cleanTarget = parsed.pathname;
      } catch {
        cleanTarget = '/';
      }
      const html = await seoService.renderHtmlForPath(cleanTarget);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      return res.status(200).send(html);
    } catch (err) {
      if (err.statusCode === 404) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Robots-Tag', 'noindex');
        return res.status(404).send('<!DOCTYPE html><html><head><title>Page not found</title><meta name="robots" content="noindex,nofollow"></head><body><h1>Page not found</h1><a href="/products">Browse products</a></body></html>');
      }
      logger.error('SEO prerender error:', err);
      return next(err);
    }
  }
}

module.exports = new SeoController();
