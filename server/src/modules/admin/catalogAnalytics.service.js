'use strict';

const db = require('../index');
const { resolveDateRange } = require('./analytics.service');

const getCatalogOverview = async ({ period = '30d' } = {}) => {
  const options = { type: db.sequelize.QueryTypes.SELECT };
  const tables = await db.sequelize.query("SELECT to_regclass('public.page_visits') AS t", options);
  const empty = { visits: 0, sessions: 0, productViews: 0, enquiries: 0, convertedEnquiries: 0, openEnquiries: 0, trend: [], topViews: [], topEnquiries: [], trafficSources: [], campaigns: [] };
  const trackingAvailable = Boolean(tables[0]?.t);

  const { start, end } = resolveDateRange(period);
  // A date-filtered CTE is shared by every aggregate; no commerce or customer
  // data is queried by this endpoint, which requires dashboard access only.
  const rows = await db.sequelize.query(`
    WITH visits AS (
      ${trackingAvailable ? `SELECT created_at, session_id, product_id, referrer_source, utm_source, utm_medium, utm_campaign
      FROM page_visits WHERE created_at BETWEEN :start AND :end
        AND path !~ '^/(admin|api)(/|$)'` : `SELECT NULL::timestamp AS created_at,
          NULL::text AS session_id, NULL::uuid AS product_id, NULL::text AS referrer_source,
          NULL::text AS utm_source, NULL::text AS utm_medium, NULL::text AS utm_campaign WHERE FALSE`}
    )
    SELECT
      COUNT(*)::int AS visits,
      COUNT(DISTINCT NULLIF(session_id, ''))::int AS sessions,
      COUNT(*) FILTER (WHERE product_id IS NOT NULL)::int AS "productViews",
      (SELECT COUNT(*)::int FROM enquiries e
        WHERE e.created_at BETWEEN :start AND :end AND e.deleted_at IS NULL) AS enquiries,
      (SELECT COUNT(*)::int FROM enquiries e
        WHERE e.created_at BETWEEN :start AND :end AND e.deleted_at IS NULL
          AND e.status = 'closed_converted') AS "convertedEnquiries",
      (SELECT COUNT(*)::int FROM enquiries e
        WHERE e.created_at BETWEEN :start AND :end AND e.deleted_at IS NULL
          AND e.status IN ('pending', 'responded')) AS "openEnquiries",
      COALESCE((SELECT jsonb_agg(t ORDER BY t.date) FROM (
        SELECT to_char(created_at, 'YYYY-MM-DD') AS date, COUNT(*)::int AS visits
        FROM visits GROUP BY to_char(created_at, 'YYYY-MM-DD')
      ) t), '[]'::jsonb) AS trend,
      COALESCE((SELECT jsonb_agg(t ORDER BY t.views DESC, t.name) FROM (
        SELECT p.id, p.name, COUNT(*)::int AS views FROM visits v
        JOIN products p ON p.id = v.product_id AND p.deleted_at IS NULL
        GROUP BY p.id, p.name ORDER BY views DESC, p.name LIMIT 10
      ) t), '[]'::jsonb) AS "topViews",
      COALESCE((SELECT jsonb_agg(t ORDER BY t.enquiries DESC, t.name) FROM (
        SELECT p.id, p.name, COUNT(*)::int AS enquiries,
          COUNT(*) FILTER (WHERE e.status = 'closed_converted')::int AS converted
        FROM enquiries e
        CROSS JOIN LATERAL (
          SELECT e.product_id::text AS product_id WHERE e.product_id IS NOT NULL
          UNION
          SELECT item #>> '{product,id}'
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(e.cart_items) = 'array' THEN e.cart_items ELSE '[]'::jsonb END
          ) AS items(item)
          WHERE e.product_id IS NULL
        ) selected
        JOIN products p ON p.id::text = selected.product_id AND p.deleted_at IS NULL
        WHERE e.created_at BETWEEN :start AND :end AND e.deleted_at IS NULL
        GROUP BY p.id, p.name ORDER BY enquiries DESC, p.name LIMIT 10
      ) t), '[]'::jsonb) AS "topEnquiries",
      COALESCE((SELECT jsonb_agg(t ORDER BY t.visits DESC, t.source) FROM (
        SELECT COALESCE(NULLIF(referrer_source, ''), 'Direct') AS source, COUNT(*)::int AS visits
        FROM visits GROUP BY source ORDER BY visits DESC, source LIMIT 10
      ) t), '[]'::jsonb) AS "trafficSources",
      COALESCE((SELECT jsonb_agg(t ORDER BY t.visits DESC, t.source, t.medium, t.campaign) FROM (
        SELECT utm_source AS source, utm_medium AS medium, utm_campaign AS campaign, COUNT(*)::int AS visits
        FROM visits WHERE NULLIF(utm_source, '') IS NOT NULL
        GROUP BY utm_source, utm_medium, utm_campaign
        ORDER BY visits DESC, source, medium, campaign LIMIT 20
      ) t), '[]'::jsonb) AS campaigns,
      COALESCE((SELECT jsonb_agg(t ORDER BY t.enquiries DESC, t.source, t.medium, t.campaign) FROM (
        SELECT COALESCE(NULLIF(utm_source, ''), 'Unattributed') AS source,
          COALESCE(NULLIF(utm_medium, ''), '—') AS medium,
          COALESCE(NULLIF(utm_campaign, ''), '—') AS campaign,
          COUNT(*)::int AS enquiries,
          COUNT(*) FILTER (WHERE status = 'closed_converted')::int AS converted
        FROM enquiries WHERE created_at BETWEEN :start AND :end AND deleted_at IS NULL
        GROUP BY source, medium, campaign ORDER BY enquiries DESC LIMIT 20
      ) t), '[]'::jsonb) AS "enquiryCampaigns"
    FROM visits
  `, { ...options, replacements: { start, end } });
  return { ...empty, ...rows[0], trackingAvailable };
};

module.exports = { getCatalogOverview };
