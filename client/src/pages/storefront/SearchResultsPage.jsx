import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Pagination,
  TextField,
  InputAdornment,
  Chip,
  Paper,
  Skeleton,
  Grid,
  useTheme,
  alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProductGrid from '../../components/product/ProductGrid';
import PageSEO from '../../components/common/PageSEO';
import { useDebounce } from '../../hooks/useDebounce';
import { useSettings } from '../../hooks/useSettings';
import { searchProducts } from '../../services/searchService';

/**
 * SearchResultsPage — renders full-text search results.
 *
 * Reads `q` from the URL query string, debounces local input changes,
 * and fetches paginated results from GET /api/search.
 */
const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const { settings } = useSettings();
  const catalog = settings?.catalog || {};
  const gridCols = parseInt(catalog.gridColumns) || 4;

  // URL state
  const urlQuery = searchParams.get('q') || '';
  const urlPage = parseInt(searchParams.get('page')) || 1;

  // Local input state (for debouncing)
  const [searchInput, setSearchInput] = useState(urlQuery);
  const debouncedInput = useDebounce(searchInput, 300);

  // Data state
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  // Sync debounced input → URL params
  useEffect(() => {
    if (debouncedInput !== urlQuery) {
      if (debouncedInput.length >= 2) {
        setSearchParams({ q: debouncedInput, page: '1' });
      } else if (debouncedInput.length === 0 && urlQuery) {
        // Clear search
        setSearchParams({});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput]);

  // Sync URL → local input (browser back/forward)
  useEffect(() => {
    setSearchInput(urlQuery);
  }, [urlQuery]);

  // Fetch results when URL params change
  useEffect(() => {
    if (!urlQuery || urlQuery.length < 2) {
      setProducts([]);
      setMeta({ currentPage: 1, totalPages: 1, totalItems: 0 });
      setHasSearched(false);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await searchProducts({ q: urlQuery, page: urlPage, limit: 20 });
        const productData = res.data?.products || {};
        setProducts(productData.data || []);
        setMeta({
          currentPage: productData.currentPage || 1,
          totalPages: productData.totalPages || 1,
          totalItems: productData.totalItems || 0,
        });
        setSuggestion(res.data?.suggestion || null);
        setHasSearched(true);
      } catch (err) {
        console.error('Search failed:', err);
        setProducts([]);
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [urlQuery, urlPage]);

  const handlePageChange = (_, page) => {
    setSearchParams({ q: urlQuery, page: String(page) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim().length >= 2) {
      setSearchParams({ q: searchInput.trim(), page: '1' });
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageSEO
        title={urlQuery ? `Search results for "${urlQuery}"` : 'Search'}
        description={urlQuery ? `Browse search results for "${urlQuery}"` : 'Search our products'}
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
        <Box
          component="form"
          onSubmit={handleSearchSubmit}
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' },
            gap: 2,
          }}
        >
          <TextField
            id="global-search-input"
            fullWidth
            size="medium"
            placeholder="Search products..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              maxWidth: { sm: 500 },
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.paper',
                borderRadius: 2,
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
              },
            }}
          />

          {urlQuery && hasSearched && !loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Chip
                label={`${meta.totalItems} result${meta.totalItems !== 1 ? 's' : ''}`}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Box>
          )}
        </Box>

        {urlQuery && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1.5, fontWeight: 500 }}
          >
            {loading ? 'Searching...' : `Showing results for "${urlQuery}"`}
          </Typography>
        )}
      </Paper>

      {/* Loading State */}
      {loading && (
        <ProductGrid products={[]} loading={true} gridCols={gridCols} />
      )}

      {/* Results */}
      {!loading && hasSearched && products.length > 0 && (
        <>
          <ProductGrid products={products} loading={false} gridCols={gridCols} />

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

      {/* No Results State */}
      {!loading && hasSearched && products.length === 0 && urlQuery && (
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
            We couldn't find any products matching "{urlQuery}".
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
      {!loading && !hasSearched && !urlQuery && (
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
            Type at least 2 characters to start searching
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default SearchResultsPage;
