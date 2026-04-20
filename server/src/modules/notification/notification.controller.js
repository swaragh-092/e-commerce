'use strict';

const { NotificationTemplate } = require('../index');
const { success, error } = require('../../utils/response');
const AppError = require('../../utils/AppError');

/**
 * GET /notifications/templates
 * List all email templates (admin only)
 */
const listTemplates = async (req, res, next) => {
  try {
    const templates = await NotificationTemplate.findAll({ order: [['name', 'ASC']] });
    return success(res, templates);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /notifications/templates/:name
 * Get a single template by name
 */
const getTemplate = async (req, res, next) => {
  try {
    const template = await NotificationTemplate.findOne({ where: { name: req.params.name } });
    if (!template) throw new AppError('NOT_FOUND', 404, 'Template not found');
    return success(res, template);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /notifications/templates/:name
 * Update a template's subject, bodyHtml, bodyText, isActive
 */
const updateTemplate = async (req, res, next) => {
  try {
    const template = await NotificationTemplate.findOne({ where: { name: req.params.name } });
    if (!template) throw new AppError('NOT_FOUND', 404, 'Template not found');

    const { subject, bodyHtml, bodyText, isActive } = req.body;
    await template.update({
      ...(subject !== undefined && { subject }),
      ...(bodyHtml !== undefined && { bodyHtml }),
      ...(bodyText !== undefined && { bodyText }),
      ...(isActive !== undefined && { isActive }),
    });

    return success(res, template, 'Template updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /notifications/templates/test
 * Send a test email using a template to verify SMTP works
 */
const sendTestEmail = async (req, res, next) => {
  try {
    const { templateName, recipientEmail } = req.body;
    if (!templateName || !recipientEmail) {
      return error(res, 'templateName and recipientEmail are required', 400, 'VALIDATION_ERROR');
    }

    const NotificationService = require('./notification.service');
    const template = await NotificationTemplate.findOne({ where: { name: templateName } });
    if (!template) throw new AppError('NOT_FOUND', 404, `Template '${templateName}' not found`);

    // Send with placeholder test variables
    const sent = await NotificationService.send(templateName, recipientEmail, {
      name: 'Test User',
      verify_url: 'http://localhost:3000/verify-email?token=TEST_TOKEN',
      reset_url: 'http://localhost:3000/reset-password?token=TEST_TOKEN',
      productName: 'Test Product',
      sku: 'TEST-SKU-001',
      stock: 3,
    });

    if (!sent) {
      return error(res, 'Email failed to send. Check your SMTP configuration.', 500, 'EMAIL_SEND_FAILED');
    }

    return success(res, null, `Test email sent to ${recipientEmail}`);
  } catch (err) {
    next(err);
  }
};

module.exports = { listTemplates, getTemplate, updateTemplate, sendTestEmail };
