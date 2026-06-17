import { SECTION_TYPES, SECTION_DEFINITIONS, getDefaultVariant } from '../components/storefront/sections/sectionRegistry';

const compact = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

export const SECTION_PRESET_GOALS = Object.freeze([
  { value: 'all', label: 'All' },
  { value: 'hero', label: 'Hero' },
  { value: 'merchandising', label: 'Merchandising' },
  { value: 'trust', label: 'Trust' },
  { value: 'conversion', label: 'Conversion' },
  { value: 'content', label: 'Content' },
  { value: 'campaign', label: 'Campaign' },
]);

const SECTION_PRESET_META = Object.freeze({
  [SECTION_TYPES.HERO_CAROUSEL]: { goal: 'hero', description: 'A high-impact first screen for launches, brand stories, or campaigns.' },
  [SECTION_TYPES.PRODUCT_ROW]: { goal: 'merchandising', description: 'Feature products, new arrivals, offers, or recommended items.' },
  [SECTION_TYPES.CATEGORY_SHORTCUTS]: { goal: 'merchandising', description: 'Give shoppers fast visual routes into important categories.' },
  [SECTION_TYPES.FEATURED_COLLECTION_GRID]: { goal: 'merchandising', description: 'Promote curated collections with larger visual tiles.' },
  [SECTION_TYPES.BRAND_SHOWCASE]: { goal: 'merchandising', description: 'Help shoppers discover products by brand or partner.' },
  [SECTION_TYPES.RECENTLY_VIEWED]: { goal: 'merchandising', description: 'Bring customers back to products they already considered.' },
  [SECTION_TYPES.VALUE_PROPS]: { goal: 'trust', description: 'Explain why customers should buy from this store.' },
  [SECTION_TYPES.TRUST_BADGES]: { goal: 'trust', description: 'Reduce hesitation with shipping, returns, and security proof.' },
  [SECTION_TYPES.TESTIMONIALS]: { goal: 'trust', description: 'Show customer proof and social validation.' },
  [SECTION_TYPES.FAQ]: { goal: 'trust', description: 'Answer common questions before checkout.' },
  [SECTION_TYPES.NEWSLETTER_SIGNUP]: { goal: 'conversion', description: 'Capture subscribers for launches, offers, and updates.' },
  [SECTION_TYPES.COUNTDOWN_SALE]: { goal: 'campaign', description: 'Create urgency around sales and limited-time campaigns.' },
  [SECTION_TYPES.PROMO_BANNERS]: { goal: 'campaign', description: 'Highlight offers, bundles, shipping promos, or seasonal pushes.' },
  [SECTION_TYPES.EDITORIAL_IMAGE_TEXT]: { goal: 'content', description: 'Add story-led content, brand education, or product context.' },
  [SECTION_TYPES.LOGO_CLOUD]: { goal: 'content', description: 'Show partners, press, brands, or trusted labels.' },
});

