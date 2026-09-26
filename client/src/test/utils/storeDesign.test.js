import { describe, expect, it } from 'vitest';
import {
  DESIGNER_TARGETS,
  getStoreDesignSummary,
  isDesignerOwnedSetting,
} from '../../utils/storeDesign';
import {
  DESIGN_COMPONENT_GROUPS,
  DESIGN_COMPONENT_CONTROL_SCHEMAS,
  DESIGN_COMPONENT_REGISTRY,
  DESIGN_PAGE_CONTROL_SCHEMAS,
  DESIGN_PAGE_REGISTRY,
  getDesignComponent,
  getDesignComponentControlSchema,
  getDesignPageControlSchema,
  getDesignResetTarget,
  getDesignSource,
  isDesignControlVisible,
} from '../../utils/designRegistry';

describe('store design ownership', () => {
  it('keeps visual groups on the Store Designer write path', () => {
    expect(isDesignerOwnedSetting('theme', 'primaryColor')).toBe(true);
    expect(isDesignerOwnedSetting('componentStyles', 'productCard')).toBe(true);
    expect(isDesignerOwnedSetting('productPage', 'templateLayout')).toBe(true);
    expect(isDesignerOwnedSetting('brandsPage', 'cardBorderRadius')).toBe(true);
    expect(isDesignerOwnedSetting('advanced', 'customCSS')).toBe(true);
  });

  it('keeps operational settings editable from System Settings', () => {
    expect(isDesignerOwnedSetting('general', 'storeName')).toBe(false);
    expect(isDesignerOwnedSetting('shipping', 'method')).toBe(false);
    expect(isDesignerOwnedSetting('catalog', 'defaultSort')).toBe(false);
    expect(isDesignerOwnedSetting('catalog', 'lowStockThreshold')).toBe(false);
    expect(isDesignerOwnedSetting('advanced', 'headScripts')).toBe(false);
  });

  it('builds merchant-facing summaries without exposing internal storage names', () => {
    const summary = getStoreDesignSummary({
      'theme.fontFamily': 'Source Sans Pro',
      'theme.headingFont': 'Montserrat',
      'theme.primaryColor': '#123456',
      'componentStyles.productCard': { variant: 'editorial' },
      'nav.sticky': 'false',
      'announcement.enabled': 'false',
    }, [{ id: 'hero' }, { id: 'products' }]);

    expect(summary.theme.font).toBe('Source Sans Pro');
    expect(summary.cards.product).toBe('editorial');
    expect(summary.structure.header).toBe('Static header');
    expect(summary.structure.announcement).toBe('Hidden');
    expect(summary.homepage.sections).toBe(2);
    expect(DESIGNER_TARGETS.cards).toContain('component=productCard');
    expect(DESIGNER_TARGETS.collection).toContain('page=collection');
  });

  it('keeps the Designer registry complete and aligned with ownership', () => {
    const groupedComponents = DESIGN_COMPONENT_GROUPS.flatMap((group) => group.componentKeys);

    expect(groupedComponents).toHaveLength(DESIGN_COMPONENT_REGISTRY.length);
    expect(new Set(groupedComponents).size).toBe(DESIGN_COMPONENT_REGISTRY.length);
    expect(getDesignComponent('productCard')).toMatchObject({
      settingsGroup: 'componentStyles',
      ownership: 'group',
      previewTarget: 'product-card',
    });
    expect(DESIGN_PAGE_REGISTRY.find((page) => page.key === 'product')).toMatchObject({
      settingsGroup: 'productPage',
      ownedKeys: expect.arrayContaining(['templateLayout', 'showBuyNowButton']),
    });
    expect(getDesignResetTarget('productCard')).toEqual({ group: 'componentStyles', key: 'productCard' });
    expect(getDesignSource('productCard', { componentStyles: { productCard: 'custom' } })).toBe('custom');
    expect(getDesignSource('productCard', { componentStyles: { productCard: 'default' } })).toBe('default');
    expect(getDesignSource('headerLayout', { nav: { sticky: 'custom' } })).toBe('custom');
  });

  it('keeps page controls schema-backed without changing persisted keys', () => {
    const schema = getDesignPageControlSchema('product');
    const fields = schema.groups.flatMap((group) => group.fields);

    expect(schema.groups.map((group) => group.label)).toEqual([
      'Page Layout & Options',
      'Visibility Toggles',
      'Labels & Content',
    ]);
    expect(fields.map((field) => field.key)).toEqual([
      'templateLayout',
      'imageAlignment',
      'showBreadcrumbs',
      'showSKU',
      'showStockBadge',
      'showStickyAddToCart',
      'showTrustBadges',
      'showRelatedProducts',
      'showRecentlyViewed',
      'addToCartLabel',
      'showBuyNowButton',
      'buyNowLabel',
    ]);
    expect(fields.find((field) => field.key === 'templateLayout')).toMatchObject({
      type: 'select',
      defaultValue: 'media-left-details-right',
    });
    expect(isDesignControlVisible({ visibleWhen: { key: 'showBuyNowButton', notEquals: false } }, {})).toBe(true);
    expect(isDesignControlVisible({ visibleWhen: { key: 'showBuyNowButton', notEquals: false } }, { showBuyNowButton: false })).toBe(false);
    expect(isDesignControlVisible({ visibleWhen: { key: 'showBuyNowButton', notEquals: false } }, { showBuyNowButton: 'false' })).toBe(false);
  });

  it('covers every page settings group with one control schema', () => {
    const pagesWithSettings = DESIGN_PAGE_REGISTRY.filter((page) => page.settingsGroup && page.key !== 'home');

    pagesWithSettings.forEach((page) => {
      const schema = DESIGN_PAGE_CONTROL_SCHEMAS[page.key];
      expect(schema).toBeDefined();
      const schemaKeys = schema.groups
        .flatMap((group) => group.fields.map((field) => field.key));
      expect(new Set(schemaKeys)).toEqual(new Set(page.ownedKeys));
    });

    Object.entries(DESIGN_PAGE_CONTROL_SCHEMAS).forEach(([pageKey, schema]) => {
      const page = DESIGN_PAGE_REGISTRY.find((item) => item.key === pageKey);
      if (page?.ownedKeys) {
        const schemaKeys = schema.groups.flatMap((group) => group.fields.map((field) => field.key));
        expect(new Set(schemaKeys)).toEqual(new Set(page.ownedKeys));
      }
    });
  });

  it('keeps schema-backed component controls aligned with their persisted keys', () => {
    expect(Object.keys(DESIGN_COMPONENT_CONTROL_SCHEMAS).sort()).toEqual([
      'announcementBar', 'badgeChip', 'brandCard', 'cartItem', 'categoryCard', 'checkoutBlock', 'designTokens', 'formControl',
      'headerLayout', 'headerLogo', 'headerMenu', 'productCard', 'promoCard', 'trustCard',
    ]);

    expect(getDesignComponentControlSchema('productCard').groups.flatMap((group) => group.fields.map((field) => field.key))).toEqual([
      'variant', 'imageRatio', 'imageFit', 'density', 'contentAlign', 'imagePadding', 'titleLines', 'priceStyle',
      'hoverEffect', 'shadow', 'radius', 'badgePosition', 'wishlistPosition', 'actionPlacement',
      'showBrand', 'showCategory', 'showRating', 'showWishlist', 'showShare', 'showSaleCountdown',
    ]);
    expect(getDesignComponentControlSchema('categoryCard').groups.flatMap((group) => group.fields.map((field) => field.key))).toEqual([
      'variant', 'titlePlacement', 'imageRatio', 'density', 'hoverEffect', 'shadow', 'showSubtitle', 'showProductCount',
    ]);

    ['promoCard', 'brandCard', 'trustCard', 'cartItem', 'checkoutBlock', 'formControl', 'badgeChip', 'headerLayout', 'headerLogo', 'headerMenu', 'announcementBar'].forEach((componentKey) => {
      expect(getDesignComponentControlSchema(componentKey)).toBeDefined();
    });

    expect(getDesignComponentControlSchema('headerMenu').groups.flatMap((group) => group.fields.map((field) => field.key))).toEqual([
      'menuItems', 'showMenu',
    ]);
    expect(getDesignComponentControlSchema('designTokens').groups.flatMap((group) => group.fields.map((field) => field.key))).toEqual([
      'buttonStyle', 'cardStyle', 'backgroundStyle', 'headerStyle', 'borderRadius', 'lineHeight', 'letterSpacing', 'headingLetterSpacing',
      'primaryColor', 'secondaryColor', 'backgroundColor', 'surfaceColor', 'textColor', 'mode',
      'errorColor', 'warningColor', 'successColor', 'infoColor',
      'fontFamily', 'headingFont', 'bodyWeight', 'headingWeight',
    ]);
    expect(isDesignControlVisible(
      getDesignComponentControlSchema('announcementBar').groups[0].fields.find((field) => field.key === 'text'),
      { enabled: false },
    )).toBe(false);
    expect(isDesignControlVisible(
      getDesignComponentControlSchema('announcementBar').groups[0].fields.find((field) => field.key === 'text'),
      { enabled: 'true' },
    )).toBe(true);
  });
});
