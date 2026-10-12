'use strict';

// The storefront creates guest session IDs with uuidv4(). Treat the value as
// a bearer capability and reject short/predictable IDs at every API boundary.
const GUEST_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isGuestSessionId = (value) => typeof value === 'string' && GUEST_SESSION_ID_PATTERN.test(value);

module.exports = { isGuestSessionId };
