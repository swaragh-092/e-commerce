'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const COOKIE = 'oauth_google_state';
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google/callback' });
const claims = () => ({ issuer: process.env.JWT_ISSUER || 'ecommerce-pro', audience: 'google-oauth-state' });

// Passport OAuth2 state-store contract. Bind callbacks to the initiating browser
// without requiring an Express session. Google's authorization code is single-use.
module.exports = {
  store(req, done) {
    try {
      const nonce = crypto.randomBytes(32).toString('hex');
      const token = jwt.sign({ nonce, purpose: 'oauth_state' }, process.env.JWT_ACCESS_SECRET, { ...claims(), expiresIn: '10m' });
      req.res.cookie(COOKIE, token, { ...options(), maxAge: 10 * 60 * 1000 });
      done(null, nonce);
    } catch (error) { done(error); }
  },
  verify(req, supplied, done) {
    req.res.clearCookie(COOKIE, options());
    try {
      const decoded = jwt.verify(req.cookies?.[COOKIE], process.env.JWT_ACCESS_SECRET, { ...claims(), algorithms: ['HS256'] });
      const expected = Buffer.from(decoded.nonce || '');
      const actual = Buffer.from(typeof supplied === 'string' ? supplied : '');
      const valid = decoded.purpose === 'oauth_state' && expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
      done(null, valid, valid ? undefined : { message: 'Invalid OAuth state' });
    } catch { done(null, false, { message: 'Invalid or expired OAuth state' }); }
  },
};
