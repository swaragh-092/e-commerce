import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSection, getSectionPresetGallery } from '../../../client/src/utils/sectionPresets';

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

  it('validates every addable section preset as a reusable package section', () => {
    const homepageSections = getSectionPresetGallery().map(({ type }) => createDefaultSection(type, { id: type }));
    expect(homepageSections.map(({ type }) => type).sort()).toEqual(
      [...require('../../src/modules/theme/theme.validation').SECTION_TYPES].sort(),
    );
    const pkg = buildMinimalPackage({ layout: { homepageSections } });
    expect(packageSchema.validate(pkg, { abortEarly: false }).error).toBeUndefined();
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

  it('preserves Designer product and category controls through theme export, library import, and scoped preview', async () => {
    const { Setting, ThemePackage } = require('../../src/modules');
    const ThemeService = require('../../src/modules/theme/theme.service');
    const designerSettings = [
      { group: 'productPage', key: 'templateLayout', value: 'gallery-top-details-below' },
      { group: 'productPage', key: 'imageAlignment', value: 'vertical' },
      { group: 'productPage', key: 'showSKU', value: false },
      { group: 'productPage', key: 'showStockBadge', value: false },
      { group: 'productPage', key: 'addToCartLabel', value: 'Add to basket' },
      { group: 'productPage', key: 'showBuyNowButton', value: false },
      { group: 'productPage', key: 'buyNowLabel', value: 'Buy it now' },
      { group: 'categoryPage', key: 'heroTitle', value: 'Browse our departments' },
      { group: 'categoryPage', key: 'headerLayout', value: 'split' },
      { group: 'categoryPage', key: 'showSubcategories', value: false },
    ];
    const readSettings = vi.spyOn(Setting, 'findAll')
      .mockResolvedValueOnce(designerSettings)
      .mockResolvedValueOnce([]);
    const findTemplate = vi.spyOn(ThemePackage, 'findOne').mockResolvedValue(null);
    const createTemplate = vi.spyOn(ThemePackage, 'create').mockImplementation(async (record) => record);

    try {
      const pkg = await ThemeService.exportCurrent({ includeDemoContent: false });
      const saved = await ThemeService.importToLibrary(JSON.parse(JSON.stringify(pkg)), 'manager');
      const preview = await ThemeService.preview(saved.packageData, ['pageTemplates']);

      expect(pkg.pageTemplates.product).toMatchObject({
        imageAlignment: 'vertical',
        showSKU: false,
        showStockBadge: false,
        addToCartLabel: 'Add to basket',
        showBuyNowButton: false,
        buyNowLabel: 'Buy it now',
      });
      expect(pkg.pageTemplates.category).toEqual({
        heroTitle: 'Browse our departments',
        headerLayout: 'split',
        showSubcategories: false,
      });
      expect(preview.mergedSettings.productPage).toMatchObject({
        imageAlignment: 'vertical',
        showSKU: false,
        showStockBadge: false,
        addToCartLabel: 'Add to basket',
        showBuyNowButton: false,
        buyNowLabel: 'Buy it now',
      });
      expect(preview.mergedSettings.categoryPage).toMatchObject({
        heroTitle: 'Browse our departments',
        headerLayout: 'split',
        showSubcategories: false,
      });
    } finally {
      readSettings.mockRestore();
      findTemplate.mockRestore();
      createTemplate.mockRestore();
    }
  });

  it('rejects unknown section types', () => {
    const pkg = buildMinimalPackage();
    pkg.layout = { homepageSections: [{ id: 'x', type: 'malicious-widget', enabled: true }] };
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeDefined();
  });

  it('validates exported blank announcement colors and promo banner media', async () => {
    const { Setting } = require('../../src/modules');
    const ThemeService = require('../../src/modules/theme/theme.service');
    const banner = { id: 'summer-sale', title: 'Summer sale', image: '/uploads/promo.jpg' };
    const readSettings = vi.spyOn(Setting, 'findAll').mockResolvedValueOnce([
      { group: 'announcement', key: 'bgColor', value: '' },
      { group: 'announcement', key: 'fgColor', value: '' },
      { group: 'homepage', key: 'promoBanners', value: [banner] },
    ]);
    try {
      const exported = await ThemeService.exportCurrent();
      const validated = ThemeService.validatePackage(JSON.parse(JSON.stringify(exported)));

      expect(validated.layout.announcementStyle).toEqual({ bgColor: '', fgColor: '' });
      expect(validated.demoContent.promoBanners).toEqual([banner]);
    } finally {
      readSettings.mockRestore();
    }
  });

  it('preserves composed hero blocks and mobile media through export and preview', async () => {
    const { Setting } = require('../../src/modules');
    const ThemeService = require('../../src/modules/theme/theme.service');
    const section = {
      id: 'hero', type: 'composed-hero', enabled: true,
      heroBlocks: [{
        id: 'group', type: 'group', direction: 'row', children: [
          { id: 'title', type: 'heading', text: 'Grow your own' },
          { id: 'card', type: 'collection', categorySlug: 'seeds', href: '/category/seeds', url: '/uploads/seeds.jpg',
            mobileUrl: '/uploads/seeds-mobile.mp4', mobileMediaType: 'video' },
        ],
      }],
    };
    const readSettings = vi.spyOn(Setting, 'findAll')
      .mockResolvedValueOnce([{ group: 'homepage', key: 'sections', value: [section] }])
      .mockResolvedValue([]);
    try {
      const pkg = JSON.parse(JSON.stringify(await ThemeService.exportCurrent()));
      expect((await ThemeService.preview(pkg, ['homepageSections'])).mergedSettings.homepage.sections).toEqual([section]);
      section.heroBlocks[0].children[1].href = 'javascript:alert(1)';
      pkg.layout.homepageSections = [section];
      expect(() => ThemeService.validatePackage(pkg)).toThrow(/href/);
    } finally {
      readSettings.mockRestore();
    }
  });

  it('round-trips reusable blocks, shared placements and collection controls through template preview', async () => {
    const { Setting } = require('../../src/modules');
    const ThemeService = require('../../src/modules/theme/theme.service');
    const sections = [
      { id: 'info', type: 'product-info', enabled: true, heroBlocks: [
        { id: 'attribute', type: 'product-attribute', attributeName: 'Germination' },
        { id: 'enquiry', type: 'enquiry' },
      ] },
      { id: 'recent', type: 'recently-viewed', enabled: false, dataSourceSlug: 'local-only' },
    ];
    const homeSections = [
      { id: 'header', type: 'composed-hero', placement: 'header', enabled: true,
        heroBlocks: [{ id: 'notice', type: 'text', text: 'Seasonal collection' }] },
      { id: 'story', type: 'editorial-image-text', enabled: true,
        heroBlocks: [{ id: 'guide', type: 'blog', blogSlug: 'planting-guide' }] },
      { id: 'footer', type: 'composed-hero', placement: 'footer', enabled: true,
        heroBlocks: [{ id: 'signup', type: 'newsletter' }] },
    ];
    const readSettings = vi.spyOn(Setting, 'findAll')
      .mockResolvedValueOnce([
        { group: 'homepage', key: 'sections', value: homeSections },
        { group: 'productPage', key: 'sections', value: sections },
        { group: 'blogPage', key: 'sections', value: [] },
        { group: 'catalog', key: 'showFilters', value: false },
        { group: 'catalog', key: 'categoryDepth', value: 2 },
      ])
      .mockResolvedValue([]);
    try {
      const exported = await ThemeService.exportCurrent();
      const pkg = JSON.parse(JSON.stringify(exported));
      const preview = await ThemeService.preview(pkg, ['pageTemplates', 'homepageSections']);
      expect(preview.mergedSettings.homepage.sections).toEqual(homeSections);
      expect(preview.mergedSettings.productPage.sections).toEqual([
        sections[0], { id: 'recent', type: 'recently-viewed', enabled: false },
      ]);
      expect(preview.mergedSettings.blogPage.sections).toEqual([]);
      expect(preview.mergedSettings.catalog).toMatchObject({ showFilters: false, categoryDepth: 2 });
      expect((await ThemeService.preview(pkg, ['design'])).mergedSettings.productPage).toBeUndefined();
    } finally {
      readSettings.mockRestore();
    }
  });

  it('exports published section design and content and previews it for installation', async () => {
    const { Setting } = require('../../src/modules');
    const ThemeService = require('../../src/modules/theme/theme.service');
    const homepageSections = [
      {
        id: 'newsletter', type: 'newsletter-signup', enabled: true,
        placement: 'footer', variant: 'inline-form', title: 'Get updates', ctaText: 'Sign up',
        textAlign: 'center', paddingTop: 24, marginBottom: -8, hideOnMobile: true,
        backgroundColor: '#f5f5f5', backgroundImage: '/uploads/banner.jpg',
        widthMode: 'custom', customMaxWidth: 640, boxShadow: 'sm',
      },
      {
        id: 'hero', type: 'hero-carousel',
        slides: [{ title: 'New arrivals', image: '/uploads/hero.jpg', position: 'top', buttonLink: '/products' }],
      },
      {
        id: 'promo', type: 'promo-banners', enabled: true,
        items: [{ title: 'Summer sale', subtitle: 'This weekend', image: '/uploads/promo.jpg', color: '#ffeeee', link: '/sale' }],
      },
      {
        id: 'trust', type: 'trust-badges', enabled: true,
        items: [{ title: 'Delivery', icon: 'shipping', backgroundColor: '', accentColor: '#002233' }],
      },
      { id: 'countdown', type: 'countdown-sale', enabled: false, endDate: '2027-07-01T00:00:00.000Z' },
    ];
    const readSettings = vi.spyOn(Setting, 'findAll')
      .mockResolvedValueOnce([{ group: 'homepage', key: 'sections', value: homepageSections }])
      .mockResolvedValueOnce([]);
    try {
      const pkg = await ThemeService.exportCurrent({ includeDemoContent: false });
      const preview = await ThemeService.preview(JSON.parse(JSON.stringify(pkg)), ['homepageSections']);

      expect(preview.mergedSettings.homepage.sections).toEqual(
        homepageSections.map((section) => ({ enabled: true, ...section })),
      );
    } finally {
      readSettings.mockRestore();
    }
  });

  it('preserves page row placement, scope and ordered picks through theme export and preview', async () => {
    const { Setting } = require('../../src/modules');
    const ThemeService = require('../../src/modules/theme/theme.service');
    const rows = [
      { id: 'trending', type: 'product-row', enabled: true, source: 'trending', pagePosition: 'above', productScope: 'category' },
      { id: 'picks', type: 'product-row', enabled: true, source: 'staffPicks', pagePosition: 'below',
        productIds: ['d0c29777-e701-4e40-ab97-bd600e1dddfd', '093643c4-aec2-4b45-a494-3cfcacc37ee0'] },
    ];
    const readSettings = vi.spyOn(Setting, 'findAll')
      .mockResolvedValueOnce([{ group: 'categoryPage', key: 'productRows', value: rows }])
      .mockResolvedValueOnce([]);
    try {
      const pkg = await ThemeService.exportCurrent();
      const { mergedSettings } = await ThemeService.preview(JSON.parse(JSON.stringify(pkg)), ['pageTemplates']);
      expect(mergedSettings.categoryPage.productRows).toEqual(rows);
    } finally {
      readSettings.mockRestore();
    }
  });

  it('previews exported navigation, commerce styles, and album references', async () => {
    const { Setting } = require('../../src/modules');
    const ThemeService = require('../../src/modules/theme/theme.service');
    const sections = [{ id: 'gallery', type: 'gallery', gallerySlug: 'summer-looks', enabled: true }];
    const formControl = { variant: 'filled', focusStyle: 'glow' };
    const readSettings = vi.spyOn(Setting, 'findAll')
      .mockResolvedValueOnce([
        { group: 'nav', key: 'showWishlist', value: true },
        { group: 'nav', key: 'actionsOrder', value: ['wishlist', 'search', 'cart', 'account'] },
        { group: 'componentStyles', key: 'formControl', value: formControl },
        { group: 'homepage', key: 'sections', value: sections },
      ])
      .mockResolvedValueOnce([]);
    try {
      const pkg = await ThemeService.exportCurrent();
      const preview = await ThemeService.preview(JSON.parse(JSON.stringify(pkg)), ['layoutStyle', 'homepageSections', 'componentStyles']);
      expect(preview.mergedSettings).toMatchObject({
        nav: { showWishlist: true, actionsOrder: ['wishlist', 'search', 'cart', 'account'] },
        componentStyles: { formControl },
        homepage: { sections },
      });
    } finally {
      readSettings.mockRestore();
    }
  });

  it('preserves Designer product and category controls through export and Try in Designer preview', async () => {
    const { Setting } = require('../../src/modules');
    const ThemeService = require('../../src/modules/theme/theme.service');
    const designerSettings = [
      { group: 'productPage', key: 'templateLayout', value: 'gallery-top-details-below' },
      { group: 'productPage', key: 'imageAlignment', value: 'vertical' },
      { group: 'productPage', key: 'showSKU', value: false },
      { group: 'productPage', key: 'showStockBadge', value: false },
      { group: 'productPage', key: 'addToCartLabel', value: 'Add to basket' },
      { group: 'productPage', key: 'showBuyNowButton', value: false },
      { group: 'productPage', key: 'buyNowLabel', value: 'Buy it now' },
      { group: 'categoryPage', key: 'heroTitle', value: 'Browse our departments' },
      { group: 'categoryPage', key: 'headerLayout', value: 'split' },
      { group: 'categoryPage', key: 'showSubcategories', value: false },
    ];
    const readSettings = vi.spyOn(Setting, 'findAll')
      .mockResolvedValueOnce(designerSettings)
      .mockResolvedValueOnce([]);

    try {
      const pkg = await ThemeService.exportCurrent({ includeDemoContent: false });
      const preview = await ThemeService.preview(pkg, ['pageTemplates']);

      expect(pkg.pageTemplates.product).toMatchObject({
        imageAlignment: 'vertical',
        showSKU: false,
        showStockBadge: false,
        addToCartLabel: 'Add to basket',
        showBuyNowButton: false,
        buyNowLabel: 'Buy it now',
      });
      expect(pkg.pageTemplates.category).toEqual({
        heroTitle: 'Browse our departments',
        headerLayout: 'split',
        showSubcategories: false,
      });
      expect(preview.mergedSettings.productPage).toMatchObject({
        imageAlignment: 'vertical',
        showSKU: false,
        showStockBadge: false,
        addToCartLabel: 'Add to basket',
        showBuyNowButton: false,
        buyNowLabel: 'Buy it now',
      });
      expect(preview.mergedSettings.categoryPage).toMatchObject({
        heroTitle: 'Browse our departments',
        headerLayout: 'split',
        showSubcategories: false,
      });
    } finally {
      readSettings.mockRestore();
    }
  });

  it('stages scoped template settings into the existing draft without updating live settings', async () => {
    const { sequelize, DesignDraft } = require('../../src/modules');
    const SettingsService = require('../../src/modules/settings/settings.service');
    const AuditService = require('../../src/modules/audit/audit.service');
    const ThemeService = require('../../src/modules/theme/theme.service');
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const original = {
      status: 'draft', revision: 2, baseSnapshot: {},
      payload: [{ group: 'footer', key: 'bgColor', value: '#123456' }],
    };
    const update = vi.fn(async (value) => ({ toJSON: () => value }));
    const mocks = [
      vi.spyOn(sequelize, 'transaction').mockImplementation((callback) => callback(transaction)),
      vi.spyOn(DesignDraft, 'findOne').mockResolvedValue({ ...original, update }),
      vi.spyOn(AuditService, 'log').mockResolvedValue(undefined),
      vi.spyOn(SettingsService, 'bulkUpdate').mockResolvedValue(undefined),
    ];
    try {
      const pkg = buildMinimalPackage();
      const header = {
        id: 'header', type: 'composed-hero', placement: 'header', enabled: true,
        heroBlocks: [{ id: 'notice', type: 'text', text: 'Seasonal collection' }],
      };
      const productInfo = {
        id: 'info', type: 'product-info', enabled: true,
        heroBlocks: [{ id: 'enquiry', type: 'enquiry' }],
      };
      pkg.layout = { ...pkg.layout, homepageSections: [header] };
      pkg.pageTemplates = { product: { layout: 'media-left-details-right', sections: [productInfo] } };
      const draft = await ThemeService.stageDraft(pkg, {
        scopes: ['design', 'homepageSections', 'pageTemplates'],
      }, { id: 'manager' });
      expect(draft.payload).toEqual(expect.arrayContaining([
        { group: 'homepage', key: 'sections', value: [header], operation: 'upsert' },
        { group: 'productPage', key: 'sections', value: [productInfo], operation: 'upsert' },
      ]));
      expect(draft.revision).toBe(3);
      expect(draft.payload).toEqual(expect.arrayContaining([
        { group: 'footer', key: 'bgColor', value: '#123456', operation: 'upsert' },
        { group: 'theme', key: 'primaryColor', value: '#0f766e', operation: 'upsert' },
      ]));
      expect(SettingsService.bulkUpdate).not.toHaveBeenCalled();
      await expect(ThemeService.stageDraft(buildMinimalPackage(), { scopes: ['dataSources'] }, { id: 'manager' })).rejects.toThrow(/cannot be staged/);
    } finally {
      mocks.forEach((mock) => mock.mockRestore());
    }
  });

  it('rejects unsafe URLs and unknown fields inside section content', () => {
    const pkg = buildMinimalPackage({ layout: { homepageSections: [{
      id: 'hero', type: 'hero-carousel', enabled: true,
      backgroundImage: 'javascript:alert(1)',
      slides: [{ buttonLink: '//example.com', script: 'alert(1)' }],
    }] } });
    const { error } = packageSchema.validate(pkg, { abortEarly: false });

    expect(error.details.map(({ path }) => path.slice(3).join('.'))).toEqual(expect.arrayContaining([
      'backgroundImage', 'slides.0.buttonLink', 'slides.0.script',
    ]));
  });

  it('accepts typography, mobile, font, and semantic colour tokens saved by the designer', () => {
    const pkg = buildMinimalPackage();
    pkg.design.theme = {
      ...pkg.design.theme,
      errorColor: '#dc3545',
      cancelButtonColor: '#e11d48',
      warningColor: '#d97706',
      successColor: '#059669',
      infoColor: '#0284c7',
      fontVariationSettings: '"opsz" 32, "wght" 650',
      lineHeightH1: '1.05',
      lineHeightH2: '1.1',
      typographyScale: {
        preset: 'custom',
        fluid: true,
        h1: 'clamp(2rem, 5vw, 3.25rem)',
        body1: '1rem',
        fluidConfig: { bodyMin: '0.95', bodyMax: '1.05', minVw: '320', maxVw: '1280' },
      },
      mobileOverrides: {
        primaryColor: '#0f766e',
        bodyFontSize: '0.95rem',
        headingScale: '0.86',
        sectionPadding: '32px',
        containerPadding: '16px',
      },
      customFonts: {
        bodyUrl: 'https://cdn.example.com/fonts/store-body.woff2',
        bodyFamily: 'Store Body',
        bodyFormat: 'woff2',
      },
      variableFontAxes: {
        wght: { enabled: true, value: 650, default: 400, min: 100, max: 900 },
      },
      darkPalette: {
        primaryColor: '#4fd1a5',
        errorColor: '#dc3545',
        cancelButtonColor: '#e11d48',
        warningColor: '#d97706',
        successColor: '#059669',
        infoColor: '#0284c7',
      },
    };

    const { error } = packageSchema.validate(pkg, { abortEarly: false, stripUnknown: false });
    expect(error).toBeUndefined();
  });

  it('rejects unknown keys inside saved typography tokens', () => {
    const pkg = buildMinimalPackage();
    pkg.design.theme.typographyScale = { preset: 'custom', malicious: 'body { display: none; }' };
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error.message).toContain('malicious');
  });

  it('rejects unsupported custom font formats', () => {
    const pkg = buildMinimalPackage();
    pkg.design.theme.customFonts = { bodyUrl: 'https://cdn.example.com/font.exe', bodyFormat: 'exe' };
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error.message).toContain('bodyFormat');
  });

  it('rejects non-http custom font URLs', () => {
    const pkg = buildMinimalPackage();
    pkg.design.theme.customFonts = { bodyUrl: 'javascript:alert(1)', bodyFormat: 'woff2' };
    const { error } = packageSchema.validate(pkg, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error.message).toContain('bodyUrl');
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

// ─── Conflict-aware Rollback Tests ─────────────────────────────────────────

describe('Conflict-aware theme rollback', () => {
  const ThemeService = require('../../src/modules/theme/theme.service');

  it('restores unchanged activation values and removes newly created rows', () => {
    const plan = ThemeService.buildRollbackPlan(
      { theme: { primaryColor: '#0f766e' } },
      { theme: { primaryColor: '#111827', radius: 12 } },
      { theme: { primaryColor: '#111827', radius: 12 } },
    );

    expect(plan.rows).toEqual([{ group: 'theme', key: 'primaryColor', value: '#0f766e' }]);
    expect(plan.deletes).toEqual([{ group: 'theme', key: 'radius' }]);
    expect(plan.conflicts).toEqual([]);
  });

  it('preserves a value changed after activation', () => {
    const plan = ThemeService.buildRollbackPlan(
      { theme: { primaryColor: '#0f766e' } },
      { theme: { primaryColor: '#111827' } },
      { theme: { primaryColor: '#be123c' } },
    );

    expect(plan.rows).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.conflicts).toEqual([{ group: 'theme', key: 'primaryColor' }]);
  });

  it('recreates a before value when a post-activation value was removed', () => {
    const plan = ThemeService.buildRollbackPlan(
      { theme: { primaryColor: '#0f766e' } },
      { theme: { primaryColor: '#111827' } },
      { theme: {} },
    );

    expect(plan.rows).toEqual([]);
    expect(plan.conflicts).toEqual([{ group: 'theme', key: 'primaryColor' }]);
  });
});

describe('Conflict-aware template data source rollback', () => {
  const ThemeService = require('../../src/modules/theme/theme.service');

  const source = (overrides = {}) => ({
    id: 'source-1',
    slug: 'template-demo-featured',
    name: 'Featured Products',
    description: '[template-data-source] template=demo key=featured',
    isActive: true,
    config: { blocks: [{ resource: 'products', limit: 8 }] },
    createdByTemplateId: 'demo',
    deletedAt: null,
    ...overrides,
  });

  it('deactivates a source created by the activation when unchanged', () => {
    const plan = ThemeService.buildDataSourceRollbackPlan(
      [{ key: 'featured', id: 'source-1', slug: 'template-demo-featured', before: null, after: source() }],
      { 'source-1': source() },
    );

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe('deactivate');
    expect(plan.conflicts).toEqual([]);
  });

  it('restores the previous source configuration when unchanged', () => {
    const before = source({ name: 'Original source', config: { blocks: [{ resource: 'products', limit: 4 }] } });
    const after = source();
    const plan = ThemeService.buildDataSourceRollbackPlan(
      [{ key: 'featured', id: 'source-1', slug: after.slug, before, after }],
      { 'source-1': after },
    );

    expect(plan.actions).toEqual([{ type: 'restore', ref: expect.any(Object), before }]);
    expect(plan.conflicts).toEqual([]);
  });

  it('preserves a source changed by a newer activation or merchant edit', () => {
    const after = source();
    const plan = ThemeService.buildDataSourceRollbackPlan(
      [{ key: 'featured', id: 'source-1', slug: after.slug, before: null, after }],
      { 'source-1': source({ config: { blocks: [{ resource: 'products', limit: 12 }] } }) },
    );

    expect(plan.actions).toEqual([]);
    expect(plan.conflicts).toEqual([{
      type: 'dataSource',
      key: 'featured',
      id: 'source-1',
      slug: after.slug,
      reason: 'source_changed_after_activation',
    }]);
  });

  it('preserves legacy activations without a source snapshot', () => {
    const plan = ThemeService.buildDataSourceRollbackPlan(
      [{ key: 'featured', id: 'source-1', slug: 'template-demo-featured' }],
      { 'source-1': source() },
    );

    expect(plan.actions).toEqual([]);
    expect(plan.conflicts[0].reason).toBe('missing_activation_snapshot');
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

describe('tag and gallery theme sections', () => {
  it('preserves content selections through package validation', () => {
    const homepageSections = [
      { id: 'tags', type: 'tag-showcase', enabled: true, title: 'Shop by Tag', tagSlugs: ['summer', 'garden'], count: 8 },
      { id: 'gallery', type: 'gallery-grid', enabled: true, title: 'Our Gallery', gallerySlug: 'our-store', count: 6 },
    ];
    const { value, error } = packageSchema.validate(buildMinimalPackage({ layout: { homepageSections } }));
    expect(error).toBeUndefined();
    expect(value.layout.homepageSections).toEqual(homepageSections);
  });
  it('rejects unsafe gallery slugs and excessive tag selections', () => {
    const section = { id: 'gallery', type: 'gallery-grid', enabled: true, gallerySlug: '../private' };
    expect(packageSchema.validate(buildMinimalPackage({ layout: { homepageSections: [section] } })).error).toBeDefined();
    const tags = { id: 'tags', type: 'tag-showcase', enabled: true, tagSlugs: Array.from({ length: 13 }, (_, i) => `tag-${i}`) };
    expect(packageSchema.validate(buildMinimalPackage({ layout: { homepageSections: [tags] } })).error).toBeDefined();
  });
});
