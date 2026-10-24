import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handlebars = require('handlebars');
const { DEFAULTS, TEMPLATE_VARIABLES, SAMPLE_VARIABLES } = require('../../src/modules/notification/notification.defaults');
const migration = require('../../migrations/20261024164500-standardize-all-email-templates');

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

  it('identifies uncustomized vs customized templates properly', () => {
    const created = new Date('2026-07-24T10:00:00Z');
    const updatedSoon = new Date('2026-07-24T10:00:02Z');
    const updatedLater = new Date('2026-08-15T14:30:00Z');

    const defaultData = DEFAULTS['order_placed'];

    // Uncustomized seeder template (timestamps within 10s of each other)
    expect(migration.isCustomized({
      name: 'order_placed',
      created_at: created,
      updated_at: updatedSoon,
      body_html: '<table>old layout</table>',
    }, defaultData)).toBe(false);

    // Template already matching canonical layout
    expect(migration.isCustomized({
      name: 'order_placed',
      created_at: created,
      updated_at: updatedLater,
      body_html: defaultData.bodyHtml,
    }, defaultData)).toBe(false);

    // Template customized by admin in the UI
    expect(migration.isCustomized({
      name: 'order_placed',
      created_at: created,
      updated_at: updatedLater,
      body_html: '<div>Custom text edited by admin</div>',
    }, defaultData)).toBe(true);
  });

  it('preserves customized templates and updates uncustomized templates in up()', async () => {
    const queries = [];
    const mockQueryInterface = {
      sequelize: {
        QueryTypes: { SELECT: 'SELECT' },
        query: vi.fn(async (sql, opts) => {
          queries.push({ sql, replacements: opts?.replacements });
          if (sql.includes('SELECT id, name, channel')) {
            return [
              {
                id: 'tmpl-1',
                name: 'order_placed',
                channel: 'email',
                created_at: new Date('2026-07-24T10:00:00Z'),
                updated_at: new Date('2026-07-24T10:00:00Z'), // uncustomized
                body_html: '<table>old</table>',
                subject: 'Old Subject',
                body_text: 'old text',
              },
              {
                id: 'tmpl-2',
                name: 'order_shipped',
                channel: 'email',
                created_at: new Date('2026-07-24T10:00:00Z'),
                updated_at: new Date('2026-08-15T12:00:00Z'), // customized
                body_html: '<div>Custom HTML</div>',
                subject: 'Custom Subject',
                body_text: 'custom text',
              },
            ];
          }
          return [];
        }),
      },
    };

    await migration.up(mockQueryInterface);

    // Check backup table was created
    expect(queries.some((q) => q.sql.includes('CREATE TABLE notification_templates_backup_20261024'))).toBe(true);

    // tmpl-1 (uncustomized) should be updated
    const tmpl1Update = queries.find((q) => q.replacements?.id === 'tmpl-1');
    expect(tmpl1Update).toBeDefined();
    expect(tmpl1Update.replacements.body_html).toContain('class="wrapper"');

    // tmpl-2 (customized) should NOT be updated
    const tmpl2Update = queries.find((q) => q.replacements?.id === 'tmpl-2');
    expect(tmpl2Update).toBeUndefined();
  });

  it('restores previous template states from backup in down()', async () => {
    const updates = [];
    let dropped = false;
    const mockQueryInterface = {
      sequelize: {
        QueryTypes: { SELECT: 'SELECT' },
        query: vi.fn(async (sql, opts) => {
          if (sql.includes('SELECT id, subject, body_html')) {
            return [
              {
                id: 'tmpl-1',
                subject: 'Previous Subject',
                body_html: '<table>previous html</table>',
                body_text: 'previous text',
                is_active: true,
                updated_at: new Date('2026-07-24T10:00:00Z'),
              },
            ];
          }
          if (sql.includes('UPDATE notification_templates')) {
            updates.push(opts?.replacements);
          }
          if (sql.includes('DROP TABLE IF EXISTS notification_templates_backup_20261024')) {
            dropped = true;
          }
          return [];
        }),
      },
    };

    await migration.down(mockQueryInterface);

    expect(updates).toHaveLength(1);
    expect(updates[0].subject).toBe('Previous Subject');
    expect(updates[0].body_html).toBe('<table>previous html</table>');
    expect(dropped).toBe(true);
  });
});
