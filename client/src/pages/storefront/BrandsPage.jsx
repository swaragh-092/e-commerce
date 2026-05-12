import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
  2: { xs: 12, sm: 6, md: 6, lg: 6 },
  3: { xs: 12, sm: 6, md: 4, lg: 4 },
  4: { xs: 12, sm: 6, md: 4, lg: 3 },
  5: { xs: 12, sm: 6, md: 4, lg: 2.4 },
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const BrandsPage = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLetter, setActiveLetter] = useState('All');
  const { settings } = useSettings();
  const brandsPage = settings?.brandsPage || {};

  const gridCols = parseInt(brandsPage.gridColumns) || 4;
  const showDescriptions = brandsPage.showDescriptions !== false;
  const cardStyle = brandsPage.cardStyle || 'inherit';
  const heroTitle = brandsPage.heroTitle || 'Shop by Brand';
  const heroSubtitle = brandsPage.heroSubtitle || 'Discover products grouped by your favorite brands.';
  const cardLayout = brandsPage.cardLayout || 'standard';
  const showAlphabeticalFilter = brandsPage.showAlphabeticalFilter !== false;
  const imageAspectRatio = brandsPage.imageAspectRatio || 'square';
  const cardBorderRadius = parseInt(brandsPage.cardBorderRadius) || 12;
  const showProductCount = brandsPage.showProductCount === true;
  const showFeaturedSection = brandsPage.showFeaturedSection !== false;
  const featuredLayout = brandsPage.featuredLayout || 'banner';
  const featuredCount = parseInt(brandsPage.featuredCount) || 3;
  const cols = COLS_MAP[gridCols] || COLS_MAP[4];

  const aspectHeight = useMemo(() => {
    switch (imageAspectRatio) {
      case 'landscape': return 160;
      case 'portrait': return 280;
      default: return 200;
    }
  }, [imageAspectRatio]);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await brandService.getBrands({
          isActive: 'true',
          limit: 100,
          sortBy: 'name',
          sortOrder: 'ASC',
        });
        setBrands(response?.data?.data || []);
      } catch (error) {
        setBrands([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBrands();
  }, []);

  const filteredBrands = useMemo(() => {
    if (activeLetter === 'All') return brands;
    return brands.filter((b) => b.name?.[0]?.toUpperCase() === activeLetter);
  }, [brands, activeLetter]);

  const availableLetters = useMemo(() => {
    const letters = new Set(brands.map((b) => b.name?.[0]?.toUpperCase()).filter(Boolean));
    return letters;
  }, [brands]);

  const featuredBrands = useMemo(() => {
    return brands.filter((b) => b.isFeatured).slice(0, featuredCount);
  }, [brands, featuredCount]);

  const nonFeaturedBrands = useMemo(() => {
    if (activeLetter === 'All') return brands.filter((b) => !b.isFeatured);
    return brands.filter((b) => !b.isFeatured && b.name?.[0]?.toUpperCase() === activeLetter);
  }, [brands, activeLetter]);

  const displayBrands = showFeaturedSection ? nonFeaturedBrands : filteredBrands;

  const cardSx = useMemo(() => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: `${cardBorderRadius}px`,
    overflow: 'hidden',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    ...(cardStyle !== 'inherit' && {
      boxShadow: cardStyle === 'elevated' ? '0 8px 32px rgba(0,0,0,0.08)' : 'none',
      border: cardStyle === 'flat' ? '1px solid transparent' : '1px solid',
      borderColor: cardStyle === 'outlined' ? 'divider' : 'transparent',
    }),
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: cardStyle === 'elevated' || cardStyle === 'inherit'
        ? '0 18px 48px rgba(0,0,0,0.12)'
        : '0 4px 16px rgba(0,0,0,0.06)',
    },
  }), [cardStyle, cardBorderRadius]);

  const renderStandardCard = (brand) => {
    const imageUrl = brand.image ? getMediaUrl(brand.image) : null;
    return (
      <Card sx={cardSx}>
        <Box sx={{ overflow: 'hidden', position: 'relative' }}>
          {imageUrl ? (
            <Box
              component="img"
              src={imageUrl}
              alt={brand.name}
              sx={{
                width: '100%',
                height: aspectHeight,
                objectFit: 'cover',
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { transform: 'scale(1.05)' },
              }}
            />
          ) : (
            <Box
              sx={{
                height: aspectHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="h2" fontWeight={800} color="text.secondary">
                {brand.name?.[0]?.toUpperCase() || 'B'}
              </Typography>
            </Box>
          )}
          {showProductCount && brand.productCount > 0 && (
            <Chip
              label={`${brand.productCount} product${brand.productCount === 1 ? '' : 's'}`}
              size="small"
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                bgcolor: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(4px)',
                fontWeight: 600,
                fontSize: 11,
              }}
            />
          )}
        </Box>
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2.5 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1.05rem' }}>
            {brand.name}
          </Typography>
          {showDescriptions && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1, lineHeight: 1.6 }}>
              {brand.description || 'Explore products from this brand.'}
            </Typography>
          )}
          <Stack direction="row" spacing={1.5}>
            <Button
              component={RouterLink}
              to={`/brands/${brand.slug}`}
              variant="contained"
              size="small"
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              View Brand
            </Button>
            <Button
              component={RouterLink}
              to={`/products?brand=${brand.slug}`}
              variant="outlined"
              size="small"
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              View Products
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  const renderOverlayCard = (brand) => {
    const imageUrl = brand.image ? getMediaUrl(brand.image) : null;
    return (
      <Card
        sx={{
          ...cardSx,
          minHeight: aspectHeight + 80,
          '&:hover .brand-overlay-img': { transform: 'scale(1.08)' },
        }}
      >
        <Box sx={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          {imageUrl ? (
            <Box
              component="img"
              src={imageUrl}
              alt={brand.name}
              className="brand-overlay-img"
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          ) : (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="h1" fontWeight={800} color="text.secondary">
                {brand.name?.[0]?.toUpperCase() || 'B'}
              </Typography>
            </Box>
          )}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0) 100%)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              p: 3,
              color: '#fff',
            }}
          >
            <Typography variant="h5" fontWeight={800} gutterBottom sx={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              {brand.name}
            </Typography>
            {showDescriptions && brand.description && (
              <Typography variant="body2" sx={{ mb: 2, opacity: 0.9, lineHeight: 1.6 }}>
                {brand.description}
              </Typography>
            )}
            <Stack direction="row" spacing={1.5}>
              <Button
                component={RouterLink}
                to={`/brands/${brand.slug}`}
                variant="contained"
                size="small"
                sx={{
                  bgcolor: '#fff',
                  color: '#000',
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                }}
              >
                View Brand
              </Button>
              {showProductCount && brand.productCount > 0 && (
                <Chip
                  label={`${brand.productCount} product${brand.productCount === 1 ? '' : 's'}`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 11,
                    backdropFilter: 'blur(4px)',
                  }}
                />
              )}
            </Stack>
          </Box>
        </Box>
      </Card>
    );
  };

  const renderMinimalCard = (brand) => {
    const imageUrl = brand.image ? getMediaUrl(brand.image) : null;
    return (
      <Card
        sx={{
          ...cardSx,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          flexDirection: { xs: 'row', sm: 'column' },
          textAlign: { xs: 'left', sm: 'center' },
        }}
      >
        <Box
          sx={{
            width: { xs: 72, sm: '100%' },
            height: { xs: 72, sm: aspectHeight * 0.7 },
            minWidth: { xs: 72, sm: 'auto' },
            borderRadius: `${cardBorderRadius * 0.6}px`,
            overflow: 'hidden',
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {imageUrl ? (
            <Box
              component="img"
              src={imageUrl}
              alt={brand.name}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { transform: 'scale(1.05)' },
              }}
            />
          ) : (
            <Typography variant="h4" fontWeight={800} color="text.secondary">
              {brand.name?.[0]?.toUpperCase() || 'B'}
            </Typography>
          )}
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            {brand.name}
          </Typography>
          {showProductCount && brand.productCount > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {brand.productCount} product{brand.productCount === 1 ? '' : 's'}
            </Typography>
          )}
          <Button
            component={RouterLink}
            to={`/brands/${brand.slug}`}
            variant="text"
            size="small"
            sx={{ textTransform: 'none', fontWeight: 600, p: 0, minWidth: 0 }}
          >
            Explore →
          </Button>
        </Box>
      </Card>
    );
  };

  const renderBrandCard = (brand) => {
    switch (cardLayout) {
      case 'overlay': return renderOverlayCard(brand);
      case 'minimal': return renderMinimalCard(brand);
      default: return renderStandardCard(brand);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <PageSEO title="Brands" description="Browse brands available in our store" />

      {/* Hero */}
      <Box sx={{ mb: { xs: 4, md: 6 }, textAlign: 'center', maxWidth: 720, mx: 'auto' }}>
        <Typography
          variant="h3"
          fontWeight={800}
          gutterBottom
          sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-0.02em' }}
        >
          {heroTitle}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
          {heroSubtitle}
        </Typography>
      </Box>

      {/* Featured Brands Hero */}
      {showFeaturedSection && !loading && featuredBrands.length > 0 && (
        <Box sx={{ mb: { xs: 5, md: 7 } }}>
          <Typography
            variant="overline"
            fontWeight={700}
            color="primary"
            sx={{ display: 'block', textAlign: 'center', mb: 1, letterSpacing: '0.08em' }}
          >
            Featured
          </Typography>
          {featuredLayout === 'banner' && (
            <Grid container spacing={3}>
              {featuredBrands.map((brand, index) => {
                const imageUrl = brand.image ? getMediaUrl(brand.image) : null;
                const isLarge = index === 0 && featuredBrands.length >= 3;
                return (
                  <Grid item xs={12} md={isLarge ? 6 : 6} lg={isLarge ? 7 : 5} key={brand.id}>
                    <Card
                      sx={{
                        height: { xs: 280, md: 360 },
                        borderRadius: `${cardBorderRadius}px`,
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': { transform: 'translateY(-4px)' },
                      }}
                    >
                      {imageUrl ? (
                        <Box
                          component="img"
                          src={imageUrl}
                          alt={brand.name}
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': { transform: 'scale(1.05)' },
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'action.hover',
                          }}
                        >
                          <Typography variant="h1" fontWeight={800} color="text.secondary">
                            {brand.name?.[0]?.toUpperCase() || 'B'}
                          </Typography>
                        </Box>
                      )}
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0) 100%)',
                        }}
                      />
                      <Box sx={{ position: 'relative', p: { xs: 3, md: 4 }, color: '#fff' }}>
                        <Typography variant="h4" fontWeight={800} gutterBottom sx={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)', fontSize: { xs: '1.5rem', md: '2rem' } }}>
                          {brand.name}
                        </Typography>
                        {brand.description && (
                          <Typography variant="body1" sx={{ mb: 2, opacity: 0.9, maxWidth: 480, lineHeight: 1.6, textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                            {brand.description}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Button
                            component={RouterLink}
                            to={`/brands/${brand.slug}`}
                            variant="contained"
                            sx={{
                              bgcolor: '#fff',
                              color: '#000',
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 600,
                              px: 3,
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                            }}
                          >
                            View Brand
                          </Button>
                          {showProductCount && brand.productCount > 0 && (
                            <Chip
                              label={`${brand.productCount} product${brand.productCount === 1 ? '' : 's'}`}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                color: '#fff',
                                fontWeight: 600,
                                backdropFilter: 'blur(4px)',
                              }}
                            />
                          )}
                        </Stack>
                      </Box>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
          {featuredLayout === 'carousel' && (
            <Box sx={{ display: 'flex', gap: 3, overflowX: 'auto', pb: 2, px: 0.5, scrollbarWidth: 'thin', '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'divider' } }}>
              {featuredBrands.map((brand) => {
                const imageUrl = brand.image ? getMediaUrl(brand.image) : null;
                return (
                  <Box key={brand.id} sx={{ minWidth: { xs: 280, md: 360 }, flexShrink: 0 }}>
                    <Card
                      sx={{
                        height: 280,
                        borderRadius: `${cardBorderRadius}px`,
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': { transform: 'translateY(-4px)' },
                      }}
                    >
                      {imageUrl ? (
                        <Box component="img" src={imageUrl} alt={brand.name} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                          <Typography variant="h2" fontWeight={800} color="text.secondary">{brand.name?.[0]?.toUpperCase() || 'B'}</Typography>
                        </Box>
                      )}
                      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0) 100%)' }} />
                      <Box sx={{ position: 'relative', p: 3, color: '#fff' }}>
                        <Typography variant="h6" fontWeight={800} gutterBottom sx={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>{brand.name}</Typography>
                        <Button component={RouterLink} to={`/brands/${brand.slug}`} variant="contained" size="small" sx={{ bgcolor: '#fff', color: '#000', borderRadius: 2, textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
                          View Brand
                        </Button>
                      </Box>
                    </Card>
                  </Box>
                );
              })}
            </Box>
          )}
          {featuredLayout === 'grid' && (
            <Grid container spacing={3}>
              {featuredBrands.map((brand) => (
                <Grid item xs={12} sm={6} md={4} key={brand.id}>
                  {renderBrandCard(brand)}
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Alphabetical Filter */}
      {showAlphabeticalFilter && !loading && brands.length > 0 && (
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 0.75 }}>
          <Button
            size="small"
            onClick={() => setActiveLetter('All')}
            variant={activeLetter === 'All' ? 'contained' : 'outlined'}
            sx={{ minWidth: 40, borderRadius: 1.5, fontWeight: 700, fontSize: 12, px: 1.2 }}
          >
            All
          </Button>
          {ALPHABET.map((letter) => {
            const hasBrands = availableLetters.has(letter);
            return (
              <Button
                key={letter}
                size="small"
                disabled={!hasBrands}
                onClick={() => hasBrands && setActiveLetter(letter)}
                variant={activeLetter === letter ? 'contained' : 'outlined'}
                sx={{
                  minWidth: 36,
                  borderRadius: 1.5,
                  fontWeight: 700,
                  fontSize: 12,
                  px: 1,
                  opacity: hasBrands ? 1 : 0.35,
                }}
              >
                {letter}
              </Button>
            );
          })}
        </Box>
      )}

      {/* Results count */}
      {!loading && displayBrands.length > 0 && activeLetter !== 'All' && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          {displayBrands.length} brand{displayBrands.length === 1 ? '' : 's'} starting with “{activeLetter}”
        </Typography>
      )}

      {/* All Brands heading */}
      {showFeaturedSection && !loading && featuredBrands.length > 0 && displayBrands.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" fontWeight={700}>
            All Brands
          </Typography>
          <Box sx={{ flexGrow: 1, height: 1, bgcolor: 'divider' }} />
        </Box>
      )}

      {/* Grid */}
      <Grid container spacing={3}>
        {loading
          ? Array.from({ length: 8 }).map((_, index) => (
              <Grid item {...cols} key={index}>
                <Skeleton variant="rounded" height={aspectHeight + 120} sx={{ borderRadius: `${cardBorderRadius}px` }} />
              </Grid>
            ))
          : displayBrands.map((brand) => (
              <Grid item {...cols} key={brand.id}>
                {renderBrandCard(brand)}
              </Grid>
            ))}
      </Grid>

      {/* Empty states */}
      {!loading && brands.length === 0 && (
        <Box sx={{ py: 12, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            No brands available
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Check back soon — we are adding new brands regularly.
          </Typography>
        </Box>
      )}

      {!loading && brands.length > 0 && displayBrands.length === 0 && activeLetter !== 'All' && (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            No brands starting with “{activeLetter}”
          </Typography>
          <Button variant="outlined" onClick={() => setActiveLetter('All')} sx={{ mt: 1, borderRadius: 2 }}>
            Show All Brands
          </Button>
        </Box>
      )}
    </Container>
  );
};

export default BrandsPage;
