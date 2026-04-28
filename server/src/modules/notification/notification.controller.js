'use strict';

const { NotificationTemplate } = require('../index');
const { success, error } = require('../../utils/response');
const AppError = require('../../utils/AppError');

/**
 * GET /notifications/templates
 * List all templates (admin only)
 */
const listTemplates = async (req, res, next) => {
  try {
    const templates = await NotificationTemplate.findAll({ order: [['name', 'ASC'], ['channel', 'ASC']] });
    return success(res, templates);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /notifications/templates/:name
 * Get all channel variants for a template name
 */
const getTemplate = async (req, res, next) => {
  try {
    // Return all channel variants for this template name
    const templates = await NotificationTemplate.findAll({ where: { name: req.params.name } });
    if (!templates.length) throw new AppError('NOT_FOUND', 404, 'Template not found');
    return success(res, templates);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /notifications/templates/:name
 * Update a template. Body must include `channel` to identify which variant.
 * Updatable fields: subject, bodyHtml, bodyText, isActive
 */
const updateTemplate = async (req, res, next) => {
  try {
    const { channel = 'email', subject, bodyHtml, bodyText, isActive } = req.body;

    const template = await NotificationTemplate.findOne({
      where: { name: req.params.name, channel },
    });
    if (!template) throw new AppError('NOT_FOUND', 404, `Template '${req.params.name}' (${channel}) not found`);

    await template.update({
      ...(subject    !== undefined && { subject }),
      ...(bodyHtml   !== undefined && { bodyHtml }),
      ...(bodyText   !== undefined && { bodyText }),
      ...(isActive   !== undefined && { isActive }),
    });

    return success(res, template, 'Template updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /notifications/test
 * Send a test message on any channel to verify configuration.
 *
 * Body: { templateName, recipient, channel }
 *   - recipient = email address for email, E.164 phone for sms/whatsapp
 *   - channel   = 'email' | 'sms' | 'whatsapp'   (default: 'email')
 */
const sendTestNotification = async (req, res, next) => {
  try {
    const { templateName, recipient, recipientEmail, channel = 'email' } = req.body;
    const finalRecipient = recipient || recipientEmail;

    if (!templateName || !finalRecipient) {
      return error(res, 'templateName and recipient are required', 400, 'VALIDATION_ERROR');
    }

    const validChannels = ['email', 'sms', 'whatsapp'];
    if (!validChannels.includes(channel)) {
      return error(res, `channel must be one of: ${validChannels.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    if (templateName === 'test_notification') {
      const Dispatcher = require('./notification.dispatcher');
      let payload;
      if (channel === 'email') {
          payload = { to: finalRecipient, subject: 'Test Notification', text: 'This is a test notification from the system.', html: '<p>This is a test notification from the system.</p>' };
      } else {
          payload = { to: finalRecipient, body: 'This is a test notification from the system.' };
      }
      const sent = await Dispatcher.dispatch(channel, payload);
      if (!sent) {
        return error(res, `Test ${channel} failed to send. Check your configuration and channel enable flags.`, 500, 'SEND_FAILED');
      }
      return success(res, null, `Test ${channel} sent to ${finalRecipient}`);
    }

    const NotificationService = require('./notification.service');

    const template = await NotificationTemplate.findOne({ where: { name: templateName, channel } });
    if (!template) {
      throw new AppError('NOT_FOUND', 404, `Template '${templateName}' for channel '${channel}' not found`);
    }

    // Placeholder variables so Handlebars doesn't error on missing keys
    const sent = await NotificationService.send(templateName, finalRecipient, {
      name: 'Test User',
      verify_url: 'http://localhost:3000/verify-email?token=TEST_TOKEN',
      reset_url: 'http://localhost:3000/reset-password?token=TEST_TOKEN',
      productName: 'Test Product',
      sku: 'TEST-SKU-001',
      stock: 3,
      order_id: 'TEST-ORDER-001',
    }, null, null, channel);

    if (!sent) {
      return error(res, `Test ${channel} failed to send. Check your configuration and channel enable flags.`, 500, 'SEND_FAILED');
    }

    return success(res, null, `Test ${channel} sent to ${finalRecipient}`);
  } catch (err) {
    next(err);
  }
};

// Keep old name as alias so any import using sendTestEmail still works
const sendTestEmail = sendTestNotification;

module.exports = { listTemplates, getTemplate, updateTemplate, sendTestEmail, sendTestNotification };
