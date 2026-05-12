import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Typography,
    Button,
    TextField,
    Avatar,
    IconButton,
    Chip,
    CircularProgress,
    Divider,
    Paper,
    Autocomplete,
    Tooltip,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    Inventory as InventoryIcon,
    KeyboardArrowUp as UpIcon,
    KeyboardArrowDown as DownIcon,
    AutoFixHigh as SyncPriceIcon,
} from '@mui/icons-material';
import { getMediaUrl } from '../../utils/media';
import productComboService from '../../services/productComboService';
import { getProducts } from '../../services/productService';
import { useNotification } from '../../context/NotificationContext';
import { useCurrency } from '../../hooks/useSettings';

// ─── Empty State ─────────────────────────────────────────────────────────────
const EmptyState = ({ onAdd }) => (
    <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
        <InventoryIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
        <Typography variant="body1" gutterBottom>No items in this combo yet.</Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
            Add products below to define what this bundle contains.
        </Typography>
        {onAdd && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={onAdd}>
                Add First Item
            </Button>
        )}
    </Box>
);

// ─── Single Combo Item Row ────────────────────────────────────────────────────
const ComboItemRow = ({ item, index, total, onChange, onRemove, onMoveUp, onMoveDown, variants }) => {
    const { symbol } = useCurrency();

    return (
        <Paper variant="outlined" sx={{ p: 2, mb: 1.5, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            {/* Thumbnail */}
            <Avatar
                src={getMediaUrl(item.images?.[0]?.url || item.snapshotImage)}
                variant="rounded"
                sx={{ width: 48, height: 48, flexShrink: 0, mt: 0.5 }}
            >
                <InventoryIcon />
            </Avatar>

            {/* Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap fontWeight={600}>
                    {item.name}
                </Typography>
                {item.sku && (
                    <Typography variant="caption" color="text.secondary">SKU: {item.sku}</Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="primary.main">
                        {symbol}{Number(item.unitPrice || item.price || 0).toFixed(2)}
                    </Typography>
                    {/* Variant selector */}
                    {variants?.length > 0 && (
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel>Variant</InputLabel>
                            <Select
                                value={item.variantId || ''}
                                label="Variant"
                                onChange={(e) => onChange({ variantId: e.target.value || null })}
                            >
                                <MenuItem value=""><em>Any variant</em></MenuItem>
                                {variants.map((v) => (
                                    <MenuItem key={v.id} value={v.id}>
                                        {v.sku || v.id.slice(0, 8)}
                                        {v.price ? ` — ${symbol}${Number(v.price).toFixed(2)}` : ''}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                </Box>
            </Box>

            {/* Quantity */}
            <TextField
                type="number"
                label="Qty"
                size="small"
                value={item.quantity}
                onChange={(e) => {
                    const q = parseInt(e.target.value, 10);
                    if (!isNaN(q) && q >= 1) onChange({ quantity: q });
                }}
                inputProps={{ min: 1, style: { width: 60 } }}
                sx={{ width: 90, flexShrink: 0 }}
            />

            {/* Sort controls */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Tooltip title="Move up">
                    <span>
                        <IconButton size="small" onClick={onMoveUp} disabled={index === 0}>
                            <UpIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Move down">
                    <span>
                        <IconButton size="small" onClick={onMoveDown} disabled={index === total - 1}>
                            <DownIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            {/* Remove */}
            <Tooltip title="Remove from combo">
                <IconButton size="small" color="error" onClick={onRemove}>
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Paper>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProductComboBuilder = ({ productId, onSuggestedPrice, canEdit = true }) => {
    const { notify } = useNotification();
    const { symbol } = useCurrency();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [virtualStock, setVirtualStock] = useState(null);
    const [stockLoading, setStockLoading] = useState(false);

    // Product search
    const [searchInput, setSearchInput] = useState('');
    const [searchOptions, setSearchOptions] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchController = useRef(null);

    // ── Load existing combo items ─────────────────────────────────────────
    const loadItems = useCallback(async () => {
        try {
            setLoading(true);
            const res = await productComboService.getItems(productId);
            const raw = res?.data?.data || res?.data || [];
            setItems(raw.map((ci) => ({
                _key: ci.id,
                comboItemId: ci.id,
                itemProductId: ci.itemProductId,
                variantId: ci.variantId || null,
                quantity: ci.quantity,
                name: ci.item?.name || '',
                sku: ci.item?.sku || '',
                price: ci.item?.price || 0,
                unitPrice: ci.variant?.price ?? ci.item?.price ?? 0,
                images: ci.item?.images || [],
                variants: ci.item?.variants || [], // Populate variants if returned by API
            })));

            // If API didn't return variants, we could fetch them here, but typically the include handles it.
            // Assuming ITEM_INCLUDE on server handles include: [ProductVariant]
            
            setDirty(false);
        } catch (err) {
            const message =
                err?.response?.data?.error?.message ||
                err?.response?.data?.message ||
                'Failed to load combo items.';
            notify(message, 'error');
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => { loadItems(); }, [loadItems]);

    // ── Refresh virtual stock ─────────────────────────────────────────────
    const refreshStock = useCallback(async () => {
        try {
            setStockLoading(true);
            const res = await productComboService.getVirtualStock(productId);
            setVirtualStock(res?.data?.data?.stock ?? res?.data?.stock ?? 0);
        } catch {
            // Non-critical — silently ignore
        } finally {
            setStockLoading(false);
        }
    }, [productId]);

    useEffect(() => { refreshStock(); }, [refreshStock]);

    // ── Product search with abort control ────────────────────────────────
    useEffect(() => {
        if (searchController.current) {
            searchController.current.abort();
        }

        if (!searchInput.trim()) {
            setSearchOptions([]);
            return;
        }

        const controller = new AbortController();
        searchController.current = controller;

        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await getProducts({ search: searchInput.trim(), limit: 10 });
                if (!controller.signal.aborted) {
                    // Filter out combos and current product
                    const all = res?.data || [];
                    setSearchOptions(all.filter((p) => p.id !== productId && p.type !== 'combo'));
                }
            } catch {
                if (!controller.signal.aborted) setSearchOptions([]);
            } finally {
                if (!controller.signal.aborted) setSearchLoading(false);
            }
        }, 400);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [searchInput, productId]);

    // ── Add product from search ───────────────────────────────────────────
    const handleAddProduct = (product, selectedVariantId = null) => {
        if (!product) return;
        // Prevent duplicates (same product + same variant combo)
        const exists = items.some(
            (ci) => ci.itemProductId === product.id && ci.variantId === selectedVariantId
        );
        if (exists) {
            notify(`This ${selectedVariantId ? 'variant' : 'product'} is already in the combo. Increase its quantity instead.`, 'warning');
            return;
        }
        setItems((prev) => [
            ...prev,
            {
                _key: `new-${Date.now()}`,
                comboItemId: null,
                itemProductId: product.id,
                variantId: null,
                quantity: 1,
                name: product.name,
                sku: product.sku || '',
                price: product.price || 0,
                unitPrice: product.price || 0,
                images: product.images || [],
                variants: product.variants || [],
            },
        ]);
        setDirty(true);
        setSearchInput('');
        setSearchOptions([]);
    };

    // ── Mutations ─────────────────────────────────────────────────────────
    const updateItem = (index, patch) => {
        setItems((prev) => prev.map((ci, i) => (i === index ? { ...ci, ...patch } : ci)));
        setDirty(true);
    };

    const removeItem = (index) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
        setDirty(true);
    };

    const moveItem = (from, to) => {
        if (to < 0 || to >= items.length) return;
        setItems((prev) => {
            const next = [...prev];
            [next[from], next[to]] = [next[to], next[from]];
            return next;
        });
        setDirty(true);
    };

    // ── Save ──────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = items.map((ci) => ({
                itemProductId: ci.itemProductId,
                variantId:     ci.variantId || null,
                quantity:      ci.quantity,
            }));
            await productComboService.syncItems(productId, payload);
            notify('Combo items saved.', 'success');
            setDirty(false);
            await refreshStock();
        } catch (err) {
            notify(err?.response?.data?.message || 'Failed to save combo items.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Sync suggested price ──────────────────────────────────────────────
    const handleSyncPrice = async () => {
        try {
            const res = await productComboService.getSuggestedPrice(productId);
            const price = res?.data?.data?.suggestedPrice ?? res?.data?.suggestedPrice;
            if (price !== undefined && onSuggestedPrice) {
                onSuggestedPrice(price);
                notify(`Suggested price synced: ${symbol}${Number(price).toFixed(2)}`, 'success');
            }
        } catch {
            notify('Failed to calculate suggested price.', 'error');
        }
    };

    // ── Totals ────────────────────────────────────────────────────────────
    const constituentsTotal = items.reduce(
        (sum, ci) => sum + Number(ci.unitPrice || 0) * ci.quantity,
        0
    );

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box>
                    <Typography variant="h6" fontWeight={700}>Bundle Items</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Define which products are included in this combo.
                    </Typography>
                </Box>
                {canEdit && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {onSuggestedPrice && items.length > 0 && (
                            <Tooltip title="Calculate total of constituent prices and apply to this product">
                                <Button
                                    size="small"
                                    variant="text"
                                    startIcon={<SyncPriceIcon />}
                                    onClick={handleSyncPrice}
                                    disabled={saving}
                                >
                                    Sync Price
                                </Button>
                            </Tooltip>
                        )}
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                            onClick={handleSave}
                            disabled={saving || !dirty}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Stats bar */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Chip
                    icon={<InventoryIcon sx={{ fontSize: 14 }} />}
                    label={stockLoading
                        ? 'Checking stock…'
                        : virtualStock !== null
                            ? `Virtual Stock: ${virtualStock}`
                            : 'Stock unavailable'}
                    size="small"
                    color={virtualStock === 0 ? 'error' : virtualStock !== null && virtualStock < 5 ? 'warning' : 'default'}
                    variant="outlined"
                />
                {items.length > 0 && (
                    <Chip
                        label={`Constituents total: ${symbol}${constituentsTotal.toFixed(2)}`}
                        size="small"
                        variant="outlined"
                        color="primary"
                    />
                )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Loading */}
            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* Empty state */}
            {!loading && items.length === 0 && (
                <EmptyState onAdd={canEdit ? () => document.getElementById('combo-product-search')?.focus() : undefined} />
            )}

            {/* Item rows */}
            {!loading && items.length > 0 && (
                <Box sx={{ mb: 2 }}>
                    {items.map((item, index) => (
                        <ComboItemRow
                            key={item._key}
                            item={item}
                            index={index}
                            total={items.length}
                            variants={item.variants || []}
                            onChange={(patch) => updateItem(index, patch)}
                            onRemove={() => removeItem(index)}
                            onMoveUp={() => moveItem(index, index - 1)}
                            onMoveDown={() => moveItem(index, index + 1)}
                        />
                    ))}
                </Box>
            )}

            {/* Product search / add */}
            {canEdit && !loading && (
                <>
                    <Alert severity="info" sx={{ mb: 2 }} icon={false}>
                        <Typography variant="caption">
                            Stock is automatically decremented from each constituent when this bundle is ordered.
                            Combos cannot contain other combos.
                        </Typography>
                    </Alert>
                    <Autocomplete
                        id="combo-product-search"
                        fullWidth
                        options={searchOptions}
                        loading={searchLoading}
                        inputValue={searchInput}
                        onInputChange={(_, v) => setSearchInput(v)}
                        onChange={(_, product) => handleAddProduct(product)}
                        getOptionLabel={(o) => o.name || ''}
                        isOptionEqualToValue={(o, v) => o.id === v.id}
                        noOptionsText={searchInput.trim() ? 'No products found' : 'Type to search for a product'}
                        filterOptions={(x) => x} // server-side filtering
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Add product to combo"
                                placeholder="Search by name…"
                                size="small"
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {searchLoading ? <CircularProgress size={18} color="inherit" /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                        renderOption={(props, option) => (
                            <Box component="li" {...props} key={option.id} sx={{ gap: 1.5 }}>
                                <Avatar
                                    src={getMediaUrl(option.images?.[0]?.url)}
                                    variant="rounded"
                                    sx={{ width: 28, height: 28, flexShrink: 0 }}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight={600} noWrap>{option.name}</Typography>
                                    {option.sku && (
                                        <Typography variant="caption" color="text.secondary">SKU: {option.sku}</Typography>
                                    )}
                                </Box>
                                {option.price && (
                                    <Typography variant="caption" color="primary.main" sx={{ flexShrink: 0 }}>
                                        {symbol}{Number(option.price).toFixed(2)}
                                    </Typography>
                                )}
                            </Box>
                        )}
                    />
                </>
            )}
        </Box>
    );
};

export default ProductComboBuilder;
