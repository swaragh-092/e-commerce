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
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import HistoryIcon from '@mui/icons-material/History';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { searchProducts } from '../../services/searchService';

const PRODUCT_LIMIT = 5;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const MAX_RECENT_SEARCHES = 5;
const RECENT_SEARCHES_KEY = 'store_recent_searches';

/**
 * SearchWidget - A modular, responsive search component
 * 
 * @param {string} variant - 'header' | 'inline' | 'sidebar' | 'minimal'
 * @param {string} placeholder - Custom placeholder text
 * @param {boolean} showSuggestions - Whether to show autocomplete dropdown
 * @param {function} onSearch - Callback when search is submitted (prevents default navigation if provided)
 * @param {string} initialValue - Initial query value
 * @param {object} sx - Custom MUI system styles
 */
const SearchWidget = ({
  variant = 'default',
  placeholder = 'Search products...',
  showSuggestions = true,
  onSearch,
  initialValue = '',
  sx = {},
  fullWidth = true,
  collapseToIcon = false,
  onExpandedChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const routeSearchValue = new URLSearchParams(location.search).get('search') || '';
  const [query, setQuery] = useState(initialValue || (variant === 'header' ? routeSearchValue : ''));
  const [results, setResults] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isExpanded, setIsExpanded] = useState(variant !== 'header');
  const [recentSearches, setRecentSearches] = useState([]);

  const inputRef = useRef(null);
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Reactive Popper width
  const [popperWidth, setPopperWidth] = useState(280);
  useEffect(() => {
    const updateWidth = () => {
      const inputW = inputRef.current?.offsetWidth || 0;
      setPopperWidth(Math.min(window.innerWidth - 32, Math.max(inputW, 280)));
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    if (collapseToIcon && isExpanded) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [collapseToIcon, isExpanded]);

  useEffect(() => {
    if (typeof onExpandedChange === 'function') {
      onExpandedChange(isExpanded);
    }
  }, [isExpanded, onExpandedChange]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        setRecentSearches([]);
      }
    }
  }, []);

  const saveRecentSearch = (term) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const removeRecentSearch = (term) => {
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== term);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const allItems = buildItemList(results, !query ? recentSearches : []);

  // Sync initial value
  useEffect(() => {
    setQuery(initialValue || (variant === 'header' ? routeSearchValue : ''));
  }, [initialValue, routeSearchValue, variant]);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (!showSuggestions || !debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) {
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
          setOpen(res.data?.products?.data?.length > 0 || res.data?.brands?.length > 0 || res.data?.categories?.length > 0);
          setSelectedIndex(-1);
        }
      } catch (_err) {
        if (!cancelled) setResults(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchResults();
    return () => { cancelled = true; };
  }, [debouncedQuery, showSuggestions]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSelectedIndex(-1);
  }, []);

  const executeSearch = (q) => {
    const searchTrimmed = q.trim();
    if (!searchTrimmed) return;

    if (onSearch) {
      onSearch(searchTrimmed);
    } else {
      navigate(`/products?search=${encodeURIComponent(searchTrimmed)}`);
    }
    saveRecentSearch(searchTrimmed);
    closeDropdown();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allItems.length) {
        const item = allItems[selectedIndex];
        navigate(item.to);
        closeDropdown();
        inputRef.current?.blur();
      } else {
        executeSearch(query);
      }
      return;
    }

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
      case 'Escape':
        closeDropdown();
        inputRef.current?.blur();
        break;
    }
  };

  const handleItemClick = (item) => {
    if (item.type === 'recent') {
      setQuery(item.label);
      executeSearch(item.label);
    } else {
      navigate(item.to);
      if (item.type === 'product') saveRecentSearch(item.label);
      closeDropdown();
    }
  };

  const handleClear = () => {
    setQuery('');
    if (onSearch) onSearch('');
    inputRef.current?.focus();
  };

  // Styles based on variant
  const getStyles = () => {
    if (variant === 'header') {
      return {
        bgcolor: alpha(theme.palette.common.white, 0.15),
        color: '#fff',
        borderRadius: 2,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.22) },
        '&.Mui-focused': { bgcolor: alpha(theme.palette.common.white, 0.28) },
        '& fieldset': { borderColor: 'transparent' },
        '&:hover fieldset': { borderColor: 'transparent' },
        '&.Mui-focused fieldset': { borderColor: alpha('#fff', 0.3) },
        '& .MuiInputBase-input::placeholder': { color: alpha('#fff', 0.7), opacity: 1 },
      };
    }
    
    if (variant === 'inline') {
      return {
        bgcolor: 'background.paper',
        borderRadius: 1.5,
        '& fieldset': { borderColor: alpha(theme.palette.divider, 0.8) },
        '&:hover fieldset': { borderColor: theme.palette.primary.main },
      };
    }

    // Default premium pill look
    return {
      bgcolor: 'background.paper',
      borderRadius: 50,
      boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      '& fieldset': { borderColor: 'transparent' },
      '&:hover fieldset': { borderColor: 'transparent' },
      '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
      transition: 'all 0.2s',
      '&:hover': { boxShadow: '0 6px 24px rgba(0,0,0,0.08)' },
    };
  };

  const hasRecentSearches = !query && recentSearches.length > 0;
  const hasAnyResults =
    (results?.products?.data?.length || 0) > 0 ||
    (results?.brands?.length || 0) > 0 ||
    (results?.categories?.length || 0) > 0;
  const showCollapsedIcon = variant === 'header' && collapseToIcon && !isExpanded && !query;
  const showFloatingMobileSearch = variant === 'header' && collapseToIcon && isExpanded;
  const mergedContainerSx = {
    position: 'relative',
    transition: 'max-width 0.3s ease',
    ...sx,
    width: showCollapsedIcon
      ? 'auto'
      : (sx?.width ?? (fullWidth ? '100%' : 'auto')),
    maxWidth: showCollapsedIcon
      ? 'none'
      : (sx?.maxWidth ?? (variant === 'header' ? (isExpanded ? 500 : 200) : 'none')),
    ...(showFloatingMobileSearch
      ? {
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          width: sx?.width ?? { xs: 'min(200px, calc(100vw - 120px))', sm: 180 },
          maxWidth: 'calc(100vw - 120px)',
        }
      : {}),
  };

  return (
    <ClickAwayListener onClickAway={() => {
      closeDropdown();
      if (variant === 'header' && !query) setIsExpanded(false);
    }}>
      <Box sx={mergedContainerSx}>
        {showCollapsedIcon ? (
          <IconButton
            color="inherit"
            aria-label="Open search"
            onClick={() => setIsExpanded(true)}
            sx={{
              color: 'inherit',
              bgcolor: alpha(theme.palette.common.white, 0.15),
              borderRadius: 2,
              '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.22) },
            }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
        ) : (
          <TextField
            inputRef={inputRef}
            size="small"
            fullWidth
            placeholder={placeholder}
            value={query || ''}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsExpanded(true);
              if (query.length < MIN_QUERY_LENGTH && recentSearches.length > 0) {
                setOpen(true);
              } else if (results && debouncedQuery.length >= MIN_QUERY_LENGTH) {
                setOpen(true);
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {loading ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <SearchIcon 
                      color={variant === 'header' ? 'inherit' : 'action'} 
                      fontSize="small" 
                      sx={{ opacity: variant === 'header' ? 0.8 : 1 }}
                    />
                  )}
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  {query && (
                    <IconButton size="small" onClick={handleClear} sx={{ color: 'inherit', p: 0.5, mr: 0.5 }}>
                      <CloseIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                    </IconButton>
                  )}
                  {query && variant !== 'header' && results?.products?.totalItems !== undefined && (
                    <Chip
                      label={results.products.totalItems}
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                    />
                  )}
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': getStyles(),
              '& .MuiInputBase-input': {
                py: variant === 'header' ? 1 : 1.2,
                fontSize: '0.9rem',
              }
            }}
          />
        )}

        {showSuggestions && (
          <Popper
            open={open && (hasAnyResults || hasRecentSearches)}
            anchorEl={inputRef.current}
            placement="bottom-start"
            style={{
              zIndex: 1400,
              width: popperWidth,
            }}
            modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
          >
            <Paper
              elevation={0}
              sx={{
                mt: 1,
                borderRadius: 2,
                overflow: 'hidden',
                maxHeight: 460,
                overflowY: 'auto',
                bgcolor: 'background.paper',
                border: `1px solid ${alpha(theme.palette.common.black, 0.08)}`,
                boxShadow: '0 14px 40px rgba(15, 23, 42, 0.18)',
              }}
            >
              {/* Results List */}
              <ResultsList 
                query={query}
                results={results} 
                recentSearches={recentSearches}
                selectedIndex={selectedIndex} 
                setSelectedIndex={setSelectedIndex}
                handleItemClick={handleItemClick}
                removeRecentSearch={removeRecentSearch}
                clearAllRecent={clearAllRecent}
                handleSeeAll={() => executeSearch(query)}
              />
            </Paper>
          </Popper>
        )}

        {/* No Results Popper */}
        {showSuggestions && open && !loading && debouncedQuery.length >= MIN_QUERY_LENGTH && !hasAnyResults && (
        <Popper
           open={true}
           anchorEl={inputRef.current}
           placement="bottom-start"
           style={{
             zIndex: 1400,
             width: popperWidth,
           }}
           modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
         >
           <Paper elevation={0} sx={{ mt: 1, borderRadius: 2, p: 3, textAlign: 'center', border: `1px solid ${alpha(theme.palette.common.black, 0.08)}`, boxShadow: '0 14px 40px rgba(15, 23, 42, 0.18)' }}>
             <SearchOffIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1.5 }} />
             <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
               No matching results for <strong>"{debouncedQuery}"</strong>
             </Typography>
             {suggestion && (
               <Chip
                 label={`Did you mean "${suggestion}"?`}
                 clickable
                 color="primary"
                 variant="outlined"
                 size="small"
                 onClick={() => { setQuery(suggestion); inputRef.current?.focus(); }}
                 sx={{ fontWeight: 600 }}
               />
             )}
           </Paper>
         </Popper>
        )}
      </Box>
    </ClickAwayListener>
  );
};

