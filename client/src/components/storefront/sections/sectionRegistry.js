export const SECTION_TYPES = Object.freeze({
  HERO_CAROUSEL: 'hero-carousel',
  VALUE_PROPS: 'value-props',
  CATEGORY_SHORTCUTS: 'category-shortcuts',
  PROMO_BANNERS: 'promo-banners',
  PRODUCT_ROW: 'product-row',
  BRAND_SHOWCASE: 'brand-showcase',
  EDITORIAL_IMAGE_TEXT: 'editorial-image-text',
  TESTIMONIALS: 'testimonials',
  LOGO_CLOUD: 'logo-cloud',
  NEWSLETTER_SIGNUP: 'newsletter-signup',
  COUNTDOWN_SALE: 'countdown-sale',
  FEATURED_COLLECTION_GRID: 'featured-collection-grid',
  FAQ: 'faq',
  TRUST_BADGES: 'trust-badges',
  RECENTLY_VIEWED: 'recently-viewed',
  PRODUCT_INFO: 'product-info',
  PRODUCT_REVIEWS: 'product-reviews',
  CATEGORY_HEADER: 'category-header',
  CATEGORY_PRODUCTS: 'category-products',
  CATALOG_HEADER: 'catalog-header',
  CATALOG_PRODUCTS: 'catalog-products',
  BRANDS_HEADER: 'brands-header',
  BRANDS_LIST: 'brands-list',
  BLOG_HEADER: 'blog-header',
  BLOG_POSTS: 'blog-posts',
  ACCOUNT_MAIN: 'account-main',
  CART_MAIN: 'cart-main',
  ORDERS_MAIN: 'orders-main',
  WISHLIST_MAIN: 'wishlist-main',
  SEARCH_MAIN: 'search-main',
  CHECKOUT_MAIN: 'checkout-main',
  NOT_FOUND_MAIN: 'not-found-main',
});

// ─── Variants per section type ──────────────────────────────────────────────
export const SECTION_VARIANTS = Object.freeze({
  [SECTION_TYPES.HERO_CAROUSEL]: ['overlay', 'split', 'split-editorial', 'centered', 'full-bleed'],
  [SECTION_TYPES.PRODUCT_ROW]: ['carousel', 'grid', 'grid-compact'],
  [SECTION_TYPES.CATEGORY_SHORTCUTS]: ['icon-grid', 'image-tiles', 'compact-chips'],
  [SECTION_TYPES.PROMO_BANNERS]: ['cards', 'banner-stack', 'asymmetric'],
  [SECTION_TYPES.FEATURED_COLLECTION_GRID]: ['image-tiles', 'icon-grid', 'compact-chips'],
  [SECTION_TYPES.EDITORIAL_IMAGE_TEXT]: ['image-left', 'image-right', 'overlap-card'],
  [SECTION_TYPES.TESTIMONIALS]: ['cards', 'quote-wall', 'carousel'],
  [SECTION_TYPES.VALUE_PROPS]: ['icon-row', 'card-grid'],
  [SECTION_TYPES.TRUST_BADGES]: ['icon-row', 'card-grid'],
  [SECTION_TYPES.NEWSLETTER_SIGNUP]: ['banner', 'inline-form'],
  [SECTION_TYPES.COUNTDOWN_SALE]: ['bar', 'card'],
});

// ─── Block schemas (allowed block types per section) ────────────────────────
export const SECTION_BLOCK_SCHEMAS = Object.freeze({
  [SECTION_TYPES.HERO_CAROUSEL]: ['eyebrow', 'heading', 'text', 'button', 'secondary-button', 'image'],
  [SECTION_TYPES.EDITORIAL_IMAGE_TEXT]: ['heading', 'text', 'button', 'image'],
  [SECTION_TYPES.PROMO_BANNERS]: ['kicker', 'heading', 'text', 'button'],
  [SECTION_TYPES.NEWSLETTER_SIGNUP]: ['heading', 'text', 'button'],
  [SECTION_TYPES.COUNTDOWN_SALE]: ['heading', 'text', 'timer', 'button'],
});

