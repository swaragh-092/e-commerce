import React, { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import api from '../../services/api';
import { getProducts } from '../../services/productService';
import { getCategories } from '../../services/categoryService';
import { useSettings, useFeature } from '../../hooks/useSettings';
import { useBrands } from '../../context/BrandContext';
import PageSEO from '../../components/common/PageSEO';
import {
  isHeroSection,
  needsCategoryData,
  needsProductData,
} from '../../components/storefront/sections/sectionRegistry';
import SectionRenderer from '../../components/storefront/sections/SectionRenderer';
import { buildSectionRendererData } from '../../components/storefront/sections/sectionData';

const DEFAULT_HERO_IMAGE = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=80';

const DEFAULT_HOMEPAGE = {
  eyebrow: 'Fresh drops, sharper prices',
  sections: [
    { id: 'hero', type: 'hero-carousel', enabled: true },
    { id: 'value-props', type: 'value-props', enabled: true },
    { id: 'categories', type: 'category-shortcuts', enabled: true, title: 'Shop by Category', count: 10 },
    { id: 'promo', type: 'promo-banners', enabled: true },
    { id: 'trending', type: 'product-row', enabled: true, title: 'Trending Now', source: 'featured', count: 8, layout: 'carousel', viewAllLink: '/products?featured=true' },
    { id: 'deals', type: 'product-row', enabled: true, title: 'Deals of the Day', source: 'sale', count: 8, layout: 'grid', viewAllLink: '/products?onSale=true' },
    { id: 'brands', type: 'brand-showcase', enabled: true, title: 'Featured Brands', count: 12 },
    { id: 'new-arrivals', type: 'product-row', enabled: true, title: 'New Arrivals', source: 'newest', count: 8, layout: 'carousel', viewAllLink: '/products?sort=newest' },
  ],
  heroSlides: [
    {
      eyebrow: 'Mega Style Weekend',
      title: 'Upgrade your everyday cart',
      subtitle: 'Curated fashion, lifestyle, and essentials with discovery-first shopping.',
      buttonText: 'Shop Now',
      buttonLink: '/products',
      secondaryButtonText: 'Explore Deals',
      secondaryButtonLink: '/products?onSale=true',
      image: DEFAULT_HERO_IMAGE,
      color: '#ffffff',
    },
  ],
  categoryTiles: [],
  promoBanners: [
    { title: 'Flat 40% Off', subtitle: 'Season-ready looks and daily essentials', ctaText: 'Grab Offers', link: '/products?onSale=true', color: '#fff7ed', accentColor: '#f97316' },
    { title: 'New Brands Live', subtitle: 'Fresh labels added every week', ctaText: 'Explore Brands', link: '/brands', color: '#ecfeff', accentColor: '#0891b2' },
    { title: 'Fast Checkout', subtitle: 'Wishlist, cart, and secure payments ready', ctaText: 'Start Shopping', link: '/products', color: '#f0fdf4', accentColor: '#16a34a' },
  ],
  valueProps: [
    { icon: 'shipping', title: 'Fast Delivery', text: 'Reliable shipping on every order' },
    { icon: 'offers', title: 'Daily Offers', text: 'Fresh deals across top categories' },
    { icon: 'secure', title: 'Secure Payments', text: 'Protected checkout experience' },
    { icon: 'support', title: 'Easy Support', text: 'Help when shoppers need it' },
  ],
};

const PRODUCT_SOURCE_PARAMS = {
  newest: { sort: 'newest' },
  featured: { featured: true },
  bestSellers: { sort: 'best-selling' },
  sale: { sale: true },
  recommended: { sort: 'recommended' },
};

const bool = (val, fallback = true) => (val === undefined || val === null ? fallback : val !== false && val !== 'false');
const num = (val, fallback = 8) => {
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};
const arr = (val, fallback = []) => (Array.isArray(val) ? val : fallback);
const str = (val, fallback = '') => (val ?? fallback);

const extractArray = (res, count) => {
  if (!res || res.status !== 'fulfilled' || !res.value) return [];
  const val = res.value;
  if (Array.isArray(val)) return count ? val.slice(0, count) : val;
  if (val.data && Array.isArray(val.data)) return count ? val.data.slice(0, count) : val.data;
  return [];
};

const firstArrayInObject = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const item of Object.values(value)) {
    if (Array.isArray(item)) return item;
    if (item?.rows && Array.isArray(item.rows)) return item.rows;
  }
  return [];
};