const ResultsList = ({ 
  query, 
  results, 
  recentSearches, 
  selectedIndex, 
  setSelectedIndex, 
  handleItemClick, 
  removeRecentSearch, 
  clearAllRecent, 
  handleSeeAll 
}) => {
  const theme = useTheme();
  let itemCounter = 0;

  // If no query and has recent searches, show them
  if (!query && recentSearches.length > 0) {
    return (
      <Box sx={{ py: 0.75 }}>
        <SectionHeader 
          title="Recent Searches" 
          onAction={clearAllRecent}
          actionLabel="Clear All"
        />
        <List dense disablePadding>
          {recentSearches.map((term) => {
            const currentIdx = itemCounter++;
            return (
              <ListItemButton
                key={term}
                selected={selectedIndex === currentIdx}
                onClick={() => handleItemClick({ type: 'recent', label: term })}
                onMouseEnter={() => setSelectedIndex(currentIdx)}
                sx={{
                  mx: 0.75,
                  my: 0.25,
                  py: 1,
                  px: 1.25,
                  borderRadius: 1.5,
                  '&.Mui-selected, &:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                }}
              >
                <ListItemAvatar sx={{ minWidth: 44 }}>
                  <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                    <HistoryIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={term}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                />
                <IconButton 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); removeRecentSearch(term); }}
                  sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    );
  }

  return (
    <>
      {/* Products Section */}
      {results?.products?.data?.length > 0 && (
        <Box sx={{ py: 0.75 }}>
          <SectionHeader title="Products" count={results.products.totalItems} />
          <List dense disablePadding>
            {results.products.data.map((product) => {
              const currentIdx = itemCounter++;
              const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
              return (
                <ListItemButton
                  key={product.id}
                  selected={selectedIndex === currentIdx}
                  onClick={() => handleItemClick({ type: 'product', to: `/products/${product.slug}`, label: product.name })}
                  onMouseEnter={() => setSelectedIndex(currentIdx)}
                  sx={{
                    mx: 0.75,
                    my: 0.25,
                    py: 1.1,
                    px: 1.25,
                    borderRadius: 1.5,
                    transition: 'background-color 0.15s, transform 0.15s',
                    '&.Mui-selected, &:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 58 }}>
                    <Avatar
                      variant="rounded"
                      src={primaryImage?.url}
                      sx={{ width: 46, height: 46, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 1.25 }}
                    >
                      <SearchIcon fontSize="small" color="disabled" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={product.name}
                    secondary={`₹${product.effectivePrice ?? product.price}`}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 800, noWrap: true, color: 'text.primary' }}
                    secondaryTypographyProps={{ variant: 'caption', fontWeight: 800, color: 'primary.main' }}
                  />
                  <ArrowForwardIcon sx={{ fontSize: 17, color: 'text.disabled', ml: 1 }} />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      )}

      {/* Brands Section */}
      {results?.brands?.length > 0 && (
        <Box sx={{ mb: 1 }}>
          {itemCounter > 0 && <Divider sx={{ my: 1 }} />}
          <SectionHeader title="Brands" />
          <List dense disablePadding>
            {results.brands.map((brand) => {
              const currentIdx = itemCounter++;
              return (
                <ListItemButton
                  key={brand.id}
                  selected={selectedIndex === currentIdx}
                  onClick={() => handleItemClick({ type: 'brand', to: `/products?brand=${brand.slug}`, label: brand.name })}
                  onMouseEnter={() => setSelectedIndex(currentIdx)}
                sx={{
                  mx: 0.75,
                  my: 0.25,
                  py: 1,
                  px: 1.25,
                  borderRadius: 1.5,
                  '&.Mui-selected, &:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                }}
              >
                  <ListItemAvatar sx={{ minWidth: 52 }}>
                    <Avatar
                      variant="rounded"
                      src={brand.image}
                      sx={{ width: 40, height: 40, bgcolor: 'background.default', borderRadius: 1.5 }}
                    >
                      {brand.name.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={brand.name}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      )}

      {/* Categories Section */}
      {results?.categories?.length > 0 && (
        <Box sx={{ mb: 1 }}>
          {itemCounter > 0 && <Divider sx={{ my: 1 }} />}
          <SectionHeader title="Categories" />
          <List dense disablePadding>
            {results.categories.map((cat) => {
              const currentIdx = itemCounter++;
              return (
                <ListItemButton
                  key={cat.id}
                  selected={selectedIndex === currentIdx}
                  onClick={() => handleItemClick({ type: 'category', to: `/products?category=${cat.slug}`, label: cat.name })}
                  onMouseEnter={() => setSelectedIndex(currentIdx)}
                sx={{
                  mx: 0.75,
                  my: 0.25,
                  py: 1,
                  px: 1.25,
                  borderRadius: 1.5,
                  '&.Mui-selected, &:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                }}
              >
                  <ListItemAvatar sx={{ minWidth: 52 }}>
                    <Avatar
                      variant="rounded"
                      src={cat.image}
                      sx={{ width: 40, height: 40, bgcolor: 'background.default', borderRadius: 1.5 }}
                    >
                      {cat.name.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={cat.name}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      )}

      {/* Footer */}
      {results?.products?.totalItems > PRODUCT_LIMIT && (
        <>
          <Divider />
          <ListItemButton 
            onClick={handleSeeAll} 
            sx={{ py: 1.5, justifyContent: 'center', bgcolor: alpha(theme.palette.primary.main, 0.02) }}
          >
            <Typography variant="button" color="primary" sx={{ fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 1 }}>
              View all {results.products.totalItems} results
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Typography>
          </ListItemButton>
        </>
      )}
    </>
  );
};

const SectionHeader = ({ title, count, onAction, actionLabel }) => (
  <Box sx={{ px: 2, pt: 1.25, pb: 0.75, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.68rem' }}>
      {title} {count !== undefined && `(${count})`}
    </Typography>
    {onAction && (
      <Button 
        size="small" 
        onClick={onAction} 
        sx={{ 
          minWidth: 0, 
          fontSize: '0.65rem', 
          fontWeight: 700, 
          textTransform: 'none',
          p: '2px 8px',
          color: 'text.secondary',
          '&:hover': { color: 'primary.main', bgcolor: 'transparent' }
        }}
      >
        {actionLabel}
      </Button>
    )}
  </Box>
);

const buildItemList = (results, recentSearches = []) => {
  const items = [];
  if (recentSearches.length > 0) {
    recentSearches.forEach(term => items.push({ type: 'recent', label: term }));
    return items;
  }
  if (!results) return [];
  (results.products?.data || []).forEach((p) => items.push({ to: `/products/${p.slug}`, type: 'product', label: p.name }));
  (results.brands || []).forEach((b) => items.push({ to: `/products?brand=${b.slug}`, type: 'brand', label: b.name }));
  (results.categories || []).forEach((c) => items.push({ to: `/products?category=${c.slug}`, type: 'category', label: c.name }));
  return items;
};

export default SearchWidget;
