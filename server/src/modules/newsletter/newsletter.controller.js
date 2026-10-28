'use strict';

const NewsletterService = require('./newsletter.service');
const { success } = require('../../utils/response');

const consentContextFrom = (req) => ({
  ip: req.ip,
  userAgent: req.get ? req.get('user-agent') : undefined,
});

const subscribe = async (req, res, next) => {
  try {
    const { email, source } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const result = await NewsletterService.subscribe(email, source, consentContextFrom(req));
    const message = result.alreadySubscribed
      ? 'Already subscribed'
      : result.confirmationQueued === false
        ? 'Subscription saved, but the confirmation email could not be sent. Please try again in a few minutes.'
        : 'Almost done — check your email to confirm your subscription';
    return success(res, result, message);
  } catch (err) { next(err); }
};

const getMyStatus = async (req, res, next) => {
  try {
    return success(res, await NewsletterService.getStatus(req.user.email));
  } catch (err) { next(err); }
};

const updateMyStatus = async (req, res, next) => {
  try {
    const { subscribed } = req.body;
    if (typeof subscribed !== 'boolean') return res.status(400).json({ success: false, message: 'Subscribed must be true or false' });
    if (subscribed) {
      const result = await NewsletterService.subscribe(req.user.email, 'account', consentContextFrom(req));
      if (result.alreadySubscribed) return success(res, { subscribed: true, pending: false }, 'Newsletter preference saved');
      const confirmationQueued = result.confirmationQueued !== false;
      return success(
        res,
        { subscribed: false, pending: true, confirmationQueued },
        confirmationQueued
          ? 'Almost done — check your email to confirm your subscription'
          : 'Subscription saved, but the confirmation email could not be sent. Please try again in a few minutes.',
      );
    }
    await NewsletterService.unsubscribe(req.user.email);
    return success(res, { subscribed: false, pending: false }, 'Newsletter subscription removed');
  } catch (err) { next(err); }
};

const unsubscribe = async (req, res, next) => {
  try {
    const { email, token } = req.body;
    if (token) {
      const result = await NewsletterService.unsubscribeByToken(token);
      return success(res, result, result.alreadyUnsubscribed ? 'Already unsubscribed' : 'Unsubscribed successfully');
    }
    if (!email) return res.status(400).json({ success: false, message: 'Email or token is required' });
    const result = await NewsletterService.unsubscribe(email);
    return success(res, result, result.alreadyUnsubscribed ? 'Already unsubscribed' : 'Unsubscribed successfully');
  } catch (err) { next(err); }
};

// RFC 8058 one-click unsubscribe: mail providers POST here with the token in
// the query string and an empty form body. Same token semantics as POST
// /unsubscribe, kept separate so the JSON body contract stays stable.
const unsubscribeOneClick = async (req, res, next) => {
  try {
    const token = (req.query && req.query.token) || (req.body && req.body.token);
    const result = await NewsletterService.unsubscribeByToken(token);
    return success(res, result, result.alreadyUnsubscribed ? 'Already unsubscribed' : 'Unsubscribed successfully');
  } catch (err) { next(err); }
};

const confirm = async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await NewsletterService.confirm(token);
    const message = result.confirmed
      ? 'Subscription confirmed'
      : result.alreadyConfirmed
        ? 'Subscription already confirmed'
        : 'This subscription was cancelled';
    return success(res, result, message);
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const result = await NewsletterService.list(req.query);
    return success(res, result);
  } catch (err) { next(err); }
};

module.exports = { subscribe, getMyStatus, updateMyStatus, unsubscribe, unsubscribeOneClick, confirm, list };