const extractDataSourceArray = (res, section, count) => {
  if (!res || res.status !== 'fulfilled' || !res.value) return [];
  const payload = res.value.data?.data || res.value.data || res.value;
  const apiData = payload?.data || payload;
  const key = section.dataSourceBlock || section.dataSourceKey || section.id;
  const direct = apiData?.[key] || apiData?.products || apiData?.categories || apiData?.brands;
  const rows = firstArrayInObject(direct).length ? firstArrayInObject(direct) : firstArrayInObject(apiData);
  return count ? rows.slice(0, count) : rows;
};

const legacySections = (hp = {}) => [
  bool(hp.showCategories, true) && { id: 'categories', type: 'category-shortcuts', title: str(hp.categoriesTitle, 'Shop by Category'), count: num(hp.categoriesCount, 12) },
  bool(hp.showNewArrivals, true) && { id: 'new-arrivals', type: 'product-row', title: str(hp.newArrivalsTitle, 'New Arrivals'), source: 'newest', count: num(hp.newArrivalsCount, 8), layout: str(hp.newArrivalsLayout, 'grid'), viewAllLink: str(hp.newArrivalsLink, '/products?sort=newest') },
  bool(hp.showFeatured, true) && { id: 'featured', type: 'product-row', title: str(hp.featuredTitle, 'Featured Products'), source: 'featured', count: num(hp.featuredCount, 8), layout: str(hp.featuredLayout, 'carousel'), viewAllLink: str(hp.featuredLink, '/products?featured=true') },
  bool(hp.showBestSellers, true) && { id: 'best-sellers', type: 'product-row', title: str(hp.bestSellersTitle, 'Best Sellers'), source: 'bestSellers', count: num(hp.bestSellersCount, 8), layout: str(hp.bestSellersLayout, 'grid'), viewAllLink: str(hp.bestSellersLink, '/products?sort=best-selling') },
  bool(hp.showOnSale, true) && { id: 'deals', type: 'product-row', title: str(hp.onSaleTitle, 'On Sale'), source: 'sale', count: num(hp.onSaleCount, 8), layout: str(hp.onSaleLayout, 'carousel'), viewAllLink: str(hp.onSaleLink, '/products?onSale=true') },
  bool(hp.showBrands, true) && { id: 'brands', type: 'brand-showcase', title: str(hp.brandsTitle, 'Shop by Brand'), count: num(hp.brandsCount, 12) },
].filter(Boolean);

const resolveHomepage = (settings = {}) => {
  const hp = settings.homepage || {};
  const hero = settings.hero || {};
  const sections = arr(hp.sections).length ? hp.sections : legacySections(hp);
  const heroSlides = arr(hp.heroSlides).length
    ? hp.heroSlides
    : [{
      eyebrow: hp.eyebrow || DEFAULT_HOMEPAGE.eyebrow,
      title: str(hero.title, 'Shop the Latest'),
      subtitle: str(hero.subtitle, 'Discover thousands of products at great prices.'),
      buttonText: hero.buttonText,
      buttonLink: hero.buttonLink,
      image: hero.backgroundImage || DEFAULT_HERO_IMAGE,
      color: hero.color || '#ffffff',
    }];

  return {
    ...DEFAULT_HOMEPAGE,
    ...hp,
    sections,
    heroSlides,
    promoBanners: arr(hp.promoBanners, DEFAULT_HOMEPAGE.promoBanners),
    valueProps: arr(hp.valueProps, DEFAULT_HOMEPAGE.valueProps),
    categoryTiles: arr(hp.categoryTiles, []),
  };
};

const getProductParams = (section) => ({
  ...(PRODUCT_SOURCE_PARAMS[section.source] || {}),
  ...(section.query || {}),
  limit: num(section.count, 8),
  status: 'published',
});

