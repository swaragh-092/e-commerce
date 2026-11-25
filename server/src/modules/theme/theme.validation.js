'use strict';

const Joi = require('joi');
const productRow = require('../../../../shared/product-row.json');
const { productListQuerySchema } = require('../product/product.validation');
const { TEMPLATE_ASSIGNMENT_KEYS, buildAlternateTemplatesSchema } = require('../settings/alternateTemplates');

const hexColor = Joi.string().pattern(/^#[0-9a-fA-F]{3,8}$/).max(9).messages({
  'string.pattern.base': '{{#label}} must be a valid hex color (e.g. #ff0000)',
});
const safeUrl = Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).allow('', null).messages({
  'string.uri': '{{#label}} must be an HTTP or HTTPS URL',
});
const internalLink = Joi.string().pattern(/^\/(?!\/)/).max(500).messages({
  'string.pattern.base': '{{#label}} must be an internal path starting with a single /',
});
const dataUri = Joi.string().pattern(/^data:image\//).max(100000);
const previewImageUrl = Joi.alternatives().try(safeUrl, dataUri).allow('', null);
const linkUrl = Joi.alternatives().try(safeUrl, internalLink).allow('', null);
const sectionImageUrl = Joi.alternatives().try(
  safeUrl,
  Joi.string().pattern(/^\/(?!\/)[^\\\s"']*$/).max(2000),
).allow('', null);
const fontDataUri = Joi.string().pattern(/^data:font\//).max(100000);
const fontUrl = Joi.alternatives().try(safeUrl, internalLink, fontDataUri).allow('', null);
const safeText = Joi.string().max(500).allow('', null);
const themeHeaderLinksSchema = Joi.array().items(Joi.object({
  label: Joi.string().trim().min(1).max(100).required(),
  url: Joi.alternatives().try(
    Joi.string().uri({ scheme: ['http', 'https'] }).max(500),
    Joi.string().pattern(/^\/(?![\/\\])[^\s\\]*$/).max(500),
  ).required(),
}).unknown(false)).max(20).allow(false);

const THEME_MODES = ['light', 'dark'];
const HEADER_STYLES = ['gradient', 'solid', 'glass'];
const BUTTON_STYLES = ['solid', 'soft', 'outline', 'pill'];
const CARD_STYLES = ['elevated', 'outlined', 'flat'];
const BG_STYLES = ['softGradient', 'solid'];
const FONT_WEIGHTS = ['300', '400', '500', '600', '700', '800', '900'];
const themeSections = require('../../../../shared/theme-sections.json');
const SECTION_TYPES = themeSections.presetOrder;
const trustFeatureOptions = themeSections.sections.TRUST_BADGES.itemEditor.fields
  .find(({ key }) => key === 'requiresFeatureFlag').options.map(({ value }) => value);
const catalogFilterFields = Object.fromEntries(Object.entries(themeSections.sections.CATALOG_EXPLORER.settings).map(([key, field]) => {
  if (field.type === 'boolean') return [key, Joi.boolean()];
  if (field.type === 'integer') return [key, Joi.number().integer().min(field.min).max(field.max)];
  const schema = typeof field.options[0] === 'number' ? Joi.number() : Joi.string();
  return [key, schema.valid(...field.options)];
}));
const DATA_SOURCE_TYPES = ['apiBuilder'];
const API_BUILDER_RESOURCES = ['products', 'categories', 'brands', 'productImages', 'tags', 'media', 'pages'];
const API_BUILDER_OPERATORS = ['equals', 'contains', 'in', 'gte', 'lte', 'between'];

const darkPaletteSchema = Joi.object({
  primaryColor: hexColor,
  secondaryColor: hexColor,
  backgroundColor: hexColor,
  surfaceColor: hexColor,
  textColor: hexColor,
  errorColor: hexColor,
  cancelButtonColor: hexColor,
  warningColor: hexColor,
  successColor: hexColor,
  infoColor: hexColor,
}).unknown(false);

const typographyScaleSchema = Joi.object({
  preset: Joi.string().valid('compact', 'default', 'editorial', 'display', 'goldenRatio', 'minorThird', 'custom'),
  fluid: Joi.boolean(),
  h1: Joi.string().max(50).allow('', null),
  h2: Joi.string().max(50).allow('', null),
  h3: Joi.string().max(50).allow('', null),
  h4: Joi.string().max(50).allow('', null),
  h5: Joi.string().max(50).allow('', null),
  h6: Joi.string().max(50).allow('', null),
  body1: Joi.string().max(50).allow('', null),
  body2: Joi.string().max(50).allow('', null),
  fluidConfig: Joi.object({
    bodyMin: Joi.string().max(20).allow('', null),
    bodyMax: Joi.string().max(20).allow('', null),
    h1Min: Joi.string().max(20).allow('', null),
    h1Max: Joi.string().max(20).allow('', null),
    h2Min: Joi.string().max(20).allow('', null),
    h2Max: Joi.string().max(20).allow('', null),
    h3Min: Joi.string().max(20).allow('', null),
    h3Max: Joi.string().max(20).allow('', null),
    h4Min: Joi.string().max(20).allow('', null),
    h4Max: Joi.string().max(20).allow('', null),
    h5Min: Joi.string().max(20).allow('', null),
    h5Max: Joi.string().max(20).allow('', null),
    h6Min: Joi.string().max(20).allow('', null),
    h6Max: Joi.string().max(20).allow('', null),
    minVw: Joi.alternatives().try(Joi.string().max(20), Joi.number()).allow('', null),
    maxVw: Joi.alternatives().try(Joi.string().max(20), Joi.number()).allow('', null),
  }).unknown(false),
}).unknown(false);

const mobileOverridesSchema = Joi.object({
  primaryColor: hexColor.allow(''),
  backgroundColor: hexColor.allow(''),
  surfaceColor: hexColor.allow(''),
  textColor: hexColor.allow(''),
  bodyFontSize: Joi.string().max(30).allow('', null),
  headingScale: Joi.string().max(20).allow('', null),
  sectionPadding: Joi.string().max(30).allow('', null),
  containerPadding: Joi.string().max(30).allow('', null),
}).unknown(false);

const customFontsSchema = Joi.object({
  bodyUrl: fontUrl,
  bodyFamily: Joi.string().max(100).allow('', null),
  bodyFormat: Joi.string().valid('woff2', 'woff', 'ttf', 'otf'),
  headingUrl: fontUrl,
  headingFamily: Joi.string().max(100).allow('', null),
  headingFormat: Joi.string().valid('woff2', 'woff', 'ttf', 'otf'),
}).unknown(false);

const variableFontAxesSchema = Joi.object().pattern(
  Joi.string().max(10),
  Joi.object({
    enabled: Joi.boolean(),
    value: Joi.number(),
    default: Joi.number(),
    min: Joi.number(),
    max: Joi.number(),
  }).unknown(false)
).max(20);

const themeDesignSchema = Joi.object({
  mode: Joi.string().valid(...THEME_MODES),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  backgroundColor: hexColor,
  surfaceColor: hexColor,
  textColor: hexColor,
  darkPalette: darkPaletteSchema,
  fontFamily: Joi.string().max(100).allow('', null),
  headingFont: Joi.string().max(100).allow('', null),
  headingWeight: Joi.string().valid(...FONT_WEIGHTS).allow('', null),
  bodyWeight: Joi.string().valid(...FONT_WEIGHTS).allow('', null),
  errorColor: hexColor,
  cancelButtonColor: hexColor,
  warningColor: hexColor,
  successColor: hexColor,
  infoColor: hexColor,
  lineHeight: Joi.string().max(10).allow('', null),
  lineHeightH1: Joi.string().max(10).allow('', null),
  lineHeightH2: Joi.string().max(10).allow('', null),
  lineHeightH3: Joi.string().max(10).allow('', null),
  lineHeightH4: Joi.string().max(10).allow('', null),
  lineHeightH5: Joi.string().max(10).allow('', null),
  lineHeightH6: Joi.string().max(10).allow('', null),
  letterSpacing: Joi.string().max(10).allow('', null),
  headingLetterSpacing: Joi.string().max(10).allow('', null),
  fontVariationSettings: Joi.string().max(200).allow('', null),
  borderRadius: Joi.string().max(10).allow('', null),
  headerStyle: Joi.string().valid(...HEADER_STYLES),
  buttonStyle: Joi.string().valid(...BUTTON_STYLES),
  cardStyle: Joi.string().valid(...CARD_STYLES),
  backgroundStyle: Joi.string().valid(...BG_STYLES),
  typographyScale: typographyScaleSchema,
  mobileOverrides: mobileOverridesSchema,
  customFonts: customFontsSchema,
  variableFontAxes: variableFontAxesSchema,
}).unknown(false);

const navSchema = Joi.object({
  sticky: Joi.boolean(),
  showCategoryBar: Joi.boolean(),
  bgColor: hexColor.allow('', null),
  fgColor: hexColor.allow('', null),
  logoText: safeText,
  logoUrl: sectionImageUrl,
  logoMaxWidth: Joi.string().max(30).allow('', null),
  showStoreName: Joi.boolean(),
  menuItems: safeText,
  headerLinks: themeHeaderLinksSchema,
  showMenu: Joi.boolean(),
  showSearch: Joi.boolean(),
  showCategoryDropdown: Joi.boolean(),
  showCart: Joi.boolean(),
  showWishlist: Joi.boolean(),
  showAccount: Joi.boolean(),
  actionsOrder: Joi.array().items(Joi.string().valid('search', 'cart', 'wishlist', 'account')).unique().max(4),
}).unknown(false);

const footerStyleSchema = Joi.object({
  bgColor: hexColor.allow(''),
  fgColor: hexColor.allow(''),
}).unknown(false);

const announcementStyleSchema = Joi.object({
  bgColor: hexColor.allow(''),
  fgColor: hexColor.allow(''),
  dismissible: Joi.boolean(),
}).unknown(false);

const imageFocus = Joi.string().valid('left', 'center', 'right', 'top', 'bottom');
const heroSlideSchema = Joi.object({
  eyebrow: safeText,
  title: safeText,
  subtitle: Joi.string().max(1000).allow('', null),
  buttonText: safeText,
  buttonLink: linkUrl,
  secondaryButtonText: safeText,
  secondaryButtonLink: linkUrl,
  image: sectionImageUrl,
  position: imageFocus.allow('', null),
  color: hexColor.allow('', null),
}).unknown(false);

const padding = Joi.number().integer().min(0).max(240);
const margin = Joi.number().integer().min(-240).max(240);

const productBlockPlacementSchema = Joi.string().valid('before-options', 'before-specifications', 'after-details');
const productDetailsOrderSchema = Joi.array().items(Joi.alternatives().try(
  Joi.string().valid('title', 'metadata', 'price', 'summary', 'variants', 'purchase', 'specifications', 'description'),
  Joi.string().pattern(/^custom:.{1,50}$/),
)).min(1).max(20).unique();

const heroBlockSchema = (depth = 0) => Joi.object({
  id: Joi.string().max(50).required(),
  enabled: Joi.boolean(),
  textAlign: Joi.when('type', { is: 'heading', then: Joi.string().valid('left', 'center', 'right'), otherwise: Joi.forbidden() }),
  textSize: Joi.when('type', { is: 'heading', then: Joi.string().valid('small', 'medium', 'large'), otherwise: Joi.forbidden() }),
  textWeight: Joi.when('type', { is: 'heading', then: Joi.string().valid('regular', 'semibold', 'bold'), otherwise: Joi.forbidden() }),
  type: Joi.string().valid(...Object.keys(themeSections.composedBlocks.definitions)).required(),
  binding: Joi.when('type', {
    switch: Object.entries(themeSections.composedBlocks.bindings).map(([type, fields]) => ({
      is: type, then: Joi.string().valid(...Object.keys(fields)),
    })),
    otherwise: Joi.forbidden(),
  }),
  text: Joi.string().max(1500).allow(''),
  productPlacement: depth === 0 ? productBlockPlacementSchema : Joi.forbidden(),
  href: linkUrl,
  url: sectionImageUrl,
  mobileUrl: sectionImageUrl,
  mediaType: Joi.string().valid('image', 'video'),
  mobileMediaType: Joi.string().valid('image', 'video'),
  alt: safeText,
  direction: Joi.string().valid('row', 'column'),
  categorySlug: Joi.when('type', {
    is: 'collection',
    then: Joi.string().max(255).pattern(/^[^/\\?#\s]+$/u).allow(''),
    otherwise: Joi.forbidden(),
  }),
  brandSlug: Joi.when('type', {
    is: 'brand',
    then: Joi.string().max(255).pattern(/^[^/\\?#\s]+$/u).allow(''),
    otherwise: Joi.forbidden(),
  }),
  attributeName: Joi.when('type', {
    is: Joi.valid('product-attribute', 'heading', 'text'),
    then: safeText,
    otherwise: Joi.forbidden(),
  }),
  prefix: Joi.when('type', { is: 'product-attribute', then: Joi.string().max(100).allow(''), otherwise: Joi.forbidden() }),
  suffix: Joi.when('type', { is: 'product-attribute', then: Joi.string().max(100).allow(''), otherwise: Joi.forbidden() }),
  pageSlug: Joi.when('type', { is: 'page', then: Joi.string().max(255).pattern(/^[^/\\?#\s]+$/u).allow(''), otherwise: Joi.forbidden() }),
  gallerySlug: Joi.when('type', { is: 'gallery', then: Joi.string().max(255).pattern(/^[^/\\?#\s]+$/u).allow(''), otherwise: Joi.forbidden() }),
  blogSlug: Joi.when('type', {
    is: 'blog',
    then: Joi.string().max(255).pattern(/^[^/\\?#\s]+$/u).allow(''),
    otherwise: Joi.forbidden(),
  }),
  productSlug: Joi.when('type', {
    is: 'product',
    then: Joi.string().max(255).pattern(/^[^/\\?#\s]+$/u).allow(''),
    otherwise: Joi.forbidden(),
  }),
  tagSlug: Joi.when('type', {
    is: 'tag',
    then: Joi.string().max(255).pattern(/^[^/\\?#\s]+$/u).allow(''),
    otherwise: Joi.forbidden(),
  }),
  children: depth < themeSections.composedBlocks.maxDepth
    ? Joi.when('type', {
      is: Joi.valid(...Object.keys(themeSections.composedBlocks.definitions).filter((type) => themeSections.composedBlocks.definitions[type].allowsChildren)),
      then: Joi.array().items(heroBlockSchema(depth + 1)).max(themeSections.composedBlocks.maxSiblings).unique('id'),
      otherwise: Joi.forbidden(),
    })
    : Joi.forbidden(),
}).unknown(false);

const homepageSectionSchema = Joi.object({
  tagSlugs: Joi.array().items(Joi.string().pattern(/^[a-z0-9-]+$/).max(140)).unique().max(12),
  gallerySlug: Joi.string().pattern(/^[a-z0-9-]+$/).max(140).allow(''),
  id: Joi.string().max(50).required(),
  type: Joi.string().valid(...SECTION_TYPES).required(),
  catalogFilters: Joi.when('type', {
    is: 'catalog-explorer',
    then: Joi.object(catalogFilterFields).unknown(false),
    otherwise: Joi.forbidden(),
  }),
  enabled: Joi.boolean().required(),
  heroBlocks: Joi.when('type', { is: Joi.valid('composed-hero', 'product-info', 'editorial-image-text'), then: Joi.array().items(heroBlockSchema()).max(themeSections.composedBlocks.maxSiblings).unique('id'), otherwise: Joi.forbidden() }),
  detailsBlockOrder: Joi.when('type', { is: 'product-info', then: productDetailsOrderSchema, otherwise: Joi.forbidden() }),
  title: safeText,
  subtitle: safeText,
  source: Joi.string().valid(...Object.keys(productRow.sources)),
  query: Joi.when('type', {
    is: productRow.type,
    then: productListQuerySchema.keys({
      category: Joi.string().max(140),
      categoryId: Joi.string().uuid(),
      brand: Joi.string().max(140),
      sort: Joi.string().valid(...productRow.query.sorts),
      sortBy: Joi.string().valid(...productRow.query.sortFields),
      sortOrder: Joi.string().insensitive().valid(...productRow.query.sortOrders),
      status: Joi.string().valid(productRow.query.status),
      minPrice: Joi.number().min(0),
      maxPrice: Joi.number().min(0),
      maxQty: Joi.number().integer().min(0),
    }).unknown(false).prefs({ noDefaults: true }),
    otherwise: Joi.forbidden(),
  }),
  productIds: Joi.array().items(Joi.string().uuid()).unique().max(productRow.limits.maxStaffPicks),
  pagePosition: Joi.string().valid('above', 'below'),
  productScope: Joi.string().valid('category', 'store'),
  saleLabel: Joi.string().trim().max(100).allow('', null),
  dataSourceKey: Joi.string().max(80).allow('', null),
  dataSourceBlock: Joi.string().max(80).allow('', null),
  dataSourceSlug: Joi.string().max(140).pattern(/^[a-z0-9-]+$/).allow('', null),
  count: Joi.number().integer().min(productRow.limits.minCount).max(productRow.limits.packageMaxCount),
  columnsDesktop: Joi.when('type', {
    is: Joi.valid('product-row', 'category-shortcuts', 'brand-showcase', 'value-props', 'trust-badges'),
    then: Joi.number().valid(2, 3, 4, 6),
    otherwise: Joi.forbidden(),
  }),
  selectedCategorySlugs: Joi.when('type', {
    is: 'category-shortcuts',
    then: Joi.array().items(Joi.string().pattern(/^[a-z0-9-]+$/).max(140)).unique().max(16),
    otherwise: Joi.forbidden(),
  }),
  selectedBrandSlugs: Joi.when('type', {
    is: 'brand-showcase',
    then: Joi.array().items(Joi.string().pattern(/^[a-z0-9-]+$/).max(140)).unique().max(24),
    otherwise: Joi.forbidden(),
  }),
  columnsMobile: Joi.when('type', {
    is: productRow.type,
    then: Joi.number().valid(...productRow.responsiveColumns.mobile),
    otherwise: Joi.forbidden(),
  }),
  columnsTablet: Joi.when('type', {
    is: productRow.type,
    then: Joi.number().valid(...productRow.responsiveColumns.tablet),
    otherwise: Joi.forbidden(),
  }),
  horizontalGap: Joi.when('type', {
    is: productRow.type,
    then: Joi.number().integer().min(0).max(productRow.gridGapMax),
    otherwise: Joi.forbidden(),
  }),
  mobileCarousel: Joi.when('type', {
    is: productRow.type,
    then: Joi.boolean(),
    otherwise: Joi.forbidden(),
  }),
  verticalGap: Joi.when('type', {
    is: productRow.type,
    then: Joi.number().integer().min(0).max(productRow.gridGapMax),
    otherwise: Joi.forbidden(),
  }),
  layout: Joi.string().valid(...productRow.layouts.homepage),
  viewAllLabel: safeText,
  viewAllLink: linkUrl,
  autoPlay: Joi.boolean(),
  interval: Joi.number().integer().min(1000).max(30000),
  dynamic: Joi.boolean(),
  variant: Joi.string().max(50),
  image: sectionImageUrl,
  imageFocus,
  imagePosition: Joi.string().valid('left', 'right', 'top', 'background'),
  eyebrow: safeText,
  ctaText: safeText,
  ctaLink: linkUrl,
  endDate: Joi.string().isoDate().allow('', null),
  placement: Joi.string().valid('header', 'footer'),
  textAlign: Joi.string().valid('left', 'center', 'right'),
  verticalAlign: Joi.string().valid('top', 'center', 'bottom'),
  widthMode: Joi.string().valid('container', 'narrow', 'full', 'custom'),
  customMaxWidth: Joi.number().integer().min(320).max(3840),
  minHeight: Joi.number().integer().min(0).max(1200),
  paddingTop: padding,
  paddingBottom: padding,
  paddingLeft: padding,
  paddingRight: padding,
  marginTop: margin,
  marginBottom: margin,
  marginLeft: margin,
  marginRight: margin,
  backgroundColor: hexColor,
  backgroundImage: sectionImageUrl,
  backgroundSize: Joi.string().valid('cover', 'contain', 'auto', '100% 100%'),
  backgroundPosition: Joi.string().valid('center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'),
  backgroundRepeat: Joi.string().valid('no-repeat', 'repeat', 'repeat-x', 'repeat-y'),
  backgroundAttachment: Joi.string().valid('scroll', 'fixed', 'local'),
  borderStyle: Joi.string().valid('none', 'solid', 'dashed', 'dotted', 'double'),
  borderWidth: Joi.number().integer().min(0).max(24),
  borderColor: hexColor,
  borderRadius: Joi.number().integer().min(0).max(96),
  boxShadow: Joi.string().valid('none', 'sm', 'md', 'lg', 'xl', '2xl', 'inner'),
  hideOnMobile: Joi.boolean(),
  hideOnDesktop: Joi.boolean(),
  anchorId: Joi.string().max(100),
  customClassName: Joi.string().max(200),
  mobileLayout: Joi.string().valid('stack', 'carousel', 'compact'),
  slides: Joi.array().items(heroSlideSchema).max(themeSections.maxLegacyBlocks),
  items: Joi.array().items(Joi.object({
    title: safeText,
    subtitle: Joi.string().max(1000).allow('', null),
    text: Joi.string().max(1000).allow('', null),
    author: safeText,
    role: safeText,
    image: sectionImageUrl,
    link: linkUrl,
    kicker: safeText,
    ctaText: safeText,
    icon: Joi.string().max(50).allow('', null),
    color: hexColor.allow('', null),
    backgroundColor: hexColor.allow('', null),
    accentColor: hexColor.allow('', null),
    requiresFeatureFlag: Joi.string().valid(...trustFeatureOptions),
  }).unknown(false)).max(themeSections.maxLegacyBlocks),
}).unknown(false);

const valuePropSchema = Joi.object({
  icon: Joi.string().max(50).allow('', null),
  title: safeText,
  text: safeText,
  requiresFeatureFlag: Joi.string().valid(...trustFeatureOptions),
}).unknown(false);

const promoBannerSchema = Joi.object({
  id: Joi.string().max(100),
  image: sectionImageUrl,
  kicker: safeText,
  title: safeText,
  subtitle: safeText,
  ctaText: safeText,
  link: linkUrl,
  color: hexColor.allow('', null),
  accentColor: hexColor.allow('', null),
}).unknown(false);

const metaSchema = Joi.object({
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(100).required(),
  name: Joi.string().min(1).max(255).required(),
  version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).max(20).required(),
  author: Joi.string().max(255).allow('', null),
  description: Joi.string().max(2000).allow('', null),
  category: Joi.string().max(50).allow('', null),
  industries: Joi.array().items(Joi.string().max(50)).max(10).default([]),
  tags: Joi.array().items(Joi.string().max(50)).max(20).default([]),
  previewImage: previewImageUrl,
  mobilePreviewImage: previewImageUrl,
  bestFor: Joi.string().max(500).allow('', null),
  platformCompatibility: Joi.string().max(20).allow('', null),
}).unknown(false);

const pageLayoutSectionsSchema = (...types) => Joi.array().items(
  homepageSectionSchema.keys({
    type: Joi.string().valid(productRow.type, ...types).required(),
    layout: Joi.string().valid(...productRow.layouts.page),
  }),
).max(6);

const pageProductRowsSchema = pageLayoutSectionsSchema();
const contentPageLayoutSchema = pageLayoutSectionsSchema(...themeSections.pageSectionTypes.filter((type) => type !== productRow.type));

const pageSectionsSchema = (systemTypes) => Joi.array().items(
  homepageSectionSchema.keys({ type: Joi.string().valid(...SECTION_TYPES, ...systemTypes).required() }),
).max(20);

const pageTemplateSchema = Joi.object({
  productRows: contentPageLayoutSchema,
  layout: Joi.string().max(80).required(),
  imageAlignment: Joi.string().valid('horizontal', 'vertical'),
  showSKU: Joi.boolean(),
  showStockBadge: Joi.boolean(),
  showTrustBadges: Joi.boolean(),
  showRelatedProducts: Joi.boolean(),
  showRecentlyViewed: Joi.boolean(),
  showStickyAddToCart: Joi.boolean(),
  showBreadcrumbs: Joi.boolean(),
  addToCartLabel: safeText,
  showBuyNowButton: Joi.boolean(),
  buyNowLabel: safeText,
  productsPerRow: Joi.number().integer().min(1).max(6),
  filterLayout: Joi.string().valid('sidebar', 'drawer', 'topbar'),
}).unknown(false);

const alternatePageTemplates = (group, systemTypes) => buildAlternateTemplatesSchema(
  TEMPLATE_ASSIGNMENT_KEYS[group],
  Joi.object({
    productRows: contentPageLayoutSchema,
    sections: pageSectionsSchema(systemTypes),
  }).unknown(true),
);

const productSectionTypes = ['product-info', 'product-reviews'];
const categorySectionTypes = ['category-header', 'category-products'];

const categoryPageTemplateSchema = Joi.object({
  productRows: contentPageLayoutSchema,
  sections: pageSectionsSchema(categorySectionTypes),
  alternateTemplates: alternatePageTemplates('categoryPage', categorySectionTypes),
  heroTitle: safeText,
  headerLayout: Joi.string().valid('standard', 'cover', 'split'),
  showSubcategories: Joi.boolean(),
}).unknown(false);

const brandPageTemplateSchema = Joi.object({
  productRows: contentPageLayoutSchema,
  sections: pageSectionsSchema(['brands-header', 'brands-list']),
  layout: Joi.string().valid('standard', 'overlay', 'minimal').required(),
  title: safeText,
  subtitle: safeText,
  productsPerRow: Joi.number().integer().min(2).max(5),
  imageAspectRatio: Joi.string().valid('square', 'landscape', 'portrait'),
  cardStyle: Joi.string().valid('inherit', 'elevated', 'outlined', 'flat'),
  cardBorderRadius: Joi.number().integer().min(0).max(48),
  showDescriptions: Joi.boolean(),
  showProductCount: Joi.boolean(),
  showAlphabeticalFilter: Joi.boolean(),
  showFeaturedSection: Joi.boolean(),
  featuredLayout: Joi.string().valid('banner', 'carousel', 'grid'),
  featuredCount: Joi.number().integer().min(0).max(12),
}).unknown(false);

const cartPageTemplateSchema = Joi.object({
  showCartTitle: Joi.boolean(),
  showCartProducts: Joi.boolean(),
  showCartSummary: Joi.boolean(),
  productRows: contentPageLayoutSchema,
  sections: pageSectionsSchema(['cart-main']),
  layout: Joi.string().valid('standard', 'compact').required(),
  showCrossSells: Joi.boolean(),
  showTrustBadges: Joi.boolean(),
  emptyStateText: safeText,
}).unknown(false);

const accountPageTemplateSchema = Joi.object({
  productRows: contentPageLayoutSchema,
  sections: pageSectionsSchema(['account-main']),
  layout: Joi.string().valid('tabs', 'sidebar').required(),
  orderCardStyle: Joi.string().valid('detailed', 'compact'),
  showSupportInfo: Joi.boolean(),
}).unknown(false);

const blogPageTemplateSchema = Joi.object({
  productRows: contentPageLayoutSchema,
  sections: pageSectionsSchema(['blog-header', 'blog-posts']),
  listLayout: Joi.string().valid('grid', 'list', 'masonry').required(),
  articleLayout: Joi.string().valid('standard', 'cover'),
  showAuthor: Joi.boolean(),
  showDate: Joi.boolean(),
}).unknown(false);

const componentStyleSchema = Joi.object({
  variant: Joi.string().max(80).allow('', null),
  imageRatio: Joi.string().valid('1/1', '4/5', '4/3', '3/4', '16/9').allow('', null),
  contentAlign: Joi.string().valid('left', 'center', 'right'),
  imagePadding: Joi.string().valid('none', 'comfortable', 'spacious'),
  titleLines: Joi.number().integer().min(1).max(4),
  wishlistPosition: Joi.string().valid('top-left', 'top-right', 'bottom-left', 'bottom-right'),
  actionPlacement: Joi.string().valid('footer', 'image-overlay'),
  headerStyle: Joi.string().valid('stripe', 'plain', 'accent'),
  fill: Joi.string().valid('paper', 'muted', 'transparent'),
  focusStyle: Joi.string().valid('brand', 'glow', 'underline'),
  labelStyle: Joi.string().valid('floating', 'placeholder'),
  size: Joi.string().valid('small', 'medium'),
  weight: Joi.string().valid('regular', 'bold', 'black'),
  textTransform: Joi.string().valid('uppercase', 'none'),
  letterSpacing: Joi.string().max(20).allow('', null),
  imageFit: Joi.string().valid('cover', 'contain').allow('', null),
  showBrand: Joi.boolean(),
  showCategory: Joi.boolean(),
  showRating: Joi.boolean(),
  showWishlist: Joi.boolean(),
  showShare: Joi.boolean(),
  showVariantPill: Joi.boolean(),
  showSaleCountdown: Joi.boolean(),
  showSubtitle: Joi.boolean(),
  showProductCount: Joi.boolean(),
  titlePlacement: Joi.string().valid('below', 'overlay', 'centered').allow('', null),
  priceStyle: Joi.string().valid('regular', 'bold', 'minimal').allow('', null),
  badgeStyle: Joi.string().valid('pill', 'corner', 'ribbon', 'minimal').allow('', null),
  badgePosition: Joi.string().valid('top-left', 'top-right', 'bottom-left', 'bottom-right').allow('', null),
  hoverEffect: Joi.string().valid('none', 'lift', 'zoom', 'fade').allow('', null),
  radius: Joi.string().valid('none', 'small', 'medium', 'large', 'pill').allow('', null),
  shadow: Joi.string().valid('none', 'soft', 'medium', 'strong').allow('', null),
  density: Joi.string().valid('compact', 'comfortable', 'spacious').allow('', null),
  ctaStyle: Joi.string().valid('button', 'text-link', 'hidden', 'solid', 'soft', 'outline').allow('', null),
  imagePlacement: Joi.string().valid('left', 'right', 'top', 'background').allow('', null),
  titleSize: Joi.string().valid('small', 'medium', 'large').allow('', null),
}).unknown(false);

const componentStylesSchema = Joi.object({
  productCard: componentStyleSchema.keys({
    cardBorderColor: hexColor.allow(''),
    cardBorderWidth: Joi.number().integer().min(0).max(4).allow(''),
  }),
  categoryCard: componentStyleSchema,
  promoCard: componentStyleSchema,
  brandCard: componentStyleSchema,
  trustCard: componentStyleSchema,
  reviewCard: componentStyleSchema,
  contentCard: componentStyleSchema,
  cartItem: componentStyleSchema,
  checkoutBlock: componentStyleSchema,
  formControl: componentStyleSchema,
  badgeChip: componentStyleSchema,
}).unknown(false);

const sectionPresetsSchema = Joi.object().pattern(
  Joi.string().max(80),
  homepageSectionSchema.fork(['id', 'enabled'], (schema) => schema.optional())
).max(30).unknown(false);

const capabilitiesSchema = Joi.object({
  design: Joi.boolean(),
  layoutStyle: Joi.boolean(),
  homepageSections: Joi.boolean(),
  demoContent: Joi.boolean(),
  pageTemplates: Joi.boolean(),
  dataSources: Joi.boolean(),
  componentStyles: Joi.boolean(),
  sectionPresets: Joi.boolean(),
  customCode: Joi.boolean().valid(false),
}).unknown(false);

const apiBuilderFilterSchema = Joi.object({
  field: Joi.string().trim().max(80).required(),
  operator: Joi.string().valid(...API_BUILDER_OPERATORS).default('equals'),
  source: Joi.string().valid('query', 'static').default('static'),
  param: Joi.string().trim().max(80).allow('', null),
  defaultValue: Joi.any().allow(null, ''),
  value: Joi.any().allow(null, ''),
}).unknown(false);

const apiBuilderNodeSchema = Joi.object({
  id: Joi.string().trim().max(80).allow('', null),
  key: Joi.string().trim().max(80).allow('', null),
  resource: Joi.string().valid(...API_BUILDER_RESOURCES).required(),
  relation: Joi.string().trim().max(80).allow('', null),
  enabled: Joi.boolean().default(true),
  mode: Joi.string().valid('selected', 'all', 'filtered').default('all'),
  selectedIds: Joi.array().items(Joi.string().trim().max(140)).max(100).default([]),
  limit: Joi.number().integer().min(1).max(50).default(10),
  pagination: Joi.object({
    enabled: Joi.boolean().default(false),
    pageParam: Joi.string().trim().max(80).allow('', null).default('page'),
    pageSizeParam: Joi.string().trim().max(80).allow('', null).default('pageSize'),
    defaultPage: Joi.number().integer().min(1).max(100000).default(1),
    defaultPageSize: Joi.number().integer().min(1).max(50).default(10),
  }).default({ enabled: false }),
  depth: Joi.number().integer().min(1).max(2).default(1),
  fields: Joi.array().items(Joi.string().trim().max(80)).max(30).default([]),
  filters: Joi.array().items(apiBuilderFilterSchema).max(10).default([]),
  relations: Joi.array().items(Joi.link('#templateApiBuilderNode')).max(12).default([]),
  sortBy: Joi.string().trim().max(80).allow('', null),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('ASC'),
}).id('templateApiBuilderNode').unknown(false);

const dataSourceSchema = Joi.object({
  key: Joi.string().trim().max(80).required(),
  type: Joi.string().valid(...DATA_SOURCE_TYPES).required(),
  definition: Joi.object({
    name: Joi.string().trim().max(140).required(),
    slug: Joi.string().trim().max(140).pattern(/^[a-z0-9-]+$/).allow('', null),
    description: Joi.string().trim().allow('', null).max(1000),
    isActive: Joi.boolean().default(true),
    config: Joi.object({
      responseMode: Joi.string().valid('object', 'array').default('object'),
      includeMeta: Joi.boolean().default(true),
      blocks: Joi.array().items(apiBuilderNodeSchema).min(1).max(8).required(),
    }).required(),
  }).required().unknown(false),
}).unknown(false);

const packageSchema = Joi.object({
  schemaVersion: Joi.number().integer().valid(1, 2, 3).required().messages({
    'any.only': 'schemaVersion {{#value}} is not supported by this platform (must be 1, 2, or 3)',
  }),
  meta: metaSchema.required(),
  capabilities: capabilitiesSchema,
  design: Joi.object({
    theme: themeDesignSchema.required(),
  }).unknown(false).required(),
  layout: Joi.object({
    nav: navSchema,
    footerStyle: footerStyleSchema,
    announcementStyle: announcementStyleSchema,
    homepageSections: Joi.array().items(homepageSectionSchema).max(20),
  }).unknown(false),
  demoContent: Joi.object({
    announcementText: safeText,
    heroSlides: Joi.array().items(heroSlideSchema).max(10),
    valueProps: Joi.array().items(valuePropSchema).max(12),
    promoBanners: Joi.array().items(promoBannerSchema).max(12),
  }).unknown(false),
  dataSources: Joi.array().items(dataSourceSchema).max(12),
  pageTemplates: Joi.object({
    product: pageTemplateSchema.keys({
      sections: pageSectionsSchema(productSectionTypes),
      alternateTemplates: alternatePageTemplates('productPage', productSectionTypes),
    }),
    category: categoryPageTemplateSchema,
    collection: pageTemplateSchema.keys({
      sections: pageSectionsSchema(['catalog-header', 'catalog-products']),
      showFilters: Joi.boolean(),
      categoryDepth: Joi.number().integer().min(1).max(5),
      showCategoryIcon: Joi.boolean(),
    }),
    brand: brandPageTemplateSchema,
    cart: cartPageTemplateSchema,
    account: accountPageTemplateSchema,
    blog: blogPageTemplateSchema,
    'checkout': Joi.object({ productRows: pageProductRowsSchema }).unknown(false),
    'wishlist': Joi.object({ productRows: contentPageLayoutSchema }).unknown(false),
    'search': Joi.object({ productRows: contentPageLayoutSchema }).unknown(false),
    'not-found': Joi.object({ productRows: contentPageLayoutSchema }).unknown(false),
    'orders': Joi.object({ productRows: contentPageLayoutSchema }).unknown(false),

    page: pageTemplateSchema,
  }).unknown(false),
  componentStyles: componentStylesSchema,
  sectionPresets: sectionPresetsSchema,
  // Explicitly reject dangerous fields
  customCSS: Joi.forbidden().messages({ 'any.unknown': 'customCSS is not allowed in template packages' }),
  headScripts: Joi.forbidden().messages({ 'any.unknown': 'headScripts is not allowed in template packages' }),
  bodyScripts: Joi.forbidden().messages({ 'any.unknown': 'bodyScripts is not allowed in template packages' }),
}).unknown(false);

// API request schemas
const applyRequestSchema = Joi.object({
  packageData: packageSchema.required(),
  scopes: Joi.array().items(Joi.string().valid('design', 'layoutStyle', 'homepageSections', 'demoContent', 'dataSources', 'pageTemplates', 'componentStyles', 'sectionPresets')).min(1).required(),
  replaceDemoContent: Joi.boolean().default(false),
});

const previewRequestSchema = Joi.object({
  packageData: packageSchema.required(),
  scopes: Joi.array().items(Joi.string().valid('design', 'layoutStyle', 'homepageSections', 'demoContent', 'dataSources', 'pageTemplates', 'componentStyles', 'sectionPresets')).min(1).default(['design', 'layoutStyle']),
});

const importRequestSchema = Joi.object({
  packageData: packageSchema.required(),
});

const idParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = {
  themeHeaderLinksSchema,
  productBlockPlacementSchema,
  productDetailsOrderSchema,
  packageSchema,
  applyRequestSchema,
  previewRequestSchema,
  importRequestSchema,
  idParamSchema,
  SECTION_TYPES,
  THEME_MODES,
};
