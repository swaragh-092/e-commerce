'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../modules/index');
const logger = require('../utils/logger');

/**
 * Extracts a clean referrer source domain from the Referer header.
 * Returns empty string for same-origin or missing referrer (treated as "Direct").
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
 * Lightweight page visit tracking middleware.
 * Only tracks GET requests to storefront pages (not API, not assets).
 * Fires asynchronously — never blocks the response.
 */
const trackVisit = (req, res, next) => {
  next();

  // Only track GET, skip API/assets/admin
  if (req.method !== 'GET') return;
  const p = req.path;
  if (p.startsWith('/api') || p.startsWith('/uploads') || p.startsWith('/health') || p.includes('.')) return;

  const source = extractSource(req.get('referer'), req.get('host'));

  setImmediate(async () => {
    try {
      await db.sequelize.query(
        `INSERT INTO page_visits (id, path, referrer_source, user_id, session_id, ip, created_at)
         VALUES (:id, :path, :source, :userId, :sessionId, :ip, NOW())`,
        {
          replacements: {
            id: uuidv4(),
            path: p.substring(0, 500),
            source: source.substring(0, 255) || null,
            userId: req.user?.id || null,
            sessionId: req.cookies?.sessionId || null,
            ip: req.ip || null,
          },
          type: db.sequelize.QueryTypes.INSERT,
        }
      );
    } catch (err) {
      // Silently fail — tracking should never break the app
      logger.debug('Visit tracking insert failed:', err.message);
    }
  });
};

module.exports = { trackVisit };
