import React, { useState, useEffect } from 'react';
import {
    Box, Breadcrumbs, Container, Grid, Link as MuiLink,
    Typography, Pagination, Drawer, IconButton, useTheme,
    useMediaQuery, FormControl, Select, MenuItem, Skeleton,
    alpha, Chip
} from '@mui/material';
import { FilterList as FilterIcon, Sort as SortIcon, NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import { Link as RouterLink, useParams, useSearchParams, useNavigate } from 'react-router-dom';

import ProductGrid from '../../components/product/ProductGrid';
import ProductFilters from '../../components/product/ProductFilters';
import StorefrontSidebarMenu from '../../components/layout/StorefrontSidebarMenu';
import CategorySection from '../../components/storefront/sections/CategorySection';
import PageSEO from '../../components/common/PageSEO';
import { useSettings, useFeature } from '../../hooks/useSettings';
import { getCategoryWithProducts } from '../../services/categoryService';
import { getMediaUrl } from '../../utils/media';

// ─── Subcategory chip rail (maps service response to CategorySection format) ─

const normalizeSubs = (subcategories) =>
    subcategories.map((s) => ({
        id: s.id,
        title: s.name,
        image: s.image,
        link: `/category/${s.slug}`,
    }));

// ─── Banner skeleton while loading ───────────────────────────────────────────

const BannerSkeleton = () => (
    <Skeleton variant="rounded" width="100%" sx={{ height: { xs: 180, md: 280 }, mb: 4, borderRadius: 3 }} />
);

// ─── Category page header variants ────────────────────────────────────────────

const CategoryHeader = ({ category, layout = 'standard', fallbackTitle = 'Shop Category' }) => {
    const title = category?.customHeading || category?.name || fallbackTitle;
    const description = category?.description;
    const image = category?.bannerImage ? getMediaUrl(category.bannerImage) : '';

    if (layout === 'cover') {
        return (
            <Box
                sx={{
                    width: '100%',
                    height: { xs: 190, md: 300 },
                    borderRadius: 3,
                    overflow: 'hidden',
                    mb: 4,
                    position: 'relative',
                    bgcolor: 'primary.main',
                }}
            >
                {image && (
                    <Box component="img" src={image} alt={title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        background: (t) => `linear-gradient(to right, ${alpha(t.palette.common.black, 0.66)} 0%, ${alpha(t.palette.common.black, 0.12)} 70%, transparent 100%)`,
                        display: 'flex',
                        alignItems: 'flex-end',
                        p: { xs: 2.5, md: 4 },
                    }}
                >
                    <Box>
                        <Typography id="category-heading" variant="h3" fontWeight={900} color="white" component="h1" sx={{ lineHeight: 1.12, textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
                            {title}
                        </Typography>
                        {description && (
                            <Typography variant="body1" color="rgba(255,255,255,0.84)" sx={{ mt: 0.75, maxWidth: 560 }}>
                                {description}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
        );
    }

    if (layout === 'split') {
        return (
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: image ? 'minmax(0, 1fr) 360px' : '1fr' },
                    gap: { xs: 2, md: 3 },
                    alignItems: 'stretch',
                    mb: 4,
                    p: { xs: 2.5, md: 3.5 },
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 14px 34px rgba(15, 23, 42, 0.06)',
                }}
            >
                <Box sx={{ alignSelf: 'center' }}>
                    <Typography id="category-heading" variant="h3" fontWeight={950} component="h1" sx={{ lineHeight: 1.1 }}>
                        {title}
                    </Typography>
                    {description && (
                        <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 620 }}>
                            {description}
                        </Typography>
                    )}
                </Box>
                {image && (
                    <Box component="img" src={image} alt={title} sx={{ width: '100%', height: { xs: 190, md: 240 }, objectFit: 'cover', borderRadius: 2.5 }} />
                )}
            </Box>
        );
    }

    return (
        <Box sx={{ mb: 3 }}>
            <Typography id="category-heading" variant="h4" fontWeight={900} component="h1">
                {title}
            </Typography>
            {description && (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 640 }}>
                    {description}
                </Typography>
            )}
        </Box>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const CategoryPage = () => {
    const { categorySlug } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Data state
    const [pageData, setPageData]       = useState(null);   // { category, subcategories, products, pagination }
    const [loading, setLoading]         = useState(true);
    const [notFound, setNotFound]       = useState(false);
    const [priceRange, setPriceRange]   = useState(null);
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

    const theme    = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // ── Settings ──────────────────────────────────────────────────────────────
    const { settings }      = useSettings();
    const catalog           = settings?.catalog || {};
    const categoryPage      = settings?.categoryPage || {};
    const defaultSort       = catalog.defaultSort       || 'newest';
    const defaultLimit      = parseInt(catalog.defaultPageSize) || 20;
    const gridCols          = parseInt(catalog.gridColumns) || 4;
    const showFilters       = catalog.showFilters !== false;
    const collectionLayout  = catalog.templateLayout || 'sidebar-filters-grid';
    const filterLayout      = catalog.filterLayout  || (collectionLayout.includes('top') ? 'topbar' : 'sidebar');
    const isCompact         = collectionLayout.includes('compact') || collectionLayout.includes('b2b');
    const showBreadcrumbs   = catalog.showBreadcrumbs !== false;
    const subcategoryVariant = catalog.subcategoryVariant || 'compact-chips';
    const categoryHeaderLayout = categoryPage.headerLayout || 'standard';
    const categoryFallbackTitle = categoryPage.heroTitle || 'Shop Category';
    const showSubcategories = categoryPage.showSubcategories !== false;
    const showSidebarFilters = showFilters && !isMobile && filterLayout !== 'topbar';
    const showTopbarFilters  = showFilters && !isMobile && filterLayout === 'topbar';
    const pricingEnabled     = useFeature('pricing');

    // ── URL-driven filter state ───────────────────────────────────────────────
    const filters = {
        page:     parseInt(searchParams.get('page'))     || 1,
        sort:     searchParams.get('sort')               || defaultSort,
        minPrice: searchParams.get('minPrice')           || '',
        maxPrice: searchParams.get('maxPrice')           || '',
        limit:    defaultLimit,
    };

    // ── Data fetching ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!categorySlug) return;
        setLoading(true);
        setNotFound(false);

        getCategoryWithProducts(categorySlug, filters.page, filters.limit, filters.sort)
            .then((res) => {
                const data = res?.data;
                if (!data?.category) { setNotFound(true); return; }
                setPageData(data);
                setPriceRange(data.priceRange || null);
            })
            .catch((err) => {
                if (err?.response?.status === 404) { setNotFound(true); }
                else { setPageData(null); }
            })
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categorySlug, searchParams.toString()]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleFilterChange = (newFilters) => {
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => { if (v) params.set(k, String(v)); });
        setSearchParams(params);
    };

    // ── 404 guard ─────────────────────────────────────────────────────────────
    if (!loading && notFound) {
        return (
            <Container maxWidth="md" sx={{ py: 10, textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>Category Not Found</Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    The category you're looking for doesn't exist or has been removed.
                </Typography>
                <Chip label="Back to Products" onClick={() => navigate('/products')} color="primary" sx={{ px: 2, py: 1, fontSize: '0.95rem', cursor: 'pointer' }} />
            </Container>
        );
    }

    const { category, subcategories = [], products = [], pagination } = pageData || {};
    const pageTitle = category?.customHeading || category?.name || categoryFallbackTitle;

    // Breadcrumb path: Home → (parent →) category
    const breadcrumbSegments = [
        { label: 'Home', to: '/' },
        ...(category?.parent ? [{ label: category.parent.name, to: `/category/${category.parent.slug}` }] : []),
        { label: category?.name || '…', to: null }, // current page
    ];

    // Build structured data for BreadcrumbList (SEO)
    const breadcrumbStructuredData = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbSegments.map((seg, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: seg.label,
            ...(seg.to ? { item: `${window.location.origin}${seg.to}` } : {}),
        })),
    };

    // Map subcategories → tiles expected by CategorySection
    const subcategoryTiles = normalizeSubs(subcategories);

    const hasActiveFilters = Boolean(filters.minPrice || filters.maxPrice);

    return (
        <Container maxWidth={isCompact ? 'lg' : 'xl'} sx={{ py: 4 }}>
            <PageSEO
                title={category?.metaTitle || pageTitle}
                description={category?.metaDescription || category?.description}
                image={category?.bannerImage ? getMediaUrl(category.bannerImage) : undefined}
                structuredData={breadcrumbStructuredData}
            />

            {/* ── Category header ─────────────────────────────────── */}
            {loading ? <BannerSkeleton /> : (
                <CategoryHeader
                    category={category}
                    layout={categoryHeaderLayout}
                    fallbackTitle={categoryFallbackTitle}
                />
            )}

            {/* ── Breadcrumbs ─────────────────────────────────────── */}
            {showBreadcrumbs && (
                <Breadcrumbs
                    separator={<NavigateNextIcon fontSize="small" />}
                    aria-label="breadcrumb"
                    sx={{ mb: 2 }}
                >
                    {breadcrumbSegments.map((seg, i) =>
                        seg.to ? (
                            <MuiLink
                                key={i}
                                component={RouterLink}
                                underline="hover"
                                color="inherit"
                                to={seg.to}
                                sx={{ fontSize: '0.875rem' }}
                            >
                                {seg.label}
                            </MuiLink>
                        ) : (
                            <Typography key={i} color="text.primary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                {loading ? <Skeleton width={100} /> : seg.label}
                            </Typography>
                        )
                    )}
                </Breadcrumbs>
            )}

            {/* ── Subcategory rail ─────────────────────────────────── */}
            {!loading && showSubcategories && subcategoryTiles.length > 0 && (
                <Box sx={{ mb: 4 }}>
                    <CategorySection
                        section={{
                            type: 'category-shortcuts',
                            variant: subcategoryVariant,
                            count: subcategoryTiles.length,
                        }}
                        categories={subcategories}
                        configuredTiles={subcategoryTiles}
                        mode="live"
                    />
                </Box>
            )}

            {/* ── Toolbar: count + sort + mobile filter ────────────── */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                    p: 0,
                }}
            >
                <Typography variant="body2" color="text.secondary">
                    {loading
                        ? <Skeleton width={100} />
                        : `${pagination?.totalItems ?? products.length} product${(pagination?.totalItems ?? products.length) !== 1 ? 's' : ''}`
                    }
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {showFilters && isMobile && (
                        <IconButton
                            onClick={() => setMobileFilterOpen(true)}
                            color="primary"
                            aria-label="Open filter menu"
                            size="small"
                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                        >
                            <FilterIcon fontSize="small" />
                        </IconButton>
                    )}
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <Select
                            value={filters.sort}
                            onChange={(e) => handleFilterChange({ ...filters, sort: e.target.value, page: 1 })}
                            displayEmpty
                            inputProps={{ 'aria-label': 'Sort products' }}
                            startAdornment={<SortIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />}
                            sx={{ borderRadius: 1.5, bgcolor: 'background.paper' }}
                        >
                            <MenuItem value="newest">Newest Arrivals</MenuItem>
                            {pricingEnabled && <MenuItem value="price_asc">Price: Low → High</MenuItem>}
                            {pricingEnabled && <MenuItem value="price_desc">Price: High → Low</MenuItem>}
                            <MenuItem value="name_asc">Name: A → Z</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Box>

            {/* ── Topbar filters ────────────────────────────────────── */}
            {showTopbarFilters && (
                <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
                    <ProductFilters
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        priceRange={priceRange}
                    />
                </Box>
            )}

            {/* ── Main grid ─────────────────────────────────────────── */}
            <Grid container spacing={isCompact ? 2.5 : 4}>
                {showSidebarFilters && (
                    <Grid
                        item
                        md={3}
                        lg={2.5}
                        sx={{ position: 'sticky', top: 24, alignSelf: 'flex-start', height: 'fit-content' }}
                    >
                        <StorefrontSidebarMenu />
                        <ProductFilters
                            filters={filters}
                            onFilterChange={handleFilterChange}
                            priceRange={priceRange}
                        />
                    </Grid>
                )}

                <Grid
                    item
                    xs={12}
                    md={showSidebarFilters ? 9  : 12}
                    lg={showSidebarFilters ? 9.5 : 12}
                >
                    <ProductGrid
                        products={products}
                        loading={loading}
                        gridCols={gridCols}
                        fromCategory={category?.name || ''}
                        hasActiveFilters={hasActiveFilters}
                        onClearFilters={() => setSearchParams(new URLSearchParams())}
                        variant={isCompact ? 'compact-list' : 'grid'}
                    />

                    {(pagination?.totalPages ?? 0) > 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                            <Pagination
                                count={pagination.totalPages}
                                page={filters.page}
                                onChange={(_, p) => handleFilterChange({ ...filters, page: p })}
                                color="primary"
                                size="large"
                            />
                        </Box>
                    )}
                </Grid>
            </Grid>

            {/* ── Mobile filter drawer ──────────────────────────────── */}
            <Drawer anchor="left" open={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)}>
                <Box sx={{ width: { xs: '85vw', sm: 320 }, maxWidth: 380, p: 3 }}>
                    <StorefrontSidebarMenu onNavigate={() => setMobileFilterOpen(false)} />
                    <ProductFilters
                        filters={filters}
                        onFilterChange={(f) => { handleFilterChange(f); setMobileFilterOpen(false); }}
                        priceRange={priceRange}
                    />
                </Box>
            </Drawer>
        </Container>
    );
};

export default CategoryPage;
