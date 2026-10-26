'use strict';

/**
 * In-memory access token blocklist.
 * Entries auto-expire after ACCESS_TOKEN_TTL (default 15min).
 * In a multi-process/cluster deployment, replace with Redis SET + TTL.
 */
const blocklist = new Map();
const TTL_MS = 15 * 60 * 1000; // 15 minutes (matches access token expiry)

/**
 * Revoked session IDs (refresh-token `id` == access-token `sid`).
 * Sessions live up to 30 days (remember-me), so sid entries get a
 * 30-day TTL. Checked in `authenticate` — revoking a session here kills
 * its access tokens immediately instead of waiting up to 15 minutes.
 * Same Redis caveat as above for multi-instance deployments.
 */
const revokedSids = new Map();
const SID_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const add = (jti) => {
  blocklist.set(jti, Date.now() + TTL_MS);
};

const isBlocked = (jti) => {
  const expiry = blocklist.get(jti);
  if (!expiry) return false;
  if (Date.now() > expiry) { blocklist.delete(jti); return false; }
  return true;
};

const revokeSession = (sid) => {
  if (!sid) return;
  revokedSids.set(sid, Date.now() + SID_TTL_MS);
};

const isSessionRevoked = (sid) => {
  if (!sid) return false;
  const expiry = revokedSids.get(sid);
  if (!expiry) return false;
  if (Date.now() > expiry) { revokedSids.delete(sid); return false; }
  return true;
};

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiry] of blocklist) {
    if (now > expiry) blocklist.delete(jti);
  }
  for (const [sid, expiry] of revokedSids) {
    if (now > expiry) revokedSids.delete(sid);
  }
}, 5 * 60 * 1000).unref();

module.exports = { add, isBlocked, revokeSession, isSessionRevoked };
