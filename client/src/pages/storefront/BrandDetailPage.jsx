import { useEffect, useState } from 'react';
import { Box, Button, Container, Pagination, Skeleton, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import PageSEO from '../../components/common/PageSEO';
import ProductGrid from '../../components/product/ProductGrid';
import { getProducts } from '../../services/productService';
import brandService from '../../services/brandService';
import { getMediaUrl } from '../../utils/media';
import { useSettings } from '../../hooks/useSettings';

const BrandDetailPage = () => {
  const { slug } = useParams();
  const { settings } = useSettings();
  const catalog = settings?.catalog || {};

  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loadingBrand, setLoadingBrand] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchBrand = async () => {
      setLoadingBrand(true);
      try {
        const response = await brandService.getBrandBySlug(slug);
        setBrand(response?.data?.data?.brand || null);
      } catch (error) {
        setBrand(null);
      } finally {
        setLoadingBrand(false);
      }
    };

    fetchBrand();
  }, [slug]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const response = await getProducts({
          brand: slug,
          page,
          limit: parseInt(catalog.defaultPageSize) || 20,
          status: 'published',
          sort: catalog.defaultSort || 'newest',
        });
        setProducts(response?.data || []);
        setMeta(response?.meta || { page: 1, totalPages: 1, total: 0 });
      } catch (error) {
        setProducts([]);
        setMeta({ page: 1, totalPages: 1, total: 0 });
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [catalog.defaultPageSize, catalog.defaultSort, page, slug]);

  useEffect(() => {
    setPage(1);
  }, [slug]);

  if (!loadingBrand && !brand) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Brand not found.
        </Typography>
        <Button component={RouterLink} to="/brands" variant="contained">
          Browse Brands
        </Button>
      </Container>
    );
  }

  const brandImageUrl = brand?.image ? getMediaUrl(brand.image) : null;

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <PageSEO
        title={brand?.name || 'Brand'}
        description={brand?.description || 'Brand products'}
        image={brand?.image || undefined}
      />

      <Box
        sx={{
          mb: 5,
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {loadingBrand ? (
          <Skeleton variant="rectangular" height={260} />
        ) : (
          <Box
            sx={{
              minHeight: 260,
              display: 'flex',
              alignItems: 'center',
              p: { xs: 3, md: 5 },
              gap: 4,
              flexDirection: { xs: 'column', md: 'row' },
            }}
          >
            <Box
              sx={{
                width: { xs: '100%', md: 260 },
                minWidth: { md: 260 },
                height: 220,
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {brandImageUrl ? (
                <Box component="img" src={brandImageUrl} alt={brand?.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Typography variant="h2" fontWeight={800} color="text.secondary">
                  {brand?.name?.[0]?.toUpperCase() || 'B'}
                </Typography>
              )}
            </Box>

            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
                Brand
              </Typography>
              <Typography variant="h3" fontWeight={800} gutterBottom>
                {brand?.name}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720, mb: 2 }}>
                {brand?.description || 'Browse all products available from this brand.'}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button component={RouterLink} to={`/products?brand=${slug}`} variant="contained">
                  Shop This Brand
                </Button>
                <Button component={RouterLink} to="/brands" variant="outlined">
                  All Brands
                </Button>
              </Stack>
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={700}>
          Products from {brand?.name || 'this brand'}
        </Typography>
        {!loadingProducts && meta.total > 0 && (
          <Typography variant="body2" color="text.secondary">
            {meta.total} product{meta.total === 1 ? '' : 's'} found
          </Typography>
        )}
      </Box>

      <ProductGrid products={products} loading={loadingProducts} gridCols={parseInt(catalog.gridColumns) || 4} />

      {meta.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <Pagination count={meta.totalPages} page={meta.page} onChange={(_, nextPage) => setPage(nextPage)} color="primary" size="large" />
        </Box>
      )}
    </Container>
  );
};

export default BrandDetailPage;