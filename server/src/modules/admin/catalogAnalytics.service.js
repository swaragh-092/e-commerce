'use strict';

const db = require('../index');
const { resolveDateRange } = require('./analytics.service');

const getCatalogOverview = async ({ period = '30d' } = {}) => {
  const options = { type: db.sequelize.QueryTypes.SELECT };
  const tables = await db.sequelize.query("SELECT to_regclass('public.page_visits') AS t", options);
  const empty = { visits: 0, sessions: 0, productViews: 0, trend: [], topViews: [], trafficSources: [], campaigns: [] };
  if (!tables[0]?.t) return { ...empty, trackingAvailable: false };

  const { start, end } = resolveDateRange(period);
  // A date-filtered CTE is shared by every aggregate; no commerce or customer
  // data is queried by this endpoint, which requires dashboard access only.
  const rows = await db.sequelize.query(`
    WITH visits AS (
      SELECT created_at, session_id, product_id, referrer_source, utm_source, utm_medium, utm_campaign
      FROM page_visits WHERE created_at BETWEEN :start AND :end
        AND path !~ '^/(admin|api)(/|$)'
    )
    SELECT
      COUNT(*)::int AS visits,
      COUNT(DISTINCT NULLIF(session_id, ''))::int AS sessions,
      COUNT(*) FILTER (WHERE product_id IS NOT NULL)::int AS "productViews",
      COALESCE((SELECT jsonb_agg(t ORDER BY t.date) FROM (
        SELECT to_char(created_at, 'YYYY-MM-DD') AS date, COUNT(*)::int AS visits
        FROM visits GROUP BY to_char(created_at, 'YYYY-MM-DD')
      ) t), '[]'::jsonb) AS trend,
      COALESCE((SELECT jsonb_agg(t ORDER BY t.views DESC, t.name) FROM (
        SELECT p.id, p.name, COUNT(*)::int AS views FROM visits v
        JOIN products p ON p.id = v.product_id AND p.deleted_at IS NULL
        GROUP BY p.id, p.name ORDER BY views DESC, p.name LIMIT 10
      ) t), '[]'::jsonb) AS "topViews",
      COALESCE((SELECT jsonb_agg(t ORDER BY t.visits DESC, t.source) FROM (
        SELECT COALESCE(NULLIF(referrer_source, ''), 'Direct') AS source, COUNT(*)::int AS visits
        FROM visits GROUP BY source ORDER BY visits DESC, source LIMIT 10
      ) t), '[]'::jsonb) AS "trafficSources",
      COALESCE((SELECT jsonb_agg(t ORDER BY t.visits DESC, t.source, t.medium, t.campaign) FROM (
        SELECT utm_source AS source, utm_medium AS medium, utm_campaign AS campaign, COUNT(*)::int AS visits
        FROM visits WHERE NULLIF(utm_source, '') IS NOT NULL
        GROUP BY utm_source, utm_medium, utm_campaign
        ORDER BY visits DESC, source, medium, campaign LIMIT 20
      ) t), '[]'::jsonb) AS campaigns
    FROM visits
  `, { ...options, replacements: { start, end } });
  return { ...empty, ...rows[0], trackingAvailable: true };
};

module.exports = { getCatalogOverview };
