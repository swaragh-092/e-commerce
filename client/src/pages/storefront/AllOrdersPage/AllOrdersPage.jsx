import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Chip,
    Button,
    Alert,
    Stack,
    TextField,
    InputAdornment,
    useTheme,
    useMediaQuery,
    Checkbox,
    FormControlLabel,
    Divider,
    Skeleton,
    IconButton,
    Drawer,
    Badge,
} from '@mui/material';
import {
    Search as SearchIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
    FilterList as FilterListIcon,
    Close as CloseIcon,
    LocalShipping as ShippingIcon,
    Cancel as CancelIcon,
    ShoppingBag as BagIcon,
    KeyboardArrowRight as ArrowIcon,
    HourglassEmpty as ProcessingIcon,
    Inventory2 as PlacedIcon,
    Done as ConfirmedIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageSEO from '../../../components/common/PageSEO';
import { userService } from '../../services/userService';
import { useCurrency } from '../../hooks/useSettings';
import { getOrderStatusColor, getOrderStatusLabel } from '../../utils/orderWorkflow';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useNotification } from '../../context/NotificationContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
    { value: 'placed',     label: 'Placed' },
    { value: 'confirmed',  label: 'Confirmed' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped',    label: 'On the way' },
    { value: 'delivered',  label: 'Delivered' },
    { value: 'cancelled',  label: 'Cancelled' },
];

const TIME_FILTERS = [
    { value: '30',    label: 'Last 30 days' },
    { value: '2024',  label: '2024' },
    { value: '2023',  label: '2023' },
    { value: 'older', label: 'Older' },
];

const LIMIT = 10;

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    placed:     { icon: PlacedIcon,     bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
    confirmed:  { icon: ConfirmedIcon,  bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
    processing: { icon: ProcessingIcon, bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    shipped:    { icon: ShippingIcon,   bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
    delivered:  { icon: CheckCircleIcon,bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
    cancelled:  { icon: CancelIcon,     bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

const useDebounce = (value, delay = 400) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a compact product summary from order items.
 * Handles both `items` (new backend alias) and `OrderItems` (legacy).
 */
const getProductSummary = (order, maxNames = 2) => {
    const items = order.items || order.OrderItems || [];
    if (!items.length) return { summary: 'No items', count: 0, qty: 0 };

    const names = items
        .map((i) => i.Product?.name || i.product?.name || null)
        .filter(Boolean);

    const totalQty = items.reduce((s, i) => s + (i.quantity || 1), 0);
    const shown = names.slice(0, maxNames);
    const extra = names.length - shown.length;

    return {
        summary: shown.join(', ') + (extra > 0 ? ` +${extra} more` : ''),
        count: items.length,
        qty: totalQty,
    };
};

const formatOrderDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
    });

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.placed;
    const Icon = cfg.icon;
    const label = getOrderStatusLabel(status);

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1.25,
                py: 0.4,
                borderRadius: '4px',
                border: `1px solid ${cfg.border}`,
                bgcolor: cfg.bg,
            }}
        >
            <Icon sx={{ fontSize: 11, color: cfg.color }} />
            <Typography
                sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    color: cfg.color,
                    textTransform: 'uppercase',
                    lineHeight: 1,
                }}
            >
                {label}
            </Typography>
        </Box>
    );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const OrderSkeleton = () => (
    <Box
        sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            py: 2.5,
            px: { xs: 2, md: 3 },
        }}
    >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Skeleton width={120} height={14} />
            <Skeleton width={80} height={22} sx={{ borderRadius: 1 }} />
        </Box>
        <Skeleton width="55%" height={18} sx={{ mb: 0.75 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={80} height={14} />
            <Skeleton width={90} height={30} sx={{ borderRadius: 1 }} />
        </Box>
    </Box>
);

// ─── Order Row ────────────────────────────────────────────────────────────────

const OrderRow = ({ order, onView, formatPrice }) => {
    const { summary, qty } = getProductSummary(order);

    const date = formatOrderDate(
        order.status === 'delivered' ? (order.deliveredAt || order.updatedAt) : order.createdAt
    );

    const paymentLabel = order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online';

    return (
        <Box
            onClick={() => onView(order.id)}
            sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                py: 2.5,
                px: { xs: 2, md: 3 },
                cursor: 'pointer',
                transition: 'background 0.12s',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.018)' },
                '&:last-child': { borderBottom: 'none' },
            }}
        >
            {/* Row 1 — meta bar */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                    flexWrap: 'wrap',
                    gap: 1,
                }}
            >
                <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography
                        sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.6,
                            textTransform: 'uppercase',
                            color: 'text.disabled',
                        }}
                    >
                        {date}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 11,
                            letterSpacing: 0.3,
                            color: 'text.disabled',
                            fontFamily: 'monospace',
                        }}
                    >
                        #{order.orderNumber || order.id?.slice(0, 8).toUpperCase()}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                        {paymentLabel}
                    </Typography>
                </Box>
                <StatusBadge status={order.status} />
            </Box>

            {/* Row 2 — products */}
            <Typography
                sx={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: { xs: '100%', sm: '70%', md: '75%' },
                }}
                title={summary}
            >
                {summary}
            </Typography>

            {/* Row 3 — price + qty + action */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1,
                }}
            >
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                        {formatPrice(order.total || 0)}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {qty} item{qty !== 1 ? 's' : ''}
                    </Typography>
                </Box>

                <Button
                    size="small"
                    variant="outlined"
                    endIcon={<ArrowIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={(e) => { e.stopPropagation(); onView(order.id); }}
                    sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: 0.3,
                        borderRadius: '4px',
                        borderColor: 'divider',
                        color: 'text.primary',
                        px: 1.5,
                        py: 0.5,
                        minWidth: 'auto',
                        textTransform: 'none',
                        '&:hover': {
                            borderColor: 'text.primary',
                            bgcolor: 'transparent',
                        },
                    }}
                >
                    View Details
                </Button>
            </Box>
        </Box>
    );
};

