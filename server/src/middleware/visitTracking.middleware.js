'use strict';

const { v4: uuidv4, validate: isUuid } = require('uuid');
const db = require('../modules/index');
const { getResolvedFeature } = require('./featureGate.middleware');
const logger = require('../utils/logger');

/**
 * Extracts a clean referrer source domain from the Referer header.
 */
const extractSource = (referer, host) => {
  if (!referer) return '';
  try {
    const url = new URL(referer);
    if (url.host === host) return '';
    return url.host;
  } catch {
    return '';
  }
};

/**
 * Extract product slug from path like /products/:slug or /product/:slug
 */
const extractProductSlug = (path) => {
  const match = path.match(/^\/products?\/([^/]+)$/);
  return match ? match[1] : null;
};

/**
 * Lightweight page visit tracking middleware.
 * Tracks GET requests to storefront pages. Captures UTM params and product page visits.
 * Writes visits asynchronously after assigning the storefront visitor cookie.
 */
const trackVisit = async (req, res, next) => {
  if (req.method !== 'GET' || !req.accepts('html')) return next();
  const p = req.path;
  if (/^\/(api|admin|uploads|health)(\/|$)/.test(p) || p.includes('.')) return next();
  try {
    if (!await getResolvedFeature('analytics')) return next();
  } catch (err) {
    logger.debug('Visit tracking feature lookup failed:', err.message);
    return next();
  }
  // Keep the ID recorded on the initial request when the storefront later sets its cart cookie.
  const existingId = [req.cookies?.analytics_visitor, req.cookies?.sessionId].find(isUuid);
  const sessionId = existingId || uuidv4();
  if (!existingId) {
    res.cookie('analytics_visitor', sessionId, {
      httpOnly: true, secure: req.secure, sameSite: 'lax', maxAge: 30 * 864e5,
    });
  }
  next();

  const source = extractSource(req.get('referer'), req.get('host'));
  const query = req.query || {};
  const utmSource = query.utm_source || null;
  const utmMedium = query.utm_medium || null;
  const utmCampaign = query.utm_campaign || null;
  const productSlug = extractProductSlug(p);

  setImmediate(async () => {
    try {
      // Resolve product_id from slug if this is a product page
      let productId = null;
      if (productSlug) {
        const [row] = await db.sequelize.query(
          `SELECT id FROM products WHERE slug = :slug LIMIT 1`,
          { replacements: { slug: productSlug }, type: db.sequelize.QueryTypes.SELECT }
        );
        productId = row?.id || null;
      }

      await db.sequelize.query(
        `INSERT INTO page_visits (id, path, referrer_source, user_id, session_id, user_agent, ip, product_id, utm_source, utm_medium, utm_campaign, created_at)
         VALUES (:id, :path, :source, :userId, :sessionId, :userAgent, :ip, :productId, :utmSource, :utmMedium, :utmCampaign, NOW())`,
        {
          replacements: {
            id: uuidv4(),
            path: p.substring(0, 500),
            source: source.substring(0, 255) || null,
            userId: req.user?.id || null,
            sessionId,
            userAgent: req.get('user-agent')?.substring(0, 500) || null,
            ip: req.ip || null,
            productId,
            utmSource: utmSource?.substring(0, 255) || null,
            utmMedium: utmMedium?.substring(0, 255) || null,
            utmCampaign: utmCampaign?.substring(0, 255) || null,
          },
          type: db.sequelize.QueryTypes.INSERT,
        }
      );
    } catch (err) {
      logger.debug('Visit tracking insert failed:', err.message);
    }
  });
};

module.exports = { trackVisit };
