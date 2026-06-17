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
  const sectionItems = arr(section.items);
  const sectionSlides = arr(section.slides);
  const heroSlides = sectionSlides.length
    ? sectionSlides
    : arr(homepage.heroSlides, arr(demoContent.heroSlides));
  const valueProps = sectionItems.length
    ? sectionItems
    : arr(homepage.valueProps, arr(demoContent.valueProps));
  const promoBanners = arr(homepage.promoBanners, arr(demoContent.promoBanners));
  const sectionLoading = section.type === 'brand-showcase' ? brandsLoading : loading;
  const productsBySection = resolvedData.products || resolvedData.productsBySection || {};

  return {
    slides: heroSlides,
    heroSlides,
    valueProps,
    items: sectionItems.length ? sectionItems : undefined,
    categories: arr(resolvedData.categories),
    configuredTiles: sectionItems.length ? sectionItems : arr(homepage.categoryTiles),
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
