import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Paper,
  Typography,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  CircularProgress,
  Popper,
  ClickAwayListener,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { searchProducts } from '../../services/searchService';

const PRODUCT_LIMIT = 5;
const BRAND_LIMIT = 3;
const CATEGORY_LIMIT = 3;
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

const GlobalSearchBar = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef(null);
  const popperRef = useRef(null);
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  const allItems = buildItemList(results);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setSuggestion(null);
      setOpen(false);
      return;
    }

    let cancelled = false;

    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await searchProducts({ q: debouncedQuery, limit: PRODUCT_LIMIT });
        if (!cancelled) {
          setResults(res.data);
          setSuggestion(res.data?.suggestion || null);
          setOpen(true);
          setSelectedIndex(-1);
        }
      } catch (_err) {
        if (!cancelled) {
          setResults(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchResults();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSelectedIndex(-1);
  }, []);

  const handleKeyDown = (e) => {
    if (!open || allItems.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < allItems.length) {
          navigate(allItems[selectedIndex].to);
          closeDropdown();
          setQuery('');
          inputRef.current?.blur();
        }
        break;
      case 'Escape':
        closeDropdown();
        inputRef.current?.blur();
        break;
    }
  };

  const handleItemClick = (to) => {
    navigate(to);
    closeDropdown();
    setQuery('');
  };

  const handleSeeAll = () => {
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    closeDropdown();
    setQuery('');
  };

  const hasAnyResults =
    (results?.products?.data?.length || 0) > 0 ||
    (results?.brands?.length || 0) > 0 ||
    (results?.categories?.length || 0) > 0;

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 520, mx: { xs: 1, md: 2 }, position: 'relative' }}>
      <TextField
        inputRef={inputRef}
        size="small"
        fullWidth
        placeholder="Search products, brands, categories..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results && debouncedQuery.length >= MIN_QUERY_LENGTH) setOpen(true); }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {loading ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <SearchIcon color="action" fontSize="small" />
              )}
            </InputAdornment>
          ),
          endAdornment: query ? (
            <InputAdornment position="end">
              <Chip
                label={`${results?.products?.totalItems || 0}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
              />
            </InputAdornment>
          ) : null,
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: alpha(theme.palette.common.white, 0.15),
            color: '#fff',
            borderRadius: 2,
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: alpha(theme.palette.common.white, 0.22),
            },
            '&.Mui-focused': {
              bgcolor: alpha(theme.palette.common.white, 0.28),
            },
            '& fieldset': { borderColor: 'transparent' },
            '&:hover fieldset': { borderColor: 'transparent' },
            '&.Mui-focused fieldset': { borderColor: alpha('#fff', 0.3) },
          },
          '& .MuiInputBase-input::placeholder': {
            color: alpha('#fff', 0.65),
            opacity: 1,
          },
        }}
      />

      <Popper
        ref={popperRef}
        open={open && hasAnyResults}
        anchorEl={inputRef.current}
        placement="bottom-start"
        disablePortal={false}
        modifiers={[{ name: 'offset', options: { offset: [0, 6] } }]}
        sx={{ zIndex: 1300, width: inputRef.current?.offsetWidth || 520 }}
      >
        <ClickAwayListener onClickAway={closeDropdown}>
          <Paper
            elevation={8}
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              maxHeight: 480,
              overflowY: 'auto',
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            {/* Products Section */}
            {results?.products?.data?.length > 0 && (
              <>
                <SectionHeader
                  title="Products"
                  count={results.products.totalItems}
                  onSeeAll={handleSeeAll}
                />
                <List dense disablePadding>
                  {results.products.data.map((product, idx) => {
                    const globalIdx = idx;
                    const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
                    return (
                      <ListItemButton
                        key={product.id}
                        selected={selectedIndex === globalIdx}
                        onClick={() => handleItemClick(`/products/${product.slug}`)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        sx={{ py: 1, px: 2 }}
                      >
                        <ListItemAvatar sx={{ minWidth: 48 }}>
                          <Avatar
                            variant="rounded"
                            src={primaryImage?.url}
                            alt={product.name}
                            sx={{ width: 40, height: 40, bgcolor: 'action.hover' }}
                          >
                            <SearchIcon fontSize="small" color="disabled" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={product.name}
                          secondary={`₹${product.effectivePrice ?? product.price}`}
                          primaryTypographyProps={{
                            variant: 'body2',
                            fontWeight: 500,
                            noWrap: true,
                          }}
                          secondaryTypographyProps={{
                            variant: 'caption',
                            fontWeight: 600,
                            color: 'primary.main',
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </>
            )}

            {/* Brands Section */}
            {results?.brands?.length > 0 && (
              <>
                {results?.products?.data?.length > 0 && <Divider />}
                <SectionHeader title="Brands" />
                <List dense disablePadding>
                  {results.brands.map((brand, idx) => {
                    const globalIdx = (results?.products?.data?.length || 0) + idx;
                    return (
                      <ListItemButton
                        key={brand.id}
                        selected={selectedIndex === globalIdx}
                        onClick={() => handleItemClick(`/products?brand=${brand.slug}`)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        sx={{ py: 1, px: 2 }}
                      >
                        <ListItemAvatar sx={{ minWidth: 48 }}>
                          <Avatar
                            variant="rounded"
                            src={brand.image}
                            alt={brand.name}
                            sx={{ width: 40, height: 40, bgcolor: 'action.hover' }}
                          >
                            {brand.name.charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={brand.name}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </>
            )}

            {/* Categories Section */}
            {results?.categories?.length > 0 && (
              <>
                {((results?.products?.data?.length > 0) || (results?.brands?.length > 0)) && <Divider />}
                <SectionHeader title="Categories" />
                <List dense disablePadding>
                  {results.categories.map((cat, idx) => {
                    const globalIdx =
                      (results?.products?.data?.length || 0) +
                      (results?.brands?.length || 0) +
                      idx;
                    return (
                      <ListItemButton
                        key={cat.id}
                        selected={selectedIndex === globalIdx}
                        onClick={() => handleItemClick(`/products?category=${cat.slug}`)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        sx={{ py: 1, px: 2 }}
                      >
                        <ListItemAvatar sx={{ minWidth: 48 }}>
                          <Avatar
                            variant="rounded"
                            src={cat.image}
                            alt={cat.name}
                            sx={{ width: 40, height: 40, bgcolor: 'action.hover' }}
                          >
                            {cat.name.charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={cat.name}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </>
            )}

            {/* See all footer */}
            {(results?.products?.totalItems || 0) > PRODUCT_LIMIT && (
              <>
                <Divider />
                <ListItemButton onClick={handleSeeAll} sx={{ py: 1.25, px: 2, justifyContent: 'center' }}>
                  <Typography variant="body2" color="primary" fontWeight={600}>
                    See all {results.products.totalItems} results
                  </Typography>
                  <ArrowForwardIcon sx={{ ml: 0.5, fontSize: 16 }} color="primary" />
                </ListItemButton>
              </>
            )}
          </Paper>
        </ClickAwayListener>
      </Popper>

      {/* No results state */}
      <Popper
        open={open && !loading && debouncedQuery.length >= MIN_QUERY_LENGTH && !hasAnyResults}
        anchorEl={inputRef.current}
        placement="bottom-start"
        disablePortal={false}
        modifiers={[{ name: 'offset', options: { offset: [0, 6] } }]}
        sx={{ zIndex: 1300, width: inputRef.current?.offsetWidth || 520 }}
      >
        <ClickAwayListener onClickAway={closeDropdown}>
          <Paper
            elevation={8}
            sx={{ borderRadius: 2, p: 3, textAlign: 'center' }}
          >
            <SearchOffIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No results for "{debouncedQuery}"
            </Typography>
            {suggestion && (
              <Chip
                label={`Did you mean "${suggestion}"?`}
                clickable
                color="primary"
                size="small"
                onClick={() => {
                  setQuery(suggestion);
                  closeDropdown();
                }}
                sx={{ fontWeight: 600, mt: 0.5 }}
              />
            )}
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
};

const SectionHeader = ({ title, count, onSeeAll }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: 2,
      pt: 1.5,
      pb: 0.5,
    }}
  >
    <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
      {title}{count !== undefined ? ` (${count})` : ''}
    </Typography>
    {onSeeAll && (
      <Chip
        label="See all"
        size="small"
        clickable
        onClick={(e) => { e.stopPropagation(); onSeeAll(); }}
        icon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
        sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
      />
    )}
  </Box>
);

/**
 * Build flat item list for keyboard arrow navigation.
 */
const buildItemList = (results) => {
  if (!results) return [];
  const items = [];
  (results.products?.data || []).forEach((p) => items.push({ to: `/products/${p.slug}`, type: 'product' }));
  (results.brands || []).forEach((b) => items.push({ to: `/products?brand=${b.slug}`, type: 'brand' }));
  (results.categories || []).forEach((c) => items.push({ to: `/products?category=${c.slug}`, type: 'category' }));
  return items;
};

export default GlobalSearchBar;
