import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const path = require('path');
const fs = require('fs');
const { packageSchema } = require('../../src/modules/theme/theme.validation');

const BUILTIN_DIR = path.join(__dirname, '../../src/modules/theme/builtin');

// ─── Schema Validation Tests ────────────────────────────────────────────────

describe('Theme package schema validation', () => {
  const builtinFiles = fs.readdirSync(BUILTIN_DIR).filter(f => f.endsWith('.theme.json'));

  it('finds all 12 built-in templates', () => {
    expect(builtinFiles.length).toBe(12);
  });

  builtinFiles.forEach((file) => {
    it(`validates ${file} against packageSchema`, () => {
      const content = JSON.parse(fs.readFileSync(path.join(BUILTIN_DIR, file), 'utf8'));
      const { error } = packageSchema.validate(content, { abortEarly: false, stripUnknown: false });
      expect(error).toBeUndefined();
    });
  });

  it('rejects packages with customCSS', () => {
    const pkg = buildMinimalPackage({ customCSS: 'body { display: none; }' });
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error.message).toContain('customCSS');
  });

  it('rejects packages with headScripts', () => {
    const pkg = buildMinimalPackage({ headScripts: '<script>alert(1)</script>' });
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error.message).toContain('headScripts');
  });

  it('rejects packages with bodyScripts', () => {
    const pkg = buildMinimalPackage({ bodyScripts: '<script>alert(1)</script>' });
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error.message).toContain('bodyScripts');
  });

  it('rejects invalid hex colors', () => {
    const pkg = buildMinimalPackage();
    pkg.design.theme.primaryColor = 'not-a-color';
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeDefined();
  });

  it('rejects unknown section types', () => {
    const pkg = buildMinimalPackage();
    pkg.layout = { homepageSections: [{ id: 'x', type: 'malicious-widget', enabled: true }] };
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeDefined();
  });
});

// ─── Data Source Security Tests ─────────────────────────────────────────────

describe('Theme data source security', () => {
  const ThemeService = require('../../src/modules/theme/theme.service');

  it('rejects data sources targeting blocked resources', () => {
    const pkg = buildMinimalPackage();
    pkg.dataSources = [{
      key: 'evil',
      type: 'apiBuilder',
      definition: {
        name: 'Evil Source',
        isActive: true,
        config: {
          responseMode: 'object',
          includeMeta: true,
          blocks: [{ resource: 'users', fields: ['email'], limit: 10 }],
        },
      },
    }];
    expect(() => ThemeService.validatePackage(pkg)).toThrow(/must be one of/);
  });

  it('rejects data sources with disallowed fields', () => {
    const pkg = buildMinimalPackage();
    pkg.dataSources = [{
      key: 'sneaky',
      type: 'apiBuilder',
      definition: {
        name: 'Sneaky Source',
        isActive: true,
        config: {
          responseMode: 'object',
          includeMeta: true,
          blocks: [{ resource: 'products', fields: ['id', 'name', 'passwordHash'], limit: 10 }],
        },
      },
    }];
    expect(() => ThemeService.validatePackage(pkg)).toThrow(/not allowed for resource/);
  });

  it('rejects data sources exceeding depth limit', () => {
    const pkg = buildMinimalPackage();
    pkg.dataSources = [{
      key: 'deep',
      type: 'apiBuilder',
      definition: {
        name: 'Deep Source',
        isActive: true,
        config: {
          responseMode: 'object',
          includeMeta: true,
          blocks: [{
            resource: 'products',
            fields: ['id'],
            limit: 5,
            relations: [{
              resource: 'categories',
              relation: 'categories',
              fields: ['id'],
              relations: [{
                resource: 'products',
                relation: 'products',
                fields: ['id'],
                relations: [{ resource: 'brands', relation: 'brand', fields: ['id'] }],
              }],
            }],
          }],
        },
      },
    }];
    expect(() => ThemeService.validatePackage(pkg)).toThrow(/depth exceeds/);
  });

  it('accepts valid data sources targeting allowed resources', () => {
    const pkg = buildMinimalPackage();
    pkg.dataSources = [{
      key: 'featured',
      type: 'apiBuilder',
      definition: {
        name: 'Featured Products',
        isActive: true,
        config: {
          responseMode: 'object',
          includeMeta: true,
          blocks: [{
            resource: 'products',
            fields: ['id', 'name', 'slug', 'price'],
            limit: 8,
            filters: [{ field: 'isFeatured', operator: 'equals', value: true }],
          }],
        },
      },
    }];
    expect(() => ThemeService.validatePackage(pkg)).not.toThrow();
  });
});

// ─── Dark Palette Validation ────────────────────────────────────────────────

describe('Dark palette validation', () => {
  it('accepts a valid darkPalette in design.theme', () => {
    const pkg = buildMinimalPackage();
    pkg.design.theme.darkPalette = {
      primaryColor: '#4fd1a5',
      secondaryColor: '#ffb86b',
      backgroundColor: '#101514',
      surfaceColor: '#17211f',
      textColor: '#f8fafc',
    };
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeUndefined();
  });

  it('rejects invalid colors in darkPalette', () => {
    const pkg = buildMinimalPackage();
    pkg.design.theme.darkPalette = { primaryColor: 'red' };
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeDefined();
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildMinimalPackage(overrides = {}) {
  return {
    schemaVersion: 3,
    meta: {
      slug: 'test-package',
      name: 'Test Package',
      version: '1.0.0',
      author: 'Test',
      description: 'Test',
      category: 'general',
      tags: [],
    },
    design: {
      theme: {
        mode: 'light',
        primaryColor: '#0f766e',
        secondaryColor: '#f97316',
        backgroundColor: '#f7f3ec',
        surfaceColor: '#ffffff',
        textColor: '#1f2933',
      },
    },
    ...overrides,
  };
}
