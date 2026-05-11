import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Container,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import BoltIcon from '@mui/icons-material/Bolt';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Link } from 'react-router-dom';
import { getProducts } from '../../services/productService';
import { getCategories } from '../../services/categoryService';
import { useSettings, useFeature } from '../../hooks/useSettings';
import { useBrands } from '../../context/BrandContext';
import ProductRow from '../../components/product/ProductRow';
import BrandStrip from '../../components/storefront/BrandStrip';
import PageSEO from '../../components/common/PageSEO';
import { getMediaUrl } from '../../utils/media';

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

const iconMap = {
  shipping: LocalShippingIcon,
  offers: LocalOfferIcon,
  secure: ShieldOutlinedIcon,
  support: SupportAgentIcon,
  fast: BoltIcon,
  payment: CreditCardIcon,
  verified: VerifiedIcon,
};

const bool = (val, fallback = true) => (val === undefined || val === null ? fallback : val !== false && val !== 'false');
const num = (val, fallback = 8) => {
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};
const arr = (val, fallback = []) => (Array.isArray(val) ? val : fallback);
const str = (val, fallback = '') => (val ?? fallback);
const imageUrl = (image) => getMediaUrl(image || '') || '';

const extractArray = (res, count) => {
  if (!res || res.status !== 'fulfilled' || !res.value) return [];
  const val = res.value;
  if (Array.isArray(val)) return count ? val.slice(0, count) : val;
  if (val.data && Array.isArray(val.data)) return count ? val.data.slice(0, count) : val.data;
  return [];
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

const SectionHeader = ({ title, subtitle, actionLabel, actionLink }) => {
  if (!title && !subtitle) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
      <Box>
        {title && <Typography variant="h5" sx={{ fontWeight: 900 }}>{title}</Typography>}
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      {actionLabel && actionLink && (
        <Button component={Link} to={actionLink} endIcon={<ArrowForwardIcon />} size="small">
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

const HeroCarousel = ({ section, slides }) => {
  const [active, setActive] = useState(0);
  const theme = useTheme();
  const visibleSlides = slides.length ? slides : DEFAULT_HOMEPAGE.heroSlides;
  const slide = visibleSlides[active] || visibleSlides[0] || {};
  const canRotate = visibleSlides.length > 1;
  const interval = num(section.interval, 6500);
  const image = imageUrl(slide.image) || DEFAULT_HERO_IMAGE;

  useEffect(() => {
    if (!canRotate || section.autoPlay === false) return undefined;
    const timer = setInterval(() => setActive((current) => (current + 1) % visibleSlides.length), interval);
    return () => clearInterval(timer);
  }, [canRotate, interval, section.autoPlay, visibleSlides.length]);

  const goTo = (direction) => setActive((current) => (current + direction + visibleSlides.length) % visibleSlides.length);

  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: { xs: 480, md: 560 },
        display: 'flex',
        alignItems: 'center',
        color: slide.color || '#ffffff',
      }}
    >
      {visibleSlides.map((s = {}, index) => (
        <Box key={index} sx={{ height: '100%', position: 'absolute', inset: 0, opacity: active === index ? 1 : 0, transition: 'opacity 0.5s ease-in-out' }}>
          <Box sx={{ 
            position: 'absolute', 
            inset: 0, 
            backgroundImage: `url(${imageUrl(s.image) || DEFAULT_HERO_IMAGE})`, 
            backgroundSize: 'cover', 
            backgroundPosition: s.position || 'center',
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
            }
          }} />
        </Box>
      ))}

      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, py: { xs: 6, md: 8 } }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={7} lg={6}>
            {slide.eyebrow && (
              <Chip
                label={slide.eyebrow}
                icon={<BoltIcon />}
                sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.18)', color: 'inherit', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(12px)' }}
              />
            )}
            <Typography variant="h1" sx={{ fontSize: { xs: '2.55rem', sm: '3.25rem', md: '4.5rem' }, lineHeight: 0.98, fontWeight: 950, maxWidth: 760 }}>
              {slide.title}
            </Typography>
            {slide.subtitle && (
              <Typography variant="h6" sx={{ mt: 2, maxWidth: 620, color: 'rgba(255,255,255,0.88)', lineHeight: 1.55 }}>
                {slide.subtitle}
              </Typography>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
              {slide.buttonText && slide.buttonLink && (
                <Button component={Link} to={slide.buttonLink} variant="contained" size="large" endIcon={<ArrowForwardIcon />} sx={{ bgcolor: '#ffffff', color: theme.palette.primary.dark, px: 3, '&:hover': { bgcolor: theme.palette.secondary.light } }}>
                  {slide.buttonText}
                </Button>
              )}
              {slide.secondaryButtonText && slide.secondaryButtonLink && (
                <Button component={Link} to={slide.secondaryButtonLink} variant="outlined" size="large" sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.55)', px: 3, '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.12)' } }}>
                  {slide.secondaryButtonText}
                </Button>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Container>

      {canRotate && (
        <>
          <IconButton aria-label="Previous banner" onClick={() => goTo(-1)} sx={{ position: 'absolute', left: { xs: 12, md: 24 }, bottom: { xs: 18, md: 28 }, color: '#fff', bgcolor: 'rgba(0,0,0,0.26)', '&:hover': { bgcolor: 'rgba(0,0,0,0.42)' } }}>
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
          <IconButton aria-label="Next banner" onClick={() => goTo(1)} sx={{ position: 'absolute', left: { xs: 60, md: 76 }, bottom: { xs: 18, md: 28 }, color: '#fff', bgcolor: 'rgba(0,0,0,0.26)', '&:hover': { bgcolor: 'rgba(0,0,0,0.42)' } }}>
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        </>
      )}
    </Box>
  );
};

