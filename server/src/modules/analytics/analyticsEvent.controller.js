'use strict';

const { success } = require('../../utils/response');
const AnalyticsEventService = require('./analyticsEvent.service');
const { recordPageVisit } = require('./pageVisit.service');

const recordPageView = async (req, res, next) => {
  try {
    await recordPageVisit(req.validated, req);
    return res.status(204).end();
  } catch (error) { next(error); }
};

const recordCheckoutStart = async (req, res, next) => {
  try {
    await AnalyticsEventService.recordEvent({
      eventName: 'checkout_started',
      userId: req.user?.id || null,
      sessionId: req.headers['x-session-id'] || req.cookies?.sessionId || null,
      checkoutSessionId: req.validated.checkoutSessionId,
    });
    return success(res, null, 'Analytics event recorded', 202);
  } catch (error) { next(error); }
};

module.exports = { recordCheckoutStart, recordPageView };
