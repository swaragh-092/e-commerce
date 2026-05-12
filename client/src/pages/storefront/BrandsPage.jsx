import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import brandService from '../../services/brandService';
import { getMediaUrl } from '../../utils/media';
import PageSEO from '../../components/common/PageSEO';
import { useSettings } from '../../hooks/useSettings';

const COLS_MAP = {
  2: { xs: 6, sm: 6, md: 6, lg: 6 },
  3: { xs: 6, sm: 6, md: 4, lg: 4 },
  4: { xs: 6, sm: 4, md: 3, lg: 3 },
  5: { xs: 6, sm: 4, md: 3, lg: 2.4 },
};

const BrandsPage = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();
  const brandsPage = settings?.brandsPage || {};
  const gridCols = parseInt(brandsPage.gridColumns) || 4;
  const showDescriptions = brandsPage.showDescriptions !== false;
  const cardStyle = brandsPage.cardStyle || 'inherit';
  const cols = COLS_MAP[gridCols] || COLS_MAP[4];

  const cardSx = useMemo(() => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 3,
    ...(cardStyle !== 'inherit' && {
      boxShadow: cardStyle === 'elevated' ? '0 18px 45px rgba(31,41,51,0.08)' : 'none',
      border: cardStyle === 'flat' ? '1px solid transparent' : '1px solid',
      borderColor: cardStyle === 'outlined' ? 'divider' : 'transparent',
    }),
  }), [cardStyle]);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await brandService.getBrands({ isActive: 'true', limit: 100, sortBy: 'name', sortOrder: 'ASC' });
        setBrands(response?.data?.data || []);
      } catch (error) {
        setBrands([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBrands();
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <PageSEO title="Brands" description="Browse brands available in our store" />

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Shop by Brand
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Discover products grouped by your favorite brands.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {loading
          ? Array.from({ length: 8 }).map((_, index) => (
              <Grid item {...cols} key={index}>
                <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
                <Skeleton sx={{ mt: 1 }} height={32} />
                <Skeleton width="70%" />
              </Grid>
            ))
          : brands.map((brand) => {
              const imageUrl = brand.image ? getMediaUrl(brand.image) : null;

              return (
                <Grid item {...cols} key={brand.id}>
                  <Card sx={cardSx}>
                    {imageUrl ? (
                      <CardMedia component="img" height="200" image={imageUrl} alt={brand.name} />
                    ) : (
                      <Box
                        sx={{
                          height: 200,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Typography variant="h5" fontWeight={800} color="text.secondary">
                          {brand.name?.[0]?.toUpperCase() || 'B'}
                        </Typography>
                      </Box>
                    )}
                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6" fontWeight={700} gutterBottom>
                        {brand.name}
                      </Typography>
                      {showDescriptions && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
                          {brand.description || 'Explore products from this brand.'}
                        </Typography>
                      )}
                      <Stack direction="row" spacing={1}>
                        <Button component={RouterLink} to={`/brands/${brand.slug}`} variant="contained" size="small">
                          View Brand
                        </Button>
                        <Button component={RouterLink} to={`/products?brand=${brand.slug}`} variant="outlined" size="small">
                          View Products
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
      </Grid>

      {!loading && brands.length === 0 && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No active brands are available right now.
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default BrandsPage;