const circuitBreakerState = {};

const fetchSectionData = async (section) => {
  if (!section.dataSourceSlug) {
    return getProducts(getProductParams(section));
  }

  const slug = section.dataSourceSlug;
  const now = Date.now();

  if (!circuitBreakerState[slug]) {
    circuitBreakerState[slug] = { failures: 0, status: 'CLOSED', nextAttempt: 0 };
  }

  const cb = circuitBreakerState[slug];

  if (cb.status === 'OPEN') {
    if (now > cb.nextAttempt) {
      cb.status = 'HALF-OPEN';
    } else {
      console.warn(`Circuit breaker is OPEN for slug '${slug}'. Short-circuiting request.`);
      return {
        data: {
          status: 'error',
          reason: 'Circuit breaker is OPEN',
          placeholderData: [],
        }
      };
    }
  }

  try {
    const response = await api.get('/api-builder/public/' + slug, { timeout: 2000 });
    
    if (!response || !response.data) {
      throw new Error('Empty or null results returned');
    }

    // Reset circuit breaker on success
    cb.failures = 0;
    cb.status = 'CLOSED';

    return response;
  } catch (err) {
    cb.failures += 1;
    if (cb.failures >= 3) {
      cb.status = 'OPEN';
      cb.nextAttempt = Date.now() + 30000;
      console.warn(`Circuit breaker tripped for API slug '${slug}'. Backing off for 30s.`);
    }
    return {
      data: {
        status: 'error',
        reason: err.message || 'Fetch failed',
        placeholderData: [],
      }
    };
  }
};

const HomeExperience = () => {
  const { settings } = useSettings();
  const { brands: contextBrands, loading: brandsLoading } = useBrands();
  const pricingEnabled = useFeature('pricing');
  const config = useMemo(() => resolveHomepage(settings), [settings]);
  const visibleSections = useMemo(() => arr(config.sections).filter((section) => bool(section.enabled, true)), [config.sections]);
  const productSections = useMemo(
    () => visibleSections.filter((section) => needsProductData(section, { pricingEnabled })),
    [pricingEnabled, visibleSections],
  );
  const needsCategories = visibleSections.some((section) => needsCategoryData(section, { hasConfiguredTiles: Boolean(arr(config.categoryTiles).length) }));
  const [data, setData] = useState({ categories: [], products: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const productFetches = productSections.map((section) => fetchSectionData(section));
    const categoryFetch = needsCategories ? getCategories() : Promise.resolve(null);

    setLoading(true);
    Promise.allSettled([...productFetches, categoryFetch])
      .then((results) => {
        const productResults = results.slice(0, productFetches.length);
        const categoryResult = results[productFetches.length];
        const products = {};

        productSections.forEach((section, index) => {
          products[section.id] = section.dataSourceSlug
            ? extractDataSourceArray(productResults[index], section, num(section.count, 8))
            : extractArray(productResults[index], num(section.count, 8));
        });

        setData({ products, categories: extractArray(categoryResult) });
      })
      .finally(() => setLoading(false));
  }, [needsCategories, productSections]);

  const buildSectionData = (section) => buildSectionRendererData({
    section,
    homepage: config,
    resolvedData: data,
    brands: contextBrands,
    loading,
    brandsLoading,
    pricingEnabled,
  });

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageSEO
        title={config.seoTitle || 'Home'}
        description={config.seoDescription || config.heroSlides?.[0]?.subtitle || settings?.seo?.defaultDescription}
      />

      {visibleSections.map((section, index) => {
        const display = {
          xs: section.hideOnMobile ? 'none' : 'block',
          md: section.hideOnDesktop ? 'none' : 'block',
        };
        const frameIndex = index === (visibleSections[0] && isHeroSection(visibleSections[0]) ? 1 : 0) ? 0 : index;

        return (
          <Box key={section.id || index} sx={{ display }}>
            <SectionRenderer
              section={section}
              mode="live"
              data={buildSectionData(section)}
              index={frameIndex}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default HomeExperience;
