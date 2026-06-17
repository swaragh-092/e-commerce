import React, { useState, useEffect } from 'react';
import { Box, Breadcrumbs, Container, Grid, Link as MuiLink, Typography, Pagination, Drawer, IconButton, useTheme, useMediaQuery, FormControl, Select, MenuItem, alpha } from '@mui/material';
import { FilterList as FilterIcon, Sort as SortIcon } from '@mui/icons-material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import ProductGrid from '../../components/product/ProductGrid';
import ProductFilters from '../../components/product/ProductFilters';
import StorefrontSidebarMenu from '../../components/layout/StorefrontSidebarMenu';
import { getProducts } from '../../services/productService';
import { getCategoryTree } from '../../services/categoryService';
import PageSEO from '../../components/common/PageSEO';
import { useSettings, useFeature } from '../../hooks/useSettings';

const ProductListPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
    const [priceRange, setPriceRange] = useState(null);
    const [categoryName, setCategoryName] = useState('');

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { settings } = useSettings();
    const catalog      = settings?.catalog || {};
    const defaultSort  = catalog.defaultSort  || 'newest';
    const defaultLimit = parseInt(catalog.defaultPageSize) || 20;
    const gridCols     = parseInt(catalog.gridColumns) || 4;
    const showFilters  = catalog.showFilters !== false;
    const collectionLayout = catalog.templateLayout || 'sidebar-filters-grid';
    const filterLayout = catalog.filterLayout || (collectionLayout.includes('top') ? 'topbar' : 'sidebar');
    const isCompactCatalog = collectionLayout.includes('compact') || collectionLayout.includes('table') || collectionLayout.includes('b2b');
    const isEditorialCatalog = collectionLayout.includes('editorial') || collectionLayout.includes('image-led');
    const showSidebarFilters = showFilters && !isMobile && filterLayout !== 'topbar';
    const showTopbarFilters = showFilters && !isMobile && filterLayout === 'topbar';
    const showCatalogBreadcrumbs = catalog.showBreadcrumbs !== false;
    const pricingEnabled = useFeature('pricing');



    const filters = {
        search: searchParams.get('search') || '',
        category: searchParams.get('category') || '',
        brand: searchParams.get('brand') || '',
        page: parseInt(searchParams.get('page')) || 1,
        sort: searchParams.get('sort') || defaultSort,
        minPrice: searchParams.get('minPrice') || '',
        maxPrice: searchParams.get('maxPrice') || '',
        ...(searchParams.get('onSale') === 'true' && { saleStatus: 'active' }),
        status: 'published',
        limit: defaultLimit,
    };

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const res = await getProducts(filters);
                setProducts(res.data || []);
                if (res.meta) {
                    setMeta(res.meta);
                    setPriceRange(res.meta.priceRange || null);
                } else {
                    setPriceRange(null);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams.toString()]);

    // Resolve the category slug → full breadcrumb path for the contextual breadcrumb on PDP
    // e.g. "vegetable" slug → "Vegetable > Roots > Beetroot" when filtering by beetroot
    useEffect(() => {
        const categorySlug = searchParams.get('category');
        if (!categorySlug) { setCategoryName(''); return; }

        // Recursively search the tree, building the path as we go.
        // Returns the full path string if found, or null.
        const findPathInTree = (nodes, slug, ancestors = []) => {
            for (const node of nodes) {
                const currentPath = [...ancestors, node.name];
                if (node.slug === slug) return currentPath.join(' > ');
                if (node.children?.length) {
                    const found = findPathInTree(node.children, slug, currentPath);
                    if (found) return found;
                }
            }
            return null;
        };

        getCategoryTree().then((res) => {
            const path = findPathInTree(res?.data || [], categorySlug);
            setCategoryName(path || '');
        }).catch(() => setCategoryName(''));
    }, [searchParams.get('category')]);

    const handleFilterChange = (newFilters) => {
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => {
            if (v) params.set(k, v);
        });
        setSearchParams(params);
    };

    const categoryBreadcrumbs = categoryName ? categoryName.split(' > ') : [];
    const hasActiveFilters = Boolean(
        filters.search
        || filters.category
        || filters.brand
        || filters.minPrice
        || filters.maxPrice
    );

    return (
        <Container maxWidth={isCompactCatalog ? 'lg' : 'xl'} sx={{ py: isEditorialCatalog ? { xs: 3, md: 5 } : 4 }}>
            <PageSEO title="Products" description="Browse our products" />
            {showCatalogBreadcrumbs && (
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
                <MuiLink component={RouterLink} underline="hover" color="inherit" to="/">
                    Home
                </MuiLink>
                {categoryBreadcrumbs.length > 0 ? (
                    <MuiLink component={RouterLink} underline="hover" color="inherit" to="/products">
                        Products
                    </MuiLink>
                ) : (
                    <Typography color="text.primary">Products</Typography>
                )}
                {categoryBreadcrumbs.map((name, index) => (
                    <Typography key={`${name}-${index}`} color={index === categoryBreadcrumbs.length - 1 ? 'text.primary' : 'text.secondary'}>
                        {name}
                    </Typography>
                ))}
            </Breadcrumbs>
            )}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                p: isEditorialCatalog ? { xs: 2.5, md: 4 } : 0,
                borderRadius: isEditorialCatalog ? 4 : 0,
                border: isEditorialCatalog ? '1px solid' : 'none',
                borderColor: 'divider',
                background: isEditorialCatalog ? (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.10)}, ${alpha(theme.palette.secondary.main, 0.06)})` : 'transparent',
            }}>
                <Typography variant="h4" fontWeight="bold">Our Products</Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {showFilters && isMobile && (
                        <IconButton 
                            onClick={() => setMobileFilterOpen(true)} 
                            color="primary"
                            aria-label="Open filter menu"
                        >
                            <FilterIcon />
                        </IconButton>
                    )}
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <Select
                            value={filters.sort || 'newest'}
                            onChange={(e) => handleFilterChange({ ...filters, sort: e.target.value, page: 1 })}
                            displayEmpty
                            inputProps={{ 'aria-label': 'Sort products' }}
                            startAdornment={<SortIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />}
                            sx={{ borderRadius: 1.5, bgcolor: 'background.paper' }}
                        >
                            <MenuItem value="newest">Newest Arrivals</MenuItem>
                            {pricingEnabled && <MenuItem value="price_asc">Price: Low to High</MenuItem>}
                            {pricingEnabled && <MenuItem value="price_desc">Price: High to Low</MenuItem>}
                            <MenuItem value="name_asc">Name: A to Z</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Box>

            {showTopbarFilters && (
                <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
                    <ProductFilters filters={filters} onFilterChange={handleFilterChange} priceRange={priceRange} />
                </Box>
            )}

            <Grid container spacing={isCompactCatalog ? 2.5 : 4}>
                {showSidebarFilters && (
                    <Grid item md={3} lg={2.5} sx={{ position: 'sticky', top: 24, alignSelf: 'flex-start', height: 'fit-content' }}>
                        <StorefrontSidebarMenu />
                        <ProductFilters filters={filters} onFilterChange={handleFilterChange} priceRange={priceRange} />
                    </Grid>
                )}

                <Grid item xs={12} md={showSidebarFilters ? 9 : 12} lg={showSidebarFilters ? 9.5 : 12}>
                    <ProductGrid
                        products={products}
                        loading={loading}
                        gridCols={gridCols}
                        fromCategory={categoryName}
                        hasActiveFilters={hasActiveFilters}
                        onClearFilters={() => setSearchParams(new URLSearchParams())}
                        variant={isCompactCatalog ? 'compact-list' : 'grid'}
                    />

                    {meta.totalPages > 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                            <Pagination
                                count={meta.totalPages}
                                page={meta.page}
                                onChange={(e, p) => handleFilterChange({ ...filters, page: p })}
                                color="primary"
                                size="large"
                            />
                        </Box>
                    )}
                </Grid>
            </Grid>

            <Drawer anchor="left" open={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)}>
                <Box sx={{ width: { xs: '85vw', sm: 320 }, maxWidth: 380, p: 3 }}>
                    <StorefrontSidebarMenu onNavigate={() => setMobileFilterOpen(false)} />
                    <ProductFilters filters={filters} onFilterChange={(f) => { handleFilterChange(f); setMobileFilterOpen(false); }} priceRange={priceRange} />
                </Box>
            </Drawer>
        </Container>
    );
};

export default ProductListPage;
