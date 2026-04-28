import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Chip,
    Button,
    Alert,
    TextField,
    InputAdornment,
    useTheme,
    useMediaQuery,
    IconButton,
    Drawer,
    Badge,
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterListIcon,
    Close as CloseIcon,
    ShoppingBag as BagIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageSEO from '../../../components/common/PageSEO';
import { userService } from '../../../services/userService';
import { useCurrency } from '../../../hooks/useSettings';
import { getApiErrorMessage } from '../../../utils/apiErrors';

import { ORDER_STATUSES, TIME_FILTERS, LIMIT } from './constants';
import {useDebounce} from '../../../hooks/useDebounce';
import OrderSkeleton from '../../../components/orders/OrderSkeleton';
import OrderRow from '../../../components/orders/OrderRow';
import FilterPanel from '../../../components/orders/FilterPanel';

// ─── Main Page ────────────────────────────────────────────────────────────────

const AllOrdersPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { formatPrice } = useCurrency();

    // Filter state
    const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
    const debouncedSearch = useDebounce(searchInput, 400);
    const [selectedStatuses, setSelectedStatuses] = useState(
        (searchParams.get('status') || '').split(',').filter(Boolean)
    );
    const [selectedTimeFilter, setSelectedTimeFilter] = useState(searchParams.get('time') || '');
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

    // Data state
    const [orders, setOrders] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [alert, setAlert] = useState(null);

    const sentinelRef = useRef(null);
    const observerRef = useRef(null);

    // Date range helper — stable, no deps
    const getDateRange = useCallback((timeFilter) => {
        if (!timeFilter) return {};
        const now = new Date();
        if (timeFilter === '30')
            return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        if (timeFilter === '2024')
            return { from: new Date('2024-01-01'), to: new Date('2025-01-01') };
        if (timeFilter === '2023')
            return { from: new Date('2023-01-01'), to: new Date('2024-01-01') };
        if (timeFilter === 'older')
            return { olderThan: new Date('2023-01-01') };
        return {};
    }, []);

    const fetchOrders = useCallback(async (pageNum, reset = false) => {
        if (reset) {
            setInitialLoading(true);
            setOrders([]);
            setHasMore(true);
        } else {
            setLoadingMore(true);
        }
        setAlert(null);

        try {
            const params = {
                page: pageNum,
                limit: LIMIT,
                ...(debouncedSearch && { search: debouncedSearch }),
                ...(selectedStatuses.length > 0 && { status: selectedStatuses.join(',') }),
            };

            const res = await userService.getMyOrders(params);
            let fetched = res.data || [];

            // Client-side date filter (time filter applied locally)
            const { from, to, olderThan } = getDateRange(selectedTimeFilter);
            if (from) {
                fetched = fetched.filter((o) => {
                    const d = new Date(o.createdAt);
                    return to ? d >= from && d < to : d >= from;
                });
            } else if (olderThan) {
                fetched = fetched.filter((o) => new Date(o.createdAt) < olderThan);
            }

            setOrders((prev) => (reset ? fetched : [...prev, ...fetched]));
            setTotalCount(res.meta?.total || 0);

            const totalPages = res.meta?.totalPages || 1;
            setHasMore(pageNum < totalPages && fetched.length === LIMIT);
        } catch (err) {
            setAlert({ type: 'error', message: getApiErrorMessage(err, 'Failed to load orders.') });
        } finally {
            setInitialLoading(false);
            setLoadingMore(false);
        }
    }, [debouncedSearch, selectedStatuses, selectedTimeFilter, getDateRange]);

    // Reset on filter change
    useEffect(() => {
        setPage(1);
        fetchOrders(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, selectedStatuses.join(','), selectedTimeFilter]);

    // Infinite scroll sentinel
    useEffect(() => {
        observerRef.current?.disconnect();
        observerRef.current = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && hasMore && !loadingMore && !initialLoading) {
                    const next = page + 1;
                    setPage(next);
                    fetchOrders(next, false);
                }
            },
            { rootMargin: '300px' }
        );
        if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
        return () => observerRef.current?.disconnect();
    }, [hasMore, loadingMore, initialLoading, page, fetchOrders]);

    // Sync URL params
    useEffect(() => {
        const p = {};
        if (debouncedSearch) p.search = debouncedSearch;
        if (selectedStatuses.length) p.status = selectedStatuses.join(',');
        if (selectedTimeFilter) p.time = selectedTimeFilter;
        setSearchParams(p, { replace: true });
    }, [debouncedSearch, selectedStatuses, selectedTimeFilter]);

    // Handlers
    const handleStatusToggle = (status) =>
        setSelectedStatuses((prev) =>
            prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
        );

    const handleTimeFilterChange = (time) =>
        setSelectedTimeFilter((prev) => (prev === time ? '' : time));

    const handleClearFilters = () => {
        setSelectedStatuses([]);
        setSelectedTimeFilter('');
        setSearchInput('');
    };

    const activeFilterCount = selectedStatuses.length + (selectedTimeFilter ? 1 : 0);

    const filterProps = {
        selectedStatuses,
        onStatusToggle: handleStatusToggle,
        selectedTimeFilter,
        onTimeFilterChange: handleTimeFilterChange,
        onClear: handleClearFilters,
    };

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
            <PageSEO title="My Orders" type="noindex" />

            {/* Page header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    mb: 4,
                    pb: 3,
                    borderBottom: '2px solid',
                    borderColor: 'text.primary',
                }}
            >
                <Box>
                    <Typography
                        sx={{
                            fontSize: { xs: 26, md: 32 },
                            fontWeight: 800,
                            letterSpacing: -0.5,
                            lineHeight: 1,
                            mb: 0.75,
                        }}
                    >
                        My Orders
                    </Typography>
                    {!initialLoading && (
                        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                            {orders.length > 0
                                ? `Showing ${orders.length}${totalCount > orders.length ? ` of ${totalCount}` : ''} order${orders.length !== 1 ? 's' : ''}`
                                : 'No orders found'}
                        </Typography>
                    )}
                </Box>
                {isMobile && (
                    <IconButton
                        onClick={() => setMobileFiltersOpen(true)}
                        sx={{
                            border: '1.5px solid',
                            borderColor: 'text.primary',
                            borderRadius: '4px',
                            p: 0.75,
                        }}
                    >
                        <Badge badgeContent={activeFilterCount} color="primary">
                            <FilterListIcon sx={{ fontSize: 20 }} />
                        </Badge>
                    </IconButton>
                )}
            </Box>

            {alert && (
                <Alert
                    severity={alert.type}
                    onClose={() => setAlert(null)}
                    sx={{ mb: 3, borderRadius: '4px', fontSize: 13 }}
                >
                    {alert.message}
                </Alert>
            )}

            <Box sx={{ display: 'flex', gap: { xs: 0, md: 4 }, alignItems: 'flex-start' }}>

                {/* Desktop sidebar */}
                {!isMobile && (
                    <Box sx={{ width: 200, flexShrink: 0, position: 'sticky', top: 80 }}>
                        <FilterPanel {...filterProps} />
                    </Box>
                )}

                {/* Mobile drawer */}
                <Drawer
                    anchor="left"
                    open={mobileFiltersOpen}
                    onClose={() => setMobileFiltersOpen(false)}
                    PaperProps={{ sx: { width: 280, p: 3 } }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                        <IconButton size="small" onClick={() => setMobileFiltersOpen(false)}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <FilterPanel {...filterProps} />
                    <Button
                        variant="contained"
                        fullWidth
                        sx={{ mt: 4, borderRadius: '4px', textTransform: 'none', fontWeight: 700 }}
                        onClick={() => setMobileFiltersOpen(false)}
                    >
                        Apply Filters
                    </Button>
                </Drawer>

                {/* Main content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>

                    {/* Search */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            border: '1.5px solid',
                            borderColor: 'divider',
                            borderRadius: '6px',
                            px: 1.5,
                            mb: 2,
                            transition: 'border-color 0.15s',
                            '&:focus-within': { borderColor: 'text.primary' },
                        }}
                    >
                        <SearchIcon sx={{ color: 'text.disabled', fontSize: 18, mr: 1, flexShrink: 0 }} />
                        <TextField
                            placeholder="Search by product name, order ID, status…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            fullWidth
                            size="small"
                            variant="standard"
                            InputProps={{
                                disableUnderline: true,
                                sx: { fontSize: 13, py: 0.5 },
                                endAdornment: searchInput ? (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => setSearchInput('')}
                                            sx={{ p: 0.5 }}
                                        >
                                            <CloseIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            }}
                        />
                    </Box>

                    {/* Active filter chips */}
                    {activeFilterCount > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                            {selectedStatuses.map((s) => (
                                <Chip
                                    key={s}
                                    label={ORDER_STATUSES.find((o) => o.value === s)?.label || s}
                                    size="small"
                                    onDelete={() => handleStatusToggle(s)}
                                    sx={{
                                        height: 24,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        borderRadius: '4px',
                                        bgcolor: 'text.primary',
                                        color: 'background.paper',
                                        '& .MuiChip-deleteIcon': { color: 'background.paper', fontSize: 14 },
                                    }}
                                />
                            ))}
                            {selectedTimeFilter && (
                                <Chip
                                    label={TIME_FILTERS.find((t) => t.value === selectedTimeFilter)?.label}
                                    size="small"
                                    onDelete={() => setSelectedTimeFilter('')}
                                    sx={{
                                        height: 24,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        borderRadius: '4px',
                                        bgcolor: 'text.primary',
                                        color: 'background.paper',
                                        '& .MuiChip-deleteIcon': { color: 'background.paper', fontSize: 14 },
                                    }}
                                />
                            )}
                        </Box>
                    )}

                    {/* Orders table */}
                    <Paper
                        elevation={0}
                        sx={{
                            border: '1.5px solid',
                            borderColor: 'divider',
                            borderRadius: '6px',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Table header */}
                        <Box
                            sx={{
                                display: { xs: 'none', md: 'grid' },
                                gridTemplateColumns: '2fr 1fr 1fr 1fr 100px',
                                px: 3,
                                py: 1.25,
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'action.hover',
                            }}
                        >
                            {['Products', 'Order', 'Date', 'Total', ''].map((h) => (
                                <Typography
                                    key={h}
                                    sx={{
                                        fontSize: 10,
                                        fontWeight: 800,
                                        letterSpacing: 1,
                                        textTransform: 'uppercase',
                                        color: 'text.disabled',
                                    }}
                                >
                                    {h}
                                </Typography>
                            ))}
                        </Box>

                        {/* Skeletons */}
                        {initialLoading &&
                            [...Array(5)].map((_, i) => <OrderSkeleton key={i} />)}

                        {/* Empty state */}
                        {!initialLoading && orders.length === 0 && (
                            <Box sx={{ py: 8, textAlign: 'center', px: 3 }}>
                                <BagIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 2 }} />
                                <Typography
                                    sx={{ fontWeight: 700, fontSize: 16, mb: 1 }}
                                >
                                    No orders found
                                </Typography>
                                <Typography
                                    sx={{ fontSize: 13, color: 'text.secondary', mb: 3 }}
                                >
                                    {activeFilterCount > 0 || searchInput
                                        ? 'Try adjusting your search or filters.'
                                        : "You haven't placed any orders yet."}
                                </Typography>
                                {activeFilterCount > 0 || searchInput ? (
                                    <Button
                                        variant="outlined"
                                        onClick={handleClearFilters}
                                        sx={{
                                            borderRadius: '4px',
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            fontSize: 13,
                                        }}
                                    >
                                        Clear Filters
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        onClick={() => navigate('/products')}
                                        sx={{
                                            borderRadius: '4px',
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            fontSize: 13,
                                        }}
                                    >
                                        Start Shopping
                                    </Button>
                                )}
                            </Box>
                        )}

                        {/* Order rows */}
                        {!initialLoading &&
                            orders.map((order) => (
                                <OrderRow
                                    key={order.id}
                                    order={order}
                                    onView={(id) => navigate(`/account/orders/${id}`)}
                                    formatPrice={formatPrice}
                                />
                            ))}

                        {/* Load more skeletons */}
                        {loadingMore &&
                            [...Array(3)].map((_, i) => <OrderSkeleton key={`more-${i}`} />)}
                    </Paper>

                    {/* End of list */}
                    {!hasMore && orders.length > LIMIT && (
                        <Typography
                            sx={{
                                fontSize: 11,
                                color: 'text.disabled',
                                textAlign: 'center',
                                py: 4,
                                letterSpacing: 0.5,
                                textTransform: 'uppercase',
                            }}
                        >
                            All orders loaded
                        </Typography>
                    )}

                    {/* IntersectionObserver sentinel */}
                    <Box ref={sentinelRef} sx={{ height: 1 }} />
                </Box>
            </Box>
        </Container>
    );
};

export default AllOrdersPage;