const SECTION_PRESETS = Object.freeze({
  [SECTION_TYPES.HERO_CAROUSEL]: {
    title: 'Build your dream store',
    subtitle: 'Curated collections, sharp deals, and a smoother shopping experience.',
    variant: 'split-editorial',
    autoPlay: true,
    interval: 6500,
  },
  [SECTION_TYPES.PRODUCT_ROW]: {
    title: 'Featured Products',
    subtitle: 'Hand-picked products your customers should see first.',
    variant: 'carousel',
    layout: 'carousel',
    source: 'featured',
    count: 8,
    viewAllLabel: 'View all products',
    viewAllLink: '/products',
  },
  [SECTION_TYPES.CATEGORY_SHORTCUTS]: {
    title: 'Shop by Category',
    subtitle: 'Help shoppers jump into the right collection faster.',
    variant: 'image-tiles',
    count: 8,
  },
  [SECTION_TYPES.FEATURED_COLLECTION_GRID]: {
    title: 'Featured Collections',
    subtitle: 'Promote your most important collections with visual tiles.',
    variant: 'image-tiles',
    count: 6,
  },
  [SECTION_TYPES.PROMO_BANNERS]: {
    title: 'Current Promotions',
    subtitle: 'Spotlight your strongest offers and campaign moments.',
    variant: 'asymmetric',
    ctaText: 'Shop now',
    ctaLink: '/products',
  },
  [SECTION_TYPES.EDITORIAL_IMAGE_TEXT]: {
    title: 'Designed for better shopping',
    subtitle: 'Tell the story behind your products, craft, quality, or service promise.',
    variant: 'overlap-card',
    ctaText: 'Explore more',
    ctaLink: '/products',
    imagePosition: 'right',
  },
  [SECTION_TYPES.VALUE_PROPS]: {
    title: 'Why Shop With Us',
    subtitle: 'Give customers quick reasons to trust the store.',
    variant: 'icon-row',
    items: [
      { title: 'Fast delivery', text: 'Tracked shipping on every order.' },
      { title: 'Secure checkout', text: 'Safe payments and protected data.' },
      { title: 'Easy support', text: 'Helpful service when customers need it.' },
    ],
  },
  [SECTION_TYPES.TRUST_BADGES]: {
    title: 'Shop With Confidence',
    subtitle: 'Reduce buyer hesitation before checkout.',
    variant: 'card-grid',
    items: [
      { title: 'Authentic products', text: 'Quality checked and verified.' },
      { title: 'Easy returns', text: 'Simple support if something is not right.' },
      { title: 'Secure payments', text: 'Encrypted checkout from cart to confirmation.' },
    ],
  },
  [SECTION_TYPES.TESTIMONIALS]: {
    title: 'Loved by Customers',
    subtitle: 'Use social proof to make the store feel alive.',
    variant: 'cards',
    items: [
      { title: 'Great experience', text: 'The store was easy to browse and checkout was smooth.', author: 'Happy customer' },
      { title: 'Fast service', text: 'The product arrived quickly and matched the description.', author: 'Verified buyer' },
    ],
  },
  [SECTION_TYPES.LOGO_CLOUD]: {
    title: 'Featured Brands',
    subtitle: 'Show brand partners, press mentions, or trusted labels.',
  },
  [SECTION_TYPES.BRAND_SHOWCASE]: {
    title: 'Popular Brands',
    subtitle: 'Let shoppers discover products by brand.',
    count: 8,
  },
  [SECTION_TYPES.NEWSLETTER_SIGNUP]: {
    title: 'Get updates and offers',
    subtitle: 'Send new arrivals, promotions, and store updates to subscribers.',
    variant: 'banner',
    ctaText: 'Subscribe',
  },
  [SECTION_TYPES.COUNTDOWN_SALE]: {
    title: 'Limited Time Offer',
    subtitle: 'Create urgency around seasonal campaigns or flash sales.',
    variant: 'bar',
    ctaText: 'Shop sale',
    ctaLink: '/products?onSale=true',
  },
  [SECTION_TYPES.FAQ]: {
    title: 'Frequently Asked Questions',
    subtitle: 'Answer common questions before customers ask.',
    items: [
      { title: 'How long does delivery take?', text: 'Delivery timelines depend on location and shipping method.' },
      { title: 'Can I return an item?', text: 'Return rules can be configured in your store policy.' },
    ],
  },
  [SECTION_TYPES.RECENTLY_VIEWED]: {
    title: 'Recently Viewed',
    count: 8,
  },
});

export const getSectionPreset = (type) => SECTION_PRESETS[type] || {};

export const getInstalledSectionPreset = (sectionPresets = {}, type) => {
  if (!sectionPresets || typeof sectionPresets !== 'object') return {};
  if (sectionPresets[type]?.type === type || sectionPresets[type]?.variant) return sectionPresets[type];
  return Object.values(sectionPresets).find((preset) => preset?.type === type) || {};
};

export const getSectionPresetGallery = (sectionPresets = {}) => {
  const byType = new Map();

  Object.keys(SECTION_PRESETS).forEach((type) => {
    const preset = { ...SECTION_PRESETS[type], ...getInstalledSectionPreset(sectionPresets, type) };
    const meta = SECTION_PRESET_META[type] || {};
    byType.set(type, {
      type,
      label: SECTION_DEFINITIONS[type]?.label || type,
      goal: meta.goal || SECTION_DEFINITIONS[type]?.family || 'content',
      description: meta.description || preset.subtitle || 'Add a reusable storefront section.',
      title: preset.title,
      variant: preset.variant || getDefaultVariant(type),
      installed: Boolean(getInstalledSectionPreset(sectionPresets, type)?.type || getInstalledSectionPreset(sectionPresets, type)?.variant),
    });
  });

  Object.entries(sectionPresets || {}).forEach(([key, preset]) => {
    if (!preset?.type || byType.has(preset.type)) return;
    const type = preset.type;
    const meta = SECTION_PRESET_META[type] || {};
    byType.set(type, {
      type,
      label: SECTION_DEFINITIONS[type]?.label || key,
      goal: meta.goal || SECTION_DEFINITIONS[type]?.family || 'content',
      description: meta.description || preset.subtitle || 'Imported template section preset.',
      title: preset.title,
      variant: preset.variant || getDefaultVariant(type),
      installed: true,
    });
  });

  return [...byType.values()];
};

export const createDefaultSection = (type, { id, variant, title, sectionPresets } = {}) => {
  const preset = { ...getSectionPreset(type), ...getInstalledSectionPreset(sectionPresets, type) };
  const resolvedVariant = variant || preset.variant || getDefaultVariant(type);
  return compact({
    id,
    type,
    enabled: true,
    ...preset,
    variant: resolvedVariant,
    layout: type === SECTION_TYPES.PRODUCT_ROW ? (resolvedVariant || preset.layout || 'carousel') : preset.layout,
    title: title || preset.title,
  });
};

export default { createDefaultSection, getInstalledSectionPreset, getSectionPreset, getSectionPresetGallery };