const ValueProps = ({ items }) => (
  <Grid container spacing={1.5}>
    {items.map((item, index) => {
      const Icon = iconMap[item.icon] || VerifiedIcon;
      return (
        <Grid item xs={6} md={3} key={`${item.title}-${index}`}>
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', gap: 1.5, p: { xs: 1.5, sm: 2 }, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.dark', flexShrink: 0 }}>
              <Icon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900 }} noWrap>{item.title}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{item.text}</Typography>
            </Box>
          </Box>
        </Grid>
      );
    })}
  </Grid>
);

const CategoryShortcuts = ({ section, categories, configuredTiles, loading }) => {
  const count = num(section.count, 10);
  const tiles = configuredTiles.length ? configuredTiles : categories.slice(0, count).map((cat) => ({
    id: cat.id,
    title: cat.name,
    image: cat.image,
    link: `/products?category=${cat.slug}`,
  }));

  if (!loading && tiles.length === 0) return null;

  return (
    <Box component="section">
      <SectionHeader title={section.title} subtitle={section.subtitle} actionLabel={section.actionLabel} actionLink={section.actionLink} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(4, minmax(76px, 1fr))', sm: 'repeat(5, minmax(110px, 1fr))', md: 'repeat(10, minmax(96px, 1fr))' }, gap: { xs: 1.25, md: 1.5 }, overflowX: { xs: 'auto', md: 'visible' }, pb: { xs: 1, md: 0 } }}>
        {loading
          ? Array.from({ length: count }).map((_, index) => (
            <Box key={index}>
              <Skeleton variant="rounded" height={96} sx={{ borderRadius: 2 }} />
              <Skeleton width="70%" sx={{ mx: 'auto', mt: 1 }} />
            </Box>
          ))
          : tiles.slice(0, count).map((tile, index) => (
            <Card key={tile.id || `${tile.title}-${index}`} sx={{ boxShadow: 'none', height: '100%' }}>
              <CardActionArea component={Link} to={tile.link || '/products'} sx={{ height: '100%', p: 1.25, textAlign: 'center', '&:hover img': { transform: 'scale(1.06)' } }}>
                <Box sx={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 2, overflow: 'hidden', bgcolor: tile.color || 'action.hover', display: 'grid', placeItems: 'center' }}>
                  {tile.image ? (
                    <Box component="img" src={imageUrl(tile.image)} alt={tile.title} sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.35s ease' }} />
                  ) : (
                    <Typography variant="h4" sx={{ fontWeight: 950, color: 'primary.main' }}>{tile.title?.[0] || '?'}</Typography>
                  )}
                </Box>
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 800, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 40 }}>
                  {tile.title}
                </Typography>
              </CardActionArea>
            </Card>
          ))}
      </Box>
    </Box>
  );
};