// ─── Filter Panel ─────────────────────────────────────────────────────────────

const FilterPanel = ({
    selectedStatuses,
    onStatusToggle,
    selectedTimeFilter,
    onTimeFilterChange,
    onClear,
}) => {
    const activeCount = selectedStatuses.length + (selectedTimeFilter ? 1 : 0);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Typography
                    sx={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 1.2,
                        textTransform: 'uppercase',
                        color: 'text.primary',
                    }}
                >
                    Filters
                </Typography>
                {activeCount > 0 && (
                    <Button
                        size="small"
                        onClick={onClear}
                        sx={{
                            fontSize: 11,
                            color: 'text.secondary',
                            textTransform: 'none',
                            p: 0,
                            minWidth: 'auto',
                            textDecoration: 'underline',
                            '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
                        }}
                    >
                        Clear ({activeCount})
                    </Button>
                )}
            </Box>

            <Typography
                sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: 'text.disabled',
                    mb: 1,
                    display: 'block',
                }}
            >
                Order Status
            </Typography>
            <Stack spacing={0} sx={{ mb: 3 }}>
                {ORDER_STATUSES.map((s) => (
                    <FormControlLabel
                        key={s.value}
                        control={
                            <Checkbox
                                checked={selectedStatuses.includes(s.value)}
                                onChange={() => onStatusToggle(s.value)}
                                size="small"
                                sx={{
                                    p: 0.75,
                                    color: 'text.disabled',
                                    '&.Mui-checked': { color: 'text.primary' },
                                }}
                            />
                        }
                        label={
                            <Typography sx={{ fontSize: 13, color: 'text.primary' }}>
                                {s.label}
                            </Typography>
                        }
                        sx={{ mx: 0, ml: -0.5 }}
                    />
                ))}
            </Stack>

            <Divider sx={{ mb: 2.5 }} />

            <Typography
                sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: 'text.disabled',
                    mb: 1,
                    display: 'block',
                }}
            >
                Order Time
            </Typography>
            <Stack spacing={0}>
                {TIME_FILTERS.map((t) => (
                    <FormControlLabel
                        key={t.value}
                        control={
                            <Checkbox
                                checked={selectedTimeFilter === t.value}
                                onChange={() => onTimeFilterChange(t.value)}
                                size="small"
                                sx={{
                                    p: 0.75,
                                    color: 'text.disabled',
                                    '&.Mui-checked': { color: 'text.primary' },
                                }}
                            />
                        }
                        label={
                            <Typography sx={{ fontSize: 13, color: 'text.primary' }}>
                                {t.label}
                            </Typography>
                        }
                        sx={{ mx: 0, ml: -0.5 }}
                    />
                ))}
            </Stack>
        </Box>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AllOrdersPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { formatPrice } = useCurrency();
    const ordersEnabled = useFeature('orders');

    useEffect(() => {
        if (!ordersEnabled) {
            navigate('/');
        }
    }, [ordersEnabled, navigate]);

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