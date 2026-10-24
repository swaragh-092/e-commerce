import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handlebars = require('handlebars');
const { DEFAULTS, TEMPLATE_VARIABLES, SAMPLE_VARIABLES } = require('../../src/modules/notification/notification.defaults');

describe('Standardized Email Notification Templates', () => {
  it('ensures all defaults follow the canonical branded email wrapper', () => {
    const templateNames = Object.keys(DEFAULTS);
    expect(templateNames.length).toBeGreaterThanOrEqual(34);

    for (const name of templateNames) {
      const template = DEFAULTS[name];
      expect(template.bodyHtml, `Template ${name} must have bodyHtml`).toBeDefined();
      expect(template.bodyHtml, `Template ${name} must contain class="wrapper"`).toContain('class="wrapper"');
      expect(template.bodyHtml, `Template ${name} must contain class="header"`).toContain('class="header"');
      expect(template.bodyHtml, `Template ${name} must contain class="body"`).toContain('class="body"');
      expect(template.bodyHtml, `Template ${name} must contain class="footer"`).toContain('class="footer"');
      expect(template.bodyHtml, `Template ${name} must have store_logo support`).toContain('{{#if store_logo}}');
      expect(template.bodyHtml, `Template ${name} must have store_name heading`).toContain('{{store_name}}');
    }
  });

  it('compiles all default templates with sample variables without syntax errors', () => {
    for (const [name, template] of Object.entries(DEFAULTS)) {
      expect(() => {
        const compiled = handlebars.compile(template.bodyHtml)(SAMPLE_VARIABLES);
        expect(compiled).toContain('class="wrapper"');
      }, `Template ${name} must compile cleanly`).not.toThrow();
    }
  });

  it('provides available variables and sample data for new login and account deletion alerts', () => {
    expect(TEMPLATE_VARIABLES.new_login_alert).toContain('device');
    expect(TEMPLATE_VARIABLES.new_login_alert).toContain('ip');
    expect(TEMPLATE_VARIABLES.account_deletion_scheduled).toContain('deletion_date');
    expect(TEMPLATE_VARIABLES.account_deletion_scheduled).toContain('cancel_url');
    expect(SAMPLE_VARIABLES.device).toBeDefined();
    expect(SAMPLE_VARIABLES.deletion_date).toBeDefined();
  });
});
