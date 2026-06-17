'use strict';

const Joi = require('joi');

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
const safeText = Joi.string().max(500).allow('', null);

const THEME_MODES = ['light', 'dark'];
const HEADER_STYLES = ['gradient', 'solid', 'glass'];
const BUTTON_STYLES = ['solid', 'soft', 'outline'];
const CARD_STYLES = ['elevated', 'outlined', 'flat'];
const BG_STYLES = ['softGradient', 'solid'];
const FONT_WEIGHTS = ['300', '400', '500', '600', '700', '800', '900'];
const SECTION_TYPES = ['hero-carousel', 'value-props', 'category-shortcuts', 'promo-banners', 'product-row', 'brand-showcase', 'editorial-image-text', 'testimonials', 'logo-cloud', 'newsletter-signup', 'countdown-sale', 'featured-collection-grid', 'faq', 'trust-badges', 'recently-viewed'];
const PRODUCT_SOURCES = ['featured', 'sale', 'bestSellers', 'newest', 'recommended'];
const DATA_SOURCE_TYPES = ['apiBuilder'];
const API_BUILDER_RESOURCES = ['products', 'categories', 'brands', 'productImages', 'tags', 'media', 'pages'];
const API_BUILDER_OPERATORS = ['equals', 'contains', 'in', 'gte', 'lte', 'between'];

const darkPaletteSchema = Joi.object({
  primaryColor: hexColor,
  secondaryColor: hexColor,
  backgroundColor: hexColor,
  surfaceColor: hexColor,
  textColor: hexColor,
}).unknown(false);

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
  lineHeight: Joi.string().max(10).allow('', null),
  letterSpacing: Joi.string().max(10).allow('', null),
  headingLetterSpacing: Joi.string().max(10).allow('', null),
  borderRadius: Joi.string().max(10).allow('', null),
  headerStyle: Joi.string().valid(...HEADER_STYLES),
  buttonStyle: Joi.string().valid(...BUTTON_STYLES),
  cardStyle: Joi.string().valid(...CARD_STYLES),
  backgroundStyle: Joi.string().valid(...BG_STYLES),
}).unknown(false);

const navSchema = Joi.object({
  sticky: Joi.boolean(),
  showCategoryBar: Joi.boolean(),
}).unknown(false);

const footerStyleSchema = Joi.object({
  bgColor: hexColor,
  fgColor: hexColor,
}).unknown(false);

const announcementStyleSchema = Joi.object({
  bgColor: hexColor,
  fgColor: hexColor,
  dismissible: Joi.boolean(),
}).unknown(false);

const homepageSectionSchema = Joi.object({
  id: Joi.string().max(50).required(),
  type: Joi.string().valid(...SECTION_TYPES).required(),
  enabled: Joi.boolean().required(),
  title: safeText,
  subtitle: safeText,
  source: Joi.string().valid(...PRODUCT_SOURCES),
  dataSourceKey: Joi.string().max(80).allow('', null),
  dataSourceSlug: Joi.string().max(140).allow('', null),
  count: Joi.number().integer().min(1).max(50),
  layout: Joi.string().valid('grid', 'carousel'),
  viewAllLabel: safeText,
  viewAllLink: linkUrl,
  autoPlay: Joi.boolean(),
  interval: Joi.number().integer().min(1000).max(30000),
  dynamic: Joi.boolean(),
  variant: Joi.string().max(50),
  image: safeUrl,
  imagePosition: Joi.string().valid('left', 'right', 'top', 'background'),
  ctaText: safeText,
  ctaLink: linkUrl,
  mobileLayout: Joi.string().valid('stack', 'carousel', 'compact'),
  items: Joi.array().items(Joi.object({
    title: safeText,
    text: Joi.string().max(1000).allow('', null),
    author: safeText,
    role: safeText,
    image: safeUrl,
    link: linkUrl,
  }).unknown(false)).max(12),
}).unknown(false);

const heroSlideSchema = Joi.object({
  eyebrow: safeText,
  title: safeText,
  subtitle: Joi.string().max(1000).allow('', null),
  buttonText: safeText,
  buttonLink: linkUrl,
  secondaryButtonText: safeText,
  secondaryButtonLink: linkUrl,
  image: safeUrl.label('image'),
  position: Joi.string().valid('left', 'center', 'right').allow('', null),
  color: hexColor.allow('', null),
}).unknown(false);

const valuePropSchema = Joi.object({
  icon: Joi.string().max(50).allow('', null),
  title: safeText,
  text: safeText,
}).unknown(false);

const promoBannerSchema = Joi.object({
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

const pageTemplateSchema = Joi.object({
  layout: Joi.string().max(80).required(),
  showTrustBadges: Joi.boolean(),
  showRelatedProducts: Joi.boolean(),
  showRecentlyViewed: Joi.boolean(),
  showStickyAddToCart: Joi.boolean(),
  showBreadcrumbs: Joi.boolean(),
  productsPerRow: Joi.number().integer().min(1).max(6),
  filterLayout: Joi.string().valid('sidebar', 'drawer', 'topbar'),
}).unknown(false);

const brandPageTemplateSchema = Joi.object({
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
  layout: Joi.string().valid('standard', 'compact').required(),
  showCrossSells: Joi.boolean(),
  showTrustBadges: Joi.boolean(),
  emptyStateText: safeText,
}).unknown(false);

const accountPageTemplateSchema = Joi.object({
  layout: Joi.string().valid('tabs', 'sidebar').required(),
  orderCardStyle: Joi.string().valid('detailed', 'compact'),
  showSupportInfo: Joi.boolean(),
}).unknown(false);

const blogPageTemplateSchema = Joi.object({
  listLayout: Joi.string().valid('grid', 'list', 'masonry').required(),
  articleLayout: Joi.string().valid('standard', 'cover'),
  showAuthor: Joi.boolean(),
  showDate: Joi.boolean(),
}).unknown(false);

const componentStyleSchema = Joi.object({
  variant: Joi.string().max(80).allow('', null),
  imageRatio: Joi.string().valid('1/1', '4/5', '4/3', '3/4', '16/9').allow('', null),
  imageFit: Joi.string().valid('cover', 'contain').allow('', null),
  showBrand: Joi.boolean(),
  showCategory: Joi.boolean(),
  showRating: Joi.boolean(),
  showWishlist: Joi.boolean(),
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
  ctaStyle: Joi.string().valid('button', 'text-link', 'hidden').allow('', null),
  imagePlacement: Joi.string().valid('left', 'right', 'top', 'background').allow('', null),
  titleSize: Joi.string().valid('small', 'medium', 'large').allow('', null),
}).unknown(false);

const componentStylesSchema = Joi.object({
  productCard: componentStyleSchema,
  categoryCard: componentStyleSchema,
  promoCard: componentStyleSchema,
  brandCard: componentStyleSchema,
  trustCard: componentStyleSchema,
  reviewCard: componentStyleSchema,
  contentCard: componentStyleSchema,
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
    product: pageTemplateSchema,
    collection: pageTemplateSchema,
    brand: brandPageTemplateSchema,
    cart: cartPageTemplateSchema,
    account: accountPageTemplateSchema,
    blog: blogPageTemplateSchema,
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
  packageSchema,
  applyRequestSchema,
  previewRequestSchema,
  importRequestSchema,
  idParamSchema,
  SECTION_TYPES,
  THEME_MODES,
};
