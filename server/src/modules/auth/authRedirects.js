'use strict';

const getBaseUrl = (name, developmentDefault) => {
  const configured = process.env[name]?.split(',')[0].trim();
  if (!configured && process.env.NODE_ENV === 'production') throw new Error(`${name} must be configured`);
  const url = new URL(configured || developmentDefault);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be an HTTP(S) base URL without credentials, query, or fragment`);
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production`);
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
};
const getClientBaseUrl = () => getBaseUrl('CLIENT_URL', 'http://localhost:5173');
const getGoogleCallbackUrl = () => `${getBaseUrl('SERVER_URL', 'http://localhost:5000')}/api/auth/google/callback`;
module.exports = { getClientBaseUrl, getGoogleCallbackUrl };
