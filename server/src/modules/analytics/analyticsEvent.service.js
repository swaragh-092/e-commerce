'use strict';

const { sequelize } = require('../index');
const { v4: uuidv4 } = require('uuid');

const recordEvent = async ({ eventName, userId = null, sessionId = null, checkoutSessionId = null, productId = null }) => {
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
