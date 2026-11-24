'use strict';

const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../index');

const referrerSource = (referrer, origin) => {
  try {
    const url = new URL(referrer);
    return ['https:', 'http:'].includes(url.protocol) && url.origin !== origin ? url.hostname.slice(0, 255) : null;
  } catch {
    return null;
  }
};

const recordPageVisit = async (event, req) => {
  const { path, sessionId, referrer, utmSource, utmMedium, utmCampaign } = event;
  const slug = path === '/products.html'
    ? event.slug || null
    : path.match(/^\/products?\/([\w-]+)\/?$/)?.[1] || null;

  await sequelize.query(
    `INSERT INTO page_visits
       (id, path, referrer_source, session_id, user_agent, ip, product_id, utm_source, utm_medium, utm_campaign, created_at)
     VALUES (:id, :path, :source, :sessionId, :userAgent, :ip,
       (SELECT id FROM products WHERE slug = :slug AND status = 'published' AND is_enabled = true AND deleted_at IS NULL LIMIT 1),
       :utmSource, :utmMedium, :utmCampaign, NOW())`,
    {
      replacements: {
        id: uuidv4(),
        path,
        source: referrerSource(referrer, req.get('Origin')),
        sessionId,
        userAgent: req.get('User-Agent')?.slice(0, 500) || null,
        ip: req.ip || null,
        slug,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
      },
    }
  );
};

module.exports = { recordPageVisit };
