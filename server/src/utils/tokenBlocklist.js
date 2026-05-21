'use strict';

/**
 * In-memory access token blocklist.
 * Entries auto-expire after ACCESS_TOKEN_TTL (default 15min).
 * In a multi-process/cluster deployment, replace with Redis SET + TTL.
 */
const blocklist = new Map();
const TTL_MS = 15 * 60 * 1000; // 15 minutes (matches access token expiry)

const add = (jti) => {
  blocklist.set(jti, Date.now() + TTL_MS);
};

const isBlocked = (jti) => {
  const expiry = blocklist.get(jti);
  if (!expiry) return false;
  if (Date.now() > expiry) { blocklist.delete(jti); return false; }
  return true;
};

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiry] of blocklist) {
    if (now > expiry) blocklist.delete(jti);
  }
}, 5 * 60 * 1000).unref();

module.exports = { add, isBlocked };
