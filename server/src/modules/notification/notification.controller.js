'use strict';

const handlebars = require('handlebars');
const { NotificationTemplate } = require('../index');
const { success, error } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const { DEFAULTS, TEMPLATE_VARIABLES, SAMPLE_VARIABLES } = require('./notification.defaults');

/**
 * GET /notifications/templates
 * List all templates with their available variables (admin only)
 */
const listTemplates = async (req, res, next) => {
  try {
    const templates = await NotificationTemplate.findAll({ order: [['name', 'ASC'], ['channel', 'ASC']] });

    // Enrich with metadata: available variables + whether a default exists
    const enriched = templates.map((t) => ({
      ...t.toJSON(),
      availableVariables: TEMPLATE_VARIABLES[t.name] || [],
      hasDefault: Boolean(DEFAULTS[t.name]),
    }));

    return success(res, enriched);
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
    const templates = await NotificationTemplate.findAll({ where: { name: req.params.name } });
    if (!templates.length) throw new AppError('NOT_FOUND', 404, 'Template not found');

    const enriched = templates.map((t) => ({
      ...t.toJSON(),
      availableVariables: TEMPLATE_VARIABLES[t.name] || [],
      hasDefault: Boolean(DEFAULTS[t.name]),
    }));

    return success(res, enriched);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /notifications/templates/:name
 * Update a template. Body must include `channel` to identify which variant.
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

    return success(res, { ...template.toJSON(), availableVariables: TEMPLATE_VARIABLES[template.name] || [], hasDefault: Boolean(DEFAULTS[template.name]) }, 'Template updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /notifications/templates/:name/preview
 * Renders the template HTML with sample variables and returns it — no email sent.
 * Body: { channel?, customHtml?, customSubject? }
 * If customHtml is provided, it previews that HTML (live preview without saving).
 */
const previewTemplate = async (req, res, next) => {
  try {
    const { channel = 'email', customHtml, customSubject } = req.body;

    let bodyHtml = customHtml;
    let subject = customSubject;

    if (!bodyHtml || !subject) {
      const template = await NotificationTemplate.findOne({
        where: { name: req.params.name, channel },
      });
      if (!template) throw new AppError('NOT_FOUND', 404, `Template '${req.params.name}' (${channel}) not found`);
      bodyHtml  = bodyHtml  || template.bodyHtml;
      subject   = subject   || template.subject;
    }

    // Inject store settings into sample vars
    const vars = { ...SAMPLE_VARIABLES };
    try {
      const SettingsService = require('../settings/settings.service');
      const [general, logo, footer] = await Promise.all([
        SettingsService.getByGroup('general'),
        SettingsService.getByGroup('logo'),
        SettingsService.getByGroup('footer'),
      ]);
      vars.store_name    = general.storeName  || vars.store_name;
      vars.support_email = footer.email       || vars.support_email;
      vars.store_logo    = logo.main ? `${process.env.API_PUBLIC_URL || ''}${logo.main}` : null;
    } catch (_) { /* use sample defaults */ }

    const renderedHtml    = handlebars.compile(bodyHtml)(vars);
    const renderedSubject = handlebars.compile(subject)(vars);

    return success(res, { html: renderedHtml, subject: renderedSubject });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /notifications/templates/:name/reset
 * Resets the template body/subject to the built-in default.
 * Body: { channel? }
 */
const resetTemplate = async (req, res, next) => {
  try {
    const { channel = 'email' } = req.body;
    const defaultData = DEFAULTS[req.params.name];

    if (!defaultData) {
      throw new AppError('NOT_FOUND', 404, `No built-in default exists for template '${req.params.name}'`);
    }

    const template = await NotificationTemplate.findOne({
      where: { name: req.params.name, channel },
    });
    if (!template) throw new AppError('NOT_FOUND', 404, `Template '${req.params.name}' (${channel}) not found`);

    await template.update({
      subject:  defaultData.subject,
      bodyHtml: defaultData.bodyHtml,
      bodyText: defaultData.bodyText || '',
    });

    return success(res, { ...template.toJSON(), availableVariables: TEMPLATE_VARIABLES[template.name] || [], hasDefault: true }, 'Template reset to default successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /notifications/templates/:name/default
 * Returns the default template data (subject + html) without modifying the DB.
 * Used by the client to show a diff before confirming reset.
 */
const getDefaultTemplate = async (req, res, next) => {
  try {
    const defaultData = DEFAULTS[req.params.name];
    if (!defaultData) {
      throw new AppError('NOT_FOUND', 404, `No built-in default exists for template '${req.params.name}'`);
    }
    return success(res, {
      name: req.params.name,
      subject: defaultData.subject,
      bodyHtml: defaultData.bodyHtml,
      bodyText: defaultData.bodyText || '',
      availableVariables: TEMPLATE_VARIABLES[req.params.name] || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /notifications/test
 * Send a test message on any channel to verify configuration.
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
        payload = { to: finalRecipient, subject: 'Test Notification', text: 'This is a test notification.', html: '<p>This is a test notification from the system.</p>' };
      } else {
        payload = { to: finalRecipient, body: 'This is a test notification from the system.' };
      }
      const sent = await Dispatcher.dispatch(channel, payload);
      if (!sent) {
        return error(res, `Test ${channel} failed. Check your configuration.`, 500, 'SEND_FAILED');
      }
      return success(res, null, `Test ${channel} sent to ${finalRecipient}`);
    }

    const NotificationService = require('./notification.service');
    const template = await NotificationTemplate.findOne({ where: { name: templateName, channel } });
    if (!template) {
      throw new AppError('NOT_FOUND', 404, `Template '${templateName}' for channel '${channel}' not found`);
    }

    const sent = await NotificationService.send(templateName, finalRecipient, SAMPLE_VARIABLES, null, null, channel);
    if (!sent) {
      return error(res, `Test ${channel} failed. Check your configuration.`, 500, 'SEND_FAILED');
    }

    return success(res, null, `Test ${channel} sent to ${finalRecipient}`);
  } catch (err) {
    next(err);
  }
};

const sendTestEmail = sendTestNotification;

module.exports = { listTemplates, getTemplate, updateTemplate, previewTemplate, resetTemplate, getDefaultTemplate, sendTestEmail, sendTestNotification };
