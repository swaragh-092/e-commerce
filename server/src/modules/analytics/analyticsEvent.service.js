'use strict';

const { getResolvedFeature } = require('../../middleware/featureGate.middleware');
const { sequelize } = require('../index');
const { v4: uuidv4 } = require('uuid');

const recordEvent = async ({ eventName, userId = null, sessionId = null, checkoutSessionId = null, productId = null }) => {
  if (!await getResolvedFeature('analytics')) return;
  const feature = eventName === 'checkout_started' ? 'checkout' : 'cart';
  if (!await getResolvedFeature(feature)) return;
  await sequelize.query(`
    INSERT INTO storefront_analytics_events
      (id, event_name, user_id, session_id, checkout_session_id, product_id, created_at)
    VALUES
      (:id, :eventName, :userId, :sessionId, :checkoutSessionId, :productId, NOW())
    ON CONFLICT (event_name, checkout_session_id) DO NOTHING
  `, {
    replacements: {
      id: uuidv4(),
      eventName,
      userId,
      sessionId,
      checkoutSessionId,
      productId,
    },
  });
};

module.exports = { recordEvent };
