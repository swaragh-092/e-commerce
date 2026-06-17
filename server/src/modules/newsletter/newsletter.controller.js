'use strict';

const NewsletterService = require('./newsletter.service');
const { success } = require('../../utils/response');

const subscribe = async (req, res, next) => {
  try {
    const { email, source } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const result = await NewsletterService.subscribe(email, source);
    const message = result.alreadySubscribed ? 'Already subscribed' : 'Subscribed successfully';
    return success(res, result, message);
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

const unsubscribeByToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await NewsletterService.unsubscribeByToken(token);
    return success(res, result, result.alreadyUnsubscribed ? 'Already unsubscribed' : 'Unsubscribed successfully');
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const result = await NewsletterService.list(req.query);
    return success(res, result);
  } catch (err) { next(err); }
};

module.exports = { subscribe, unsubscribe, unsubscribeByToken, list };