export const SECTION_DEFINITIONS = Object.freeze({
  [SECTION_TYPES.HERO_CAROUSEL]: { label: 'Hero carousel', family: 'hero', data: 'content', live: true, preview: true, defaultVariant: 'overlay' },
  [SECTION_TYPES.VALUE_PROPS]: { label: 'Value props', family: 'trust', data: 'content', live: true, preview: true, defaultVariant: 'icon-row' },
  [SECTION_TYPES.CATEGORY_SHORTCUTS]: { label: 'Category shortcuts', family: 'merchandising', data: 'categories', live: true, preview: true, defaultVariant: 'image-tiles' },
  [SECTION_TYPES.PROMO_BANNERS]: { label: 'Promo banners', family: 'campaign', data: 'content', live: true, preview: true, defaultVariant: 'cards' },
  [SECTION_TYPES.PRODUCT_ROW]: { label: 'Product row', family: 'merchandising', data: 'products', live: true, preview: true, defaultVariant: 'carousel' },
  [SECTION_TYPES.BRAND_SHOWCASE]: { label: 'Brand showcase', family: 'merchandising', data: 'brands', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.EDITORIAL_IMAGE_TEXT]: { label: 'Editorial image and text', family: 'story', data: 'content', live: true, preview: true, defaultVariant: 'image-right' },
  [SECTION_TYPES.TESTIMONIALS]: { label: 'Testimonials', family: 'trust', data: 'content', live: true, preview: true, defaultVariant: 'cards' },
  [SECTION_TYPES.LOGO_CLOUD]: { label: 'Logo cloud', family: 'trust', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.NEWSLETTER_SIGNUP]: { label: 'Newsletter signup', family: 'conversion', data: 'content', live: true, preview: true, defaultVariant: 'banner' },
  [SECTION_TYPES.COUNTDOWN_SALE]: { label: 'Countdown sale', family: 'campaign', data: 'content', live: true, preview: true, defaultVariant: 'bar' },
  [SECTION_TYPES.FEATURED_COLLECTION_GRID]: { label: 'Featured collection grid', family: 'merchandising', data: 'categories', live: true, preview: true, defaultVariant: 'image-tiles' },
  [SECTION_TYPES.FAQ]: { label: 'FAQ', family: 'trust', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.TRUST_BADGES]: { label: 'Trust badges', family: 'trust', data: 'content', live: true, preview: true, defaultVariant: 'icon-row' },
  [SECTION_TYPES.RECENTLY_VIEWED]: { label: 'Recently viewed', family: 'merchandising', data: 'local', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.PRODUCT_INFO]: { label: 'Product information', family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.PRODUCT_REVIEWS]: { label: 'Product reviews', family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.CATEGORY_HEADER]: { label: 'Category header', family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.CATEGORY_PRODUCTS]: { label: 'Category products', family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.CATALOG_HEADER]: { label: 'Catalog header', family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.CATALOG_PRODUCTS]: { label: 'Catalog products', family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.BRANDS_HEADER]: { label: 'Brands header', family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.BRANDS_LIST]: { label: 'Brands list', family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.BLOG_HEADER]: { label: 'Blog header', family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.BLOG_POSTS]: { label: 'Blog posts', family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.ACCOUNT_MAIN]: { label: 'Account dashboard',           family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.CART_MAIN]:    { label: 'Cart items and checkout',      family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.ORDERS_MAIN]:  { label: 'Orders list',                  family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.WISHLIST_MAIN]:  { label: 'Wishlist items',             family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.SEARCH_MAIN]:    { label: 'Search results',             family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.CHECKOUT_MAIN]:  { label: 'Checkout form and summary',  family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
  [SECTION_TYPES.NOT_FOUND_MAIN]: { label: '404 error page',             family: 'system', data: 'content', live: true, preview: true, defaultVariant: null },
});

export const SECTION_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(SECTION_DEFINITIONS).map(([type, definition]) => [type, definition.label]))
);

const knownSectionTypes = new Set(Object.values(SECTION_TYPES));
const heroSectionTypes = new Set([SECTION_TYPES.HERO_CAROUSEL]);
const productDataSectionTypes = new Set([SECTION_TYPES.PRODUCT_ROW]);
const categoryDataSectionTypes = new Set([SECTION_TYPES.CATEGORY_SHORTCUTS, SECTION_TYPES.FEATURED_COLLECTION_GRID]);

export const getSectionType = (section) => String(section?.type || '').trim();

export const isKnownSectionType = (sectionOrType) => knownSectionTypes.has(
  typeof sectionOrType === 'string' ? sectionOrType : getSectionType(sectionOrType)
);

export const getSectionLabel = (sectionOrType) => {
  const type = typeof sectionOrType === 'string' ? sectionOrType : getSectionType(sectionOrType);
  return SECTION_LABELS[type] || type || 'Unknown section';
};

export const isHeroSection = (section) => heroSectionTypes.has(getSectionType(section));

export const needsProductData = (section, { pricingEnabled = true } = {}) => (
  productDataSectionTypes.has(getSectionType(section)) && (pricingEnabled || section?.source !== 'sale')
);

export const needsCategoryData = (section, { hasConfiguredTiles = false } = {}) => (
  categoryDataSectionTypes.has(getSectionType(section)) && !hasConfiguredTiles
);

export const getSectionDefinition = (sectionOrType) => {
  const type = typeof sectionOrType === 'string' ? sectionOrType : getSectionType(sectionOrType);
  return SECTION_DEFINITIONS[type] || null;
};

export const getSectionSupportSummary = (sections = []) => sections.reduce((summary, section) => {
  const definition = getSectionDefinition(section);
  if (!definition) {
    summary.unknown += 1;
    return summary;
  }
  if (definition.live) summary.live += 1;
  if (definition.preview) summary.preview += 1;
  summary.byFamily[definition.family] = (summary.byFamily[definition.family] || 0) + 1;
  summary.byData[definition.data] = (summary.byData[definition.data] || 0) + 1;
  return summary;
}, { live: 0, preview: 0, unknown: 0, byFamily: {}, byData: {} });

export const getRegisteredSectionTypes = () => [...knownSectionTypes];

export const getSectionVariants = (sectionOrType) => {
  const type = typeof sectionOrType === 'string' ? sectionOrType : getSectionType(sectionOrType);
  return SECTION_VARIANTS[type] || [];
};

export const getDefaultVariant = (sectionOrType) => {
  const def = getSectionDefinition(sectionOrType);
  return def?.defaultVariant || null;
};

export const resolveSectionVariant = (section) => {
  const type = getSectionType(section);
  const explicit = section?.variant || section?.layout;
  const variants = SECTION_VARIANTS[type];
  if (explicit && variants?.includes(explicit)) return explicit;
  return SECTION_DEFINITIONS[type]?.defaultVariant || null;
};

export const getSectionBlockSchema = (sectionOrType) => {
  const type = typeof sectionOrType === 'string' ? sectionOrType : getSectionType(sectionOrType);
  return SECTION_BLOCK_SCHEMAS[type] || [];
};
