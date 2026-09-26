import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Pagination,
  Chip,
  Button,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProductGrid from '../../components/product/ProductGrid';
import SearchWidget from '../../components/search/SearchWidget';
import PageSEO from '../../components/common/PageSEO';
import { useSettings } from '../../hooks/useSettings';
import { searchProducts } from '../../services/searchService';
import normalizeSearchQuery, { getSearchQueryLength } from '../../utils/searchQuery';

/**
 * SearchResultsPage — renders full-text search results.
 *
 * Reads `q` from the URL query string and fetches paginated results from GET /api/search.
 */
const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const { settings } = useSettings();
  const catalog = settings?.catalog || {};
  const gridCols = parseInt(catalog.gridColumns) || 4;
  const collectionLayout = catalog.templateLayout || 'sidebar-filters-grid';
  const isCompactCatalog = collectionLayout.includes('compact') || collectionLayout.includes('table') || collectionLayout.includes('b2b');

  // URL state
  const urlQuery = searchParams.get('q') || '';
  const normalizedQuery = normalizeSearchQuery(urlQuery);
  const parsedPage = Number(searchParams.get('page'));
  const urlPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  // Data state
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  // Fetch normalized results; cancellation prevents an older query overwriting a newer one.
  useEffect(() => {
    if (getSearchQueryLength(normalizedQuery) < 2) {
      setProducts([]);
      setBrands([]);
      setCategories([]);
      setMeta({ currentPage: 1, totalPages: 1, totalItems: 0 });
      setSuggestion(null);
      setSearchError('');
      setCanRetry(false);
      setHasSearched(false);
      setLoading(false);
      return undefined;
    }

    if (getSearchQueryLength(normalizedQuery) > 100) {
      setProducts([]);
      setBrands([]);
      setCategories([]);
      setSuggestion(null);
      setSearchError('Search is limited to 100 characters. Shorten your query and try again.');
      setCanRetry(false);
      setHasSearched(true);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const fetchResults = async () => {
      setLoading(true);
      setHasSearched(false);
      setSearchError('');
      setCanRetry(false);
      try {
        const res = await searchProducts({ q: normalizedQuery, page: urlPage, limit: 20 });
        if (cancelled) return;
        const data = res.data || {};
        const productData = data.products || {};
        setProducts(productData.data || []);
        setBrands(data.brands || []);
        setCategories(data.categories || []);
        setMeta({
          currentPage: productData.currentPage || 1,
          totalPages: productData.totalPages || 1,
          totalItems: productData.totalItems || 0,
        });
        setSuggestion(data.suggestion || null);
        setHasSearched(true);
      } catch (_error) {
        if (!cancelled) {
          setProducts([]);
          setBrands([]);
          setCategories([]);
          setMeta({ currentPage: 1, totalPages: 1, totalItems: 0 });
          setSuggestion(null);
          setSearchError('Search is temporarily unavailable. Please try again.');
          setCanRetry(true);
          setHasSearched(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchResults();
    return () => { cancelled = true; };
  }, [normalizedQuery, urlPage, retryNonce]);

  const handlePageChange = (_, page) => {
    setSearchParams({ q: normalizedQuery, page: String(page) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageSEO
        title={normalizedQuery ? `Search results for "${normalizedQuery}"` : 'Search'}
        description={normalizedQuery ? `Browse search results for "${normalizedQuery}"` : 'Search our products'}
      />

      {/* Search Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
        }}
      >
        <Typography variant="h4" component="h1" fontWeight={700} sx={{ mb: 2 }}>
          {normalizedQuery ? `Search results for "${normalizedQuery}"` : 'Search products'}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' },
            gap: 2,
          }}
        >
          <SearchWidget
            key={urlQuery}
            variant="inline"
            placeholder="Search products..."
            initialValue={normalizedQuery}
            onSearch={(q) => setSearchParams({ q, page: '1' })}
            sx={{ maxWidth: { sm: 500 } }}
          />

          {normalizedQuery && hasSearched && !loading && !searchError && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Chip
                label={`${meta.totalItems} product result${meta.totalItems !== 1 ? 's' : ''}`}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Box>
          )}
        </Box>

        {normalizedQuery && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1.5, fontWeight: 500 }}
          >
            {loading ? 'Searching...' : `Showing results for "${normalizedQuery}"`}
          </Typography>
        )}
      </Paper>

      {/* Loading State */}
      {loading && (
        <ProductGrid products={[]} loading={true} gridCols={gridCols} variant={isCompactCatalog ? 'compact-list' : 'grid'} />
      )}

      {!loading && hasSearched && (brands.length > 0 || categories.length > 0) && (
        <Box sx={{ display: 'grid', gap: 2.5, mb: 3 }}>
          {brands.length > 0 && (
            <Box component="section" aria-label="Matching brands">
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Matching brands</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {brands.map((brand) => (
                  <Chip
                    key={brand.id}
                    label={brand.name}
                    clickable
                    variant="outlined"
                    onClick={() => navigate(`/products?brand=${encodeURIComponent(brand.slug)}`)}
                  />
                ))}
              </Box>
            </Box>
          )}
          {categories.length > 0 && (
            <Box component="section" aria-label="Matching categories">
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Matching categories</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    clickable
                    variant="outlined"
                    onClick={() => navigate(`/category/${encodeURIComponent(category.slug)}`)}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Results */}
      {!loading && hasSearched && products.length > 0 && (
        <>
          <ProductGrid products={products} loading={false} gridCols={gridCols} variant={isCompactCatalog ? 'compact-list' : 'grid'} />

          {meta.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6, mb: 2 }}>
              <Pagination
                count={meta.totalPages}
                page={meta.currentPage}
                onChange={handlePageChange}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </>
      )}

      {searchError && !loading && (
        <Box role="alert" sx={{ textAlign: 'center', py: { xs: 5, md: 8 } }}>
          <Typography variant="h6" gutterBottom fontWeight={600} color={canRetry ? 'error.main' : 'text.primary'}>
            {searchError}
          </Typography>
          {canRetry && (
            <Button onClick={() => setRetryNonce((value) => value + 1)} variant="outlined" sx={{ mt: 1 }}>
              Try again
            </Button>
          )}
        </Box>
      )}

      {/* No Results State */}
      {!loading && hasSearched && products.length === 0 && brands.length === 0 && categories.length === 0 && !searchError && normalizedQuery && (
        <Box
          sx={{
            textAlign: 'center',
            py: { xs: 6, md: 10 },
          }}
        >
          <SearchOffIcon
            sx={{
              fontSize: 80,
              color: 'text.disabled',
              mb: 2,
            }}
          />
          <Typography variant="h5" gutterBottom fontWeight={600}>
            No results found
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}
          >
            We couldn't find any products matching "{normalizedQuery}".
            Try using different keywords or check for typos.
          </Typography>
          {suggestion && (
            <Chip
              label={`Did you mean "${suggestion}"?`}
              clickable
              color="primary"
              onClick={() => navigate(`/search?q=${encodeURIComponent(suggestion)}`)}
              sx={{ fontWeight: 600, mb: 2 }}
            />
          )}
          <Chip
            label="Browse all products"
            clickable
            color="primary"
            variant="outlined"
            onClick={() => navigate('/products')}
            sx={{ fontWeight: 600 }}
          />
        </Box>
      )}

      {/* Initial State (no query) */}
      {!loading && !hasSearched && getSearchQueryLength(normalizedQuery) < 2 && (
        <Box
          sx={{
            textAlign: 'center',
            py: { xs: 6, md: 10 },
          }}
        >
          <SearchIcon
            sx={{
              fontSize: 80,
              color: 'text.disabled',
              mb: 2,
            }}
          />
          <Typography variant="h5" gutterBottom fontWeight={600}>
            What are you looking for?
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {normalizedQuery ? 'Enter at least 2 characters to search.' : 'Type at least 2 characters to start searching'}
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default SearchResultsPage;
