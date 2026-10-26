'use strict';

const seoService = require('../modules/seo/seo.service');
const logger = require('../utils/logger');

// Known social media crawlers and search engine indexing bots
const CRAWLER_USER_AGENTS = [
  'facebookexternalhit',
  'facebot',
  'whatsapp',
  'twitterbot',
  'linkedinbot',
  'telegrambot',
  'slackbot',
  'discordbot',
  'pinterest',
  'googlebot',
  'google-inspectiontool',
  'bingbot',
  'applebot',
  'yandex',
  'duckduckbot',
  'baiduspider',
  'embedly',
  'quora link preview',
  'outbrain',
  'vkshare',
  'w3c_validator',
];

const CRAWLER_REGEX = new RegExp(CRAWLER_USER_AGENTS.join('|'), 'i');

const isCrawler = (userAgent) => {
  if (!userAgent || typeof userAgent !== 'string') return false;
  return CRAWLER_REGEX.test(userAgent);
};

/**
 * Express middleware to intercept social media and search crawler requests
 * and serve dynamically pre-rendered HTML with full Open Graph, Twitter cards,
 * Schema.org JSON-LD, and meta tags.
 */
const crawlerPrerender = async (req, res, next) => {
  if (req.method !== 'GET') return next();

  // Strip query params to check path safely
  const rawPath = req.originalUrl || req.url || '/';
  let cleanPath = '/';
  try {
    const parsed = new URL(String(rawPath), 'http://localhost');
    cleanPath = parsed.pathname;
  } catch {
    cleanPath = '/';
  }

  // Skip API routes, admin routes, static assets, uploads, and health endpoints
  if (
    cleanPath.startsWith('/api') ||
    cleanPath.startsWith('/uploads') ||
    cleanPath.startsWith('/health') ||
    cleanPath.startsWith('/admin') ||
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|json|map|xml|txt)$/i.test(cleanPath)
  ) {
    return next();
  }

  const userAgent = req.headers['user-agent'] || '';
  const forcePrerender = req.query.prerender === 'true' || req.query._escaped_fragment_ !== undefined;

  if (isCrawler(userAgent) || forcePrerender) {
    try {
      const html = await seoService.renderHtmlForPath(cleanPath);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      return res.status(200).send(html);
    } catch (err) {
      logger.error(`[crawlerPrerender] Failed to pre-render for path "${cleanPath}":`, err);
      return next();
    }
  }

  return next();
};

module.exports = {
  crawlerPrerender,
  isCrawler,
  CRAWLER_USER_AGENTS,
};