const PromoBanners = ({ section, banners }) => {
  const items = arr(section.items).length ? section.items : banners;
  if (!items.length) return null;

  return (
    <Box component="section">
      <SectionHeader title={section.title} subtitle={section.subtitle} />
      <Grid container spacing={2}>
        {items.map((banner, index) => (
          <Grid item xs={12} md={4} key={`${banner.title}-${index}`}>
            <Card sx={{ height: '100%', overflow: 'hidden', boxShadow: 'none', bgcolor: banner.color || 'background.paper', borderColor: banner.accentColor || 'divider' }}>
              <CardActionArea component={Link} to={banner.link || '/products'} sx={{ minHeight: 190, p: 2.5, display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 2, color: 'inherit' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                  <Box>
                    {banner.kicker && <Typography variant="caption" sx={{ color: banner.accentColor || 'primary.main', fontWeight: 900 }}>{banner.kicker}</Typography>}
                    <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 950, color: 'text.primary' }}>{banner.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{banner.subtitle}</Typography>
                  </Box>
                  <Button component="span" size="small" endIcon={<ArrowForwardIcon />} sx={{ mt: 2, alignSelf: 'flex-start', color: banner.accentColor || 'primary.main' }}>
                    {banner.ctaText || 'Shop Now'}
                  </Button>
                </Box>
                {banner.image && (
                  <Box component="img" src={imageUrl(banner.image)} alt={banner.title} sx={{ width: 112, height: 140, borderRadius: 2, objectFit: 'cover', alignSelf: 'center' }} />
                )}
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

const getProductParams = (section) => ({
  ...(PRODUCT_SOURCE_PARAMS[section.source] || {}),
  ...(section.query || {}),
  limit: num(section.count, 8),
  status: 'published',
});

const HomeExperience = () => {
  const { settings } = useSettings();
  const { brands: contextBrands, loading: brandsLoading } = useBrands();
  const pricingEnabled = useFeature('pricing');
  const config = useMemo(() => resolveHomepage(settings), [settings]);
  const visibleSections = useMemo(() => arr(config.sections).filter((section) => bool(section.enabled, true)), [config.sections]);
  const productSections = useMemo(
    () => visibleSections.filter((section) => section.type === 'product-row' && (pricingEnabled || section.source !== 'sale')),
    [pricingEnabled, visibleSections],
  );
  const needsCategories = visibleSections.some((section) => section.type === 'category-shortcuts' && !arr(config.categoryTiles).length);
  const [data, setData] = useState({ categories: [], products: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const productFetches = productSections.map((section) => getProducts(getProductParams(section)));
    const categoryFetch = needsCategories ? getCategories() : Promise.resolve(null);

    setLoading(true);
    Promise.allSettled([...productFetches, categoryFetch])
      .then((results) => {
        const productResults = results.slice(0, productFetches.length);
        const categoryResult = results[productFetches.length];
        const products = {};

        productSections.forEach((section, index) => {
          products[section.id] = extractArray(productResults[index], num(section.count, 8));
        });

        setData({ products, categories: extractArray(categoryResult) });
      })
      .finally(() => setLoading(false));
  }, [needsCategories, productSections]);

  const renderSection = (section) => {
    switch (section.type) {
      case 'hero-carousel':
        return <HeroCarousel key={section.id} section={section} slides={arr(section.slides).length ? section.slides : config.heroSlides} />;
      case 'value-props':
        return <ValueProps key={section.id} items={arr(section.items).length ? section.items : config.valueProps} />;
      case 'category-shortcuts':
        return (
          <CategoryShortcuts
            key={section.id}
            section={section}
            categories={data.categories}
            configuredTiles={arr(section.items).length ? section.items : config.categoryTiles}
            loading={loading}
          />
        );
      case 'promo-banners':
        return <PromoBanners key={section.id} section={section} banners={config.promoBanners} />;
      case 'product-row':
        if (!pricingEnabled && section.source === 'sale') return null;
        return (
          <ProductRow
            key={section.id}
            title={section.title}
            viewAllLink={section.viewAllLink}
            viewAllLabel={section.viewAllLabel || 'View All'}
            products={data.products[section.id] || []}
            loading={loading}
            count={num(section.count, 8)}
            layout={section.layout || 'grid'}
          />
        );
      case 'brand-showcase':
        return (
          <BrandStrip
            key={section.id}
            title={section.title}
            brands={contextBrands.slice(0, num(section.count, 12))}
            loading={brandsLoading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageSEO
        title={config.seoTitle || 'Home'}
        description={config.seoDescription || config.heroSlides?.[0]?.subtitle || settings?.seo?.defaultDescription}
      />

      {visibleSections.map((section, index) => {
        const rendered = renderSection(section);
        if (!rendered) return null;
        if (section.type === 'hero-carousel') return rendered;

        const isFirstNonHero = index === (visibleSections[0]?.type === 'hero-carousel' ? 1 : 0);
        const sectionPadding = isFirstNonHero ? { pt: { xs: 4, md: 8 }, pb: { xs: 2, md: 3 } } : { py: { xs: 2, md: 3 } };

        return (
          <Container key={section.id || index} maxWidth="xl" sx={sectionPadding}>
            {rendered}
          </Container>
        );
      })}
    </Box>
  );
};

export default HomeExperience;
