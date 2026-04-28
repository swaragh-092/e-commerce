import React, { useState, useEffect } from 'react';
import {
    Box, Container, Typography, Button, useTheme,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { getProducts } from '../../services/productService';
import { getCategories } from '../../services/categoryService';
import { getBrands } from '../../services/brandService';
import { useSettings } from '../../hooks/useSettings';
import ProductRow from '../../components/product/ProductRow';
import CategoryGrid from '../../components/storefront/CategoryGrid';
import BrandStrip from '../../components/storefront/BrandStrip';
import PageSEO from '../../components/common/PageSEO';

// ─── helpers ────────────────────────────────────────────────────────────────

const bool = (val, fallback = true) => (val === undefined || val === null ? fallback : val !== false && val !== 'false');
const num  = (val, fallback = 8)    => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? fallback : parsed;
};
const str  = (val, fallback = '')   => (val ?? fallback);

// ─── component ──────────────────────────────────────────────────────────────

const HomePage = () => {
    const { settings } = useSettings();
    const theme = useTheme();

    // ── section config from settings.homepage (all customizable) ────────────
    const hp  = settings?.homepage  || {};
    const hero = settings?.hero     || {};

    // Hero
    const bgType         = hero.backgroundType   || 'gradient';
    const bgImage        = hero.backgroundImage  || '';
    const overlayOpacity = Number(hero.overlayOpacity ?? 0.5);
    const heroTextColor  = hero.color            || '#ffffff';
    const heroTitle      = str(hero.title,       'Shop the Latest');
    const heroSubtitle   = str(hero.subtitle,    'Discover thousands of products at great prices.');
    const heroBtnText    = hero.buttonText;
    const heroBtnLink    = hero.buttonLink;

    // Categories
    const showCategories    = bool(hp.showCategories,    true);
    const categoriesTitle   = str(hp.categoriesTitle,    'Shop by Category');
    const categoriesCount   = num(hp.categoriesCount,    12);

    // New Arrivals
    const showNewArrivals   = bool(hp.showNewArrivals,   true);
    const newArrivalsTitle  = str(hp.newArrivalsTitle,   'New Arrivals');
    const newArrivalsCount  = num(hp.newArrivalsCount,   8);
    const newArrivalsLayout = str(hp.newArrivalsLayout,  'grid');
    const newArrivalsLink   = str(hp.newArrivalsLink,    '/products?sort=newest');

    // Featured
    const showFeatured      = bool(hp.showFeatured,      true);
    const featuredTitle     = str(hp.featuredTitle,      'Featured Products');
    const featuredCount     = num(hp.featuredCount,      8);
    const featuredLayout    = str(hp.featuredLayout,     'carousel');
    const featuredLink      = str(hp.featuredLink,       '/products?featured=true');

    // Best Sellers
    const showBestSellers   = bool(hp.showBestSellers,   true);
    const bestSellersTitle  = str(hp.bestSellersTitle,   'Best Sellers');
    const bestSellersCount  = num(hp.bestSellersCount,   8);
    const bestSellersLayout = str(hp.bestSellersLayout,  'grid');
    const bestSellersLink   = str(hp.bestSellersLink,    '/products?sort=best-selling');

    // On Sale
    const showOnSale        = bool(hp.showOnSale,        true);
    const onSaleTitle       = str(hp.onSaleTitle,        'On Sale');
    const onSaleCount       = num(hp.onSaleCount,        8);
    const onSaleLayout      = str(hp.onSaleLayout,       'carousel');
    const onSaleLink        = str(hp.onSaleLink,         '/products?onSale=true');

    // Brands
    const showBrands        = bool(hp.showBrands,        true);
    const brandsTitle       = str(hp.brandsTitle,        'Shop by Brand');
    const brandsCount       = num(hp.brandsCount,        12);

    // ── state ────────────────────────────────────────────────────────────────
    const [data, setData] = useState({
        newArrivals: [],
        featured: [],
        bestSellers: [],
        onSale: [],
        categories: [],
        brands: [],
    });
    const [loading, setLoading] = useState(true);

    // ── single parallel fetch ─────────────────────────────────────────────
    useEffect(() => {
        const fetches = [
            showNewArrivals  ? getProducts({ sort: 'newest',        limit: newArrivalsCount,  status: 'published' }) : Promise.resolve(null),
            showFeatured     ? getProducts({ featured: true,        limit: featuredCount,     status: 'published' }) : Promise.resolve(null),
            showBestSellers  ? getProducts({ sort: 'best-selling',  limit: bestSellersCount,  status: 'published' }) : Promise.resolve(null),
            showOnSale       ? getProducts({ sale: true,            limit: onSaleCount,       status: 'published' }) : Promise.resolve(null),
            showCategories   ? getCategories()                                                                        : Promise.resolve(null),
            showBrands       ? getBrands({ limit: brandsCount, isActive: true }).then(r => r.data)                   : Promise.resolve(null),
        ];

        setLoading(true);
        Promise.allSettled(fetches).then(([na, ft, bs, os, cats, brs]) => {
            setData({
                newArrivals:  na.status  === 'fulfilled' && na.value?.data  ? (na.value.data.slice  ? na.value.data.slice(0, newArrivalsCount)  : na.value.data)  : [],
                featured:     ft.status  === 'fulfilled' && ft.value?.data  ? (ft.value.data.slice  ? ft.value.data.slice(0, featuredCount)     : ft.value.data)  : [],
                bestSellers:  bs.status  === 'fulfilled' && bs.value?.data  ? (bs.value.data.slice  ? bs.value.data.slice(0, bestSellersCount)  : bs.value.data)  : [],
                onSale:       os.status  === 'fulfilled' && os.value?.data  ? (os.value.data.slice  ? os.value.data.slice(0, onSaleCount)       : os.value.data)  : [],
                categories:   cats.status === 'fulfilled' && Array.isArray(cats.value) ? cats.value.slice(0, categoriesCount) : [],
                brands:       brs.status  === 'fulfilled' && Array.isArray(brs.value)  ? brs.value.slice(0, brandsCount)      : [],
            });
        }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        showNewArrivals, newArrivalsCount,
        showFeatured, featuredCount,
        showBestSellers, bestSellersCount,
        showOnSale, onSaleCount,
        showCategories, categoriesCount,
        showBrands, brandsCount,
    ]);

    // ── render ────────────────────────────────────────────────────────────
    return (
        <Box>
            <PageSEO title="Home" description={heroSubtitle} />

            {/* ── Hero Banner ─────────────────────────────────────────── */}
            <Box sx={{
                position: 'relative',
                overflow: 'hidden',
                ...(bgType === 'image' && bgImage
                    ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : {
                        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 54%, ${theme.palette.secondary.dark} 100%)`,
                    }
                ),
                color: heroTextColor,
                py: { xs: 8, md: 11 },
                textAlign: 'center',
                minHeight: { xs: '58vh', md: '64vh' },
                display: 'flex',
                alignItems: 'center',
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background:
                        'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0.16) 100%)',
                    zIndex: 1,
                    pointerEvents: 'none',
                },
            }}>
                {bgType === 'image' && bgImage && (
                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'black', opacity: overlayOpacity, zIndex: 1 }} />
                )}
                <Container maxWidth="md" sx={{ position: 'relative', zIndex: 2 }}>
                    <Typography
                        variant="h2"
                        fontWeight={900}
                        gutterBottom
                        sx={{
                            fontSize: { xs: '2.25rem', md: '4rem' },
                            lineHeight: 1.05,
                            textShadow: '0 10px 28px rgba(0,0,0,0.24)',
                        }}
                    >
                        {heroTitle}
                    </Typography>
                    <Typography variant="h6" sx={{ opacity: 0.92, mb: 4, maxWidth: 680, mx: 'auto', lineHeight: 1.65 }}>
                        {heroSubtitle}
                    </Typography>
                    {heroBtnText && heroBtnLink && (
                        <Button
                            variant="contained"
                            size="large"
                            component={Link}
                            to={heroBtnLink}
                            sx={{
                                bgcolor: 'background.paper',
                                color: 'primary.dark',
                                '&:hover': { bgcolor: 'secondary.light', color: 'secondary.dark' },
                                py: 1.5,
                                px: 4,
                                fontSize: '1.05rem',
                            }}
                        >
                            {heroBtnText}
                        </Button>
                    )}
                </Container>
            </Box>

            {/* ── Content Sections ────────────────────────────────────── */}
            <Container
                maxWidth="xl"
                sx={{
                    py: { xs: 5, md: 7 },
                    '& > section, & > div': {
                        scrollMarginTop: 96,
                    },
                }}
            >

                {/* Shop by Category */}
                {showCategories && (
                    <CategoryGrid
                        title={categoriesTitle}
                        categories={data.categories}
                        loading={loading}
                    />
                )}

                {/* New Arrivals */}
                {showNewArrivals && (
                    <ProductRow
                        title={newArrivalsTitle}
                        viewAllLink={newArrivalsLink}
                        products={data.newArrivals}
                        loading={loading}
                        count={newArrivalsCount}
                        layout={newArrivalsLayout}
                    />
                )}

                {/* Featured Products */}
                {showFeatured && (
                    <ProductRow
                        title={featuredTitle}
                        viewAllLink={featuredLink}
                        products={data.featured}
                        loading={loading}
                        count={featuredCount}
                        layout={featuredLayout}
                    />
                )}

                {/* Best Sellers */}
                {showBestSellers && (
                    <ProductRow
                        title={bestSellersTitle}
                        viewAllLink={bestSellersLink}
                        products={data.bestSellers}
                        loading={loading}
                        count={bestSellersCount}
                        layout={bestSellersLayout}
                    />
                )}

                {/* On Sale */}
                {showOnSale && (
                    <ProductRow
                        title={onSaleTitle}
                        viewAllLink={onSaleLink}
                        products={data.onSale}
                        loading={loading}
                        count={onSaleCount}
                        layout={onSaleLayout}
                    />
                )}

                {/* Shop by Brand */}
                {showBrands && (
                    <BrandStrip
                        title={brandsTitle}
                        brands={data.brands}
                        loading={loading}
                    />
                )}

            </Container>
        </Box>
    );
};

export default HomePage;
