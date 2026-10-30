const arr = (value, fallback = []) => (Array.isArray(value) ? value : fallback);

const num = (value, fallback = 8) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const buildSectionRendererData = ({
  section = {},
  homepage = {},
  demoContent = {},
  resolvedData = {},
  brands = [],
  loading = false,
  brandsLoading = false,
  pricingEnabled = true,
} = {}) => {
  const hasCustomItems = Array.isArray(section.items);
  const hasCustomSlides = Array.isArray(section.slides);
  const hasCustomBanners = Array.isArray(section.banners);

  const heroSlides = hasCustomSlides
    ? section.slides
    : arr(homepage.heroSlides, arr(demoContent.heroSlides));
  const valueProps = hasCustomItems
    ? section.items
    : arr(homepage.valueProps, arr(demoContent.valueProps));
  const promoBanners = hasCustomItems
    ? section.items
    : hasCustomBanners
      ? section.banners
      : arr(homepage.promoBanners, arr(demoContent.promoBanners));
  const sectionLoading = section.type === 'brand-showcase' ? brandsLoading : loading;
  const productsBySection = resolvedData.products || resolvedData.productsBySection || {};

  return {
    slides: heroSlides,
    heroSlides,
    valueProps,
    items: hasCustomItems ? section.items : undefined,
    categories: arr(resolvedData.categories),
    configuredTiles: hasCustomItems ? section.items : arr(homepage.categoryTiles),
    promoBanners,
    banners: promoBanners,
    products: productsBySection[section.id] || resolvedData.productsList || [],
    brands: arr(brands),
    loading: sectionLoading,
    count: num(section.count, 8),
    pricingEnabled,
  };
};

export default buildSectionRendererData;
