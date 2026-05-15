import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Slider,
    Button,
    TextField,
    InputAdornment,
    Chip,
    Paper,
    Divider,
    Collapse,
    IconButton,
    Fade,
} from '@mui/material';
import {
    ExpandMore,
    ExpandLess,
    Check,
    Close,
    FilterList,
} from '@mui/icons-material';
import { useCategories } from '../../context/CategoryContext';
import { useCurrency, useSettings, useFeature } from '../../hooks/useSettings';
import brandService from '../../services/brandService';

const FilterSection = ({ title, children, defaultOpen = true, action }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Paper elevation={0} sx={{ mb: 2, bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            <Box
                sx={{
                    px: 2,
                    py: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => setOpen(!open)}
            >
                <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
                    {title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {action}
                    {open ? <ExpandLess fontSize="small" color="action" /> : <ExpandMore fontSize="small" color="action" />}
                </Box>
            </Box>
            <Collapse in={open}>
                <Box sx={{ px: 2, pb: 2 }}>{children}</Box>
            </Collapse>
        </Paper>
    );
};

const FilterChip = ({ label, selected, onClick, count }) => (
    <Chip
        label={count ? `${label} (${count})` : label}
        onClick={onClick}
        size="small"
        icon={selected ? <Check fontSize="small" /> : undefined}
        sx={{
            borderRadius: 1.5,
            fontWeight: selected ? 600 : 400,
            bgcolor: selected ? 'primary.main' : 'grey.50',
            color: selected ? 'primary.contrastText' : 'text.primary',
            border: '1px solid',
            borderColor: selected ? 'primary.main' : 'grey.200',
            '&:hover': {
                bgcolor: selected ? 'primary.dark' : 'grey.100',
            },
            transition: 'all 0.2s',
        }}
    />
);

const hasSelectedDescendant = (cat, selectedSlug) => {
    if (!selectedSlug || !cat.children) return false;
    return cat.children.some(child =>
        child.slug === selectedSlug || hasSelectedDescendant(child, selectedSlug)
    );
};

const CategoryTree = ({ cats, depth, maxDepth, filters, onFilterChange, parentSlug = '' }) => {
    if (!cats?.length) return null;
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {cats.map((cat) => {
                const isSelected = filters.category === cat.slug;
                const hasChildren = cat.children?.length > 0 && depth < maxDepth;
                return (
                    <Box key={cat.id}>
                        <Button
                            onClick={() => onFilterChange({ ...filters, category: cat.slug, page: 1 })}
                            sx={{
                                justifyContent: 'flex-start',
                                px: 1 + depth * 0.75,
                                py: 0.5,
                                minWidth: 0,
                                width: '100%',
                                textAlign: 'left',
                                borderRadius: 1,
                                fontSize: depth === 1 ? '0.875rem' : '0.8rem',
                                fontWeight: isSelected ? 700 : depth === 1 ? 500 : 400,
                                color: isSelected ? 'primary.main' : 'text.primary',
                                bgcolor: isSelected ? 'primary.50' : 'transparent',
                                '&:hover': { bgcolor: isSelected ? 'primary.100' : 'grey.50' },
                                textTransform: 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            {isSelected && <Check fontSize="small" sx={{ mr: 0.75, fontSize: '1rem' }} />}
                            {cat.name}
                        </Button>
                        {hasChildren && (
                            <Collapse in={isSelected || hasSelectedDescendant(cat, filters.category) || (!filters.category && depth < 2)}>
                                <CategoryTree
                                    cats={cat.children}
                                    depth={depth + 1}
                                    maxDepth={maxDepth}
                                    filters={filters}
                                    onFilterChange={onFilterChange}
                                />
                            </Collapse>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};

const ActiveFilterBadge = ({ label, onRemove }) => (
    <Chip
        label={label}
        size="small"
        onDelete={onRemove}
        deleteIcon={<Close fontSize="small" />}
        sx={{
            bgcolor: 'primary.50',
            color: 'primary.main',
            fontWeight: 600,
            borderRadius: 1,
            '& .MuiChip-deleteIcon': { color: 'primary.main', fontSize: '0.875rem' },
        }}
    />
);

const ProductFilters = ({ filters, onFilterChange, priceRange: externalPriceRange }) => {
    const { categories } = useCategories();
    const { formatPrice, symbol } = useCurrency();
    const { settings } = useSettings();
    const pricingEnabled = useFeature('pricing');
    const categoryDepth = parseInt(settings?.catalog?.categoryDepth) || 3;

    const priceRangeMin = externalPriceRange?.min ?? 0;
    const priceRangeMax = externalPriceRange?.max ?? 0;
    const hasProducts = priceRangeMax > 0;

    const [brands, setBrands] = useState([]);

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const res = await brandService.getBrands({ isActive: 'true', limit: 100 });
                setBrands(res?.data?.data || []);
            } catch (err) {
                console.error('Failed to fetch brands:', err);
            }
        };
        fetchBrands();
    }, []);

    const [sliderValue, setSliderValue] = useState([
        parseInt(filters.minPrice) || priceRangeMin,
        parseInt(filters.maxPrice) || priceRangeMax,
    ]);

    useEffect(() => {
        setSliderValue([
            parseInt(filters.minPrice) || priceRangeMin,
            parseInt(filters.maxPrice) || priceRangeMax,
        ]);
    }, [filters.minPrice, filters.maxPrice, priceRangeMin, priceRangeMax]);

    const activeFilters = [];
    if (filters.category) {
        const findCat = (cats) => {
            for (const c of cats || []) {
                if (c.slug === filters.category) return c;
                const found = findCat(c.children);
                if (found) return found;
            }
            return null;
        };
        const cat = findCat(categories);
        if (cat) activeFilters.push({ key: 'category', label: cat.name, remove: () => onFilterChange({ ...filters, category: '', page: 1 }) });
    }
    if (filters.brand) {
        const brand = brands.find(b => b.slug === filters.brand);
        if (brand) activeFilters.push({ key: 'brand', label: brand.name, remove: () => onFilterChange({ ...filters, brand: '', page: 1 }) });
    }
    if (filters.minPrice || filters.maxPrice) {
        const min = filters.minPrice || priceRangeMin;
        const max = filters.maxPrice || priceRangeMax;
        if (min != priceRangeMin || max != priceRangeMax) {
            activeFilters.push({
                key: 'price',
                label: `${symbol}${min} - ${symbol}${max}`,
                remove: () => onFilterChange({ ...filters, minPrice: '', maxPrice: '', page: 1 }),
            });
        }
    }

    const hasActiveFilters = activeFilters.length > 0;

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FilterList fontSize="small" color="primary" />
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>
                    Filters
                </Typography>
                {hasActiveFilters && (
                    <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary', fontWeight: 500 }}>
                        {activeFilters.length} active
                    </Typography>
                )}
            </Box>

            {/* Active Filters */}
            <Fade in={hasActiveFilters}>
                <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                        {activeFilters.map((f) => (
                            <ActiveFilterBadge key={f.key} label={f.label} onRemove={f.remove} />
                        ))}
                    </Box>
                    {hasActiveFilters && (
                        <Button
                            size="small"
                            onClick={() => onFilterChange({ search: '', category: '', brand: '', minPrice: '', maxPrice: '', sort: 'newest', page: 1 })}
                            sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 500, color: 'error.main', '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.04)' } }}
                        >
                            Clear all filters
                        </Button>
                    )}
                </Box>
            </Fade>

            {/* Categories */}
            <FilterSection
                title="Categories"
                defaultOpen={!filters.category}
                action={filters.category && (
                    <Button
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onFilterChange({ ...filters, category: '', page: 1 }); }}
                        sx={{ textTransform: 'none', fontSize: '0.7rem', minWidth: 0, p: 0.5, color: 'text.secondary' }}
                    >
                        Reset
                    </Button>
                )}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Button
                        onClick={() => onFilterChange({ ...filters, category: '', page: 1 })}
                        sx={{
                            justifyContent: 'flex-start',
                            px: 1,
                            py: 0.5,
                            minWidth: 0,
                            width: '100%',
                            textAlign: 'left',
                            borderRadius: 1,
                            fontSize: '0.875rem',
                            fontWeight: !filters.category ? 700 : 500,
                            color: !filters.category ? 'primary.main' : 'text.primary',
                            bgcolor: !filters.category ? 'primary.50' : 'transparent',
                            '&:hover': { bgcolor: !filters.category ? 'primary.100' : 'grey.50' },
                            textTransform: 'none',
                        }}
                    >
                        {!filters.category && <Check fontSize="small" sx={{ mr: 0.75, fontSize: '1rem' }} />}
                        All Products
                    </Button>
                    <CategoryTree
                        cats={categories}
                        depth={1}
                        maxDepth={categoryDepth}
                        filters={filters}
                        onFilterChange={onFilterChange}
                    />
                </Box>
            </FilterSection>

            {/* Brands */}
            {brands.length > 0 && (
                <FilterSection
                    title="Brands"
                    defaultOpen={!filters.brand}
                    action={filters.brand && (
                        <Button
                            size="small"
                            onClick={(e) => { e.stopPropagation(); onFilterChange({ ...filters, brand: '', page: 1 }); }}
                            sx={{ textTransform: 'none', fontSize: '0.7rem', minWidth: 0, p: 0.5, color: 'text.secondary' }}
                        >
                            Reset
                        </Button>
                    )}
                >
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        <FilterChip
                            label="All Brands"
                            selected={!filters.brand}
                            onClick={() => onFilterChange({ ...filters, brand: '', page: 1 })}
                        />
                        {brands.map((brand) => (
                            <FilterChip
                                key={brand.id}
                                label={brand.name}
                                selected={filters.brand === brand.slug}
                                onClick={() => onFilterChange({ ...filters, brand: brand.slug, page: 1 })}
                            />
                        ))}
                    </Box>
                </FilterSection>
            )}

            {/* Price Range */}
            {pricingEnabled && (
                <FilterSection
                    title="Price Range"
                    defaultOpen={!!(filters.minPrice || filters.maxPrice)}
                    action={(filters.minPrice || filters.maxPrice) && (
                        <Button
                            size="small"
                            onClick={(e) => { e.stopPropagation(); onFilterChange({ ...filters, minPrice: '', maxPrice: '', page: 1 }); }}
                            sx={{ textTransform: 'none', fontSize: '0.7rem', minWidth: 0, p: 0.5, color: 'text.secondary' }}
                        >
                            Reset
                        </Button>
                    )}
                >
                    <Box sx={{ px: 0.5 }}>
                        {hasProducts ? (
                            <>
                                <Slider
                                    value={sliderValue}
                                    onChange={(_, val) => setSliderValue(val)}
                                    onChangeCommitted={(_, val) =>
                                        onFilterChange({ ...filters, minPrice: val[0], maxPrice: val[1], page: 1 })
                                    }
                                    valueLabelDisplay="auto"
                                    valueLabelFormat={(v) => `${symbol}${v}`}
                                    min={priceRangeMin}
                                    max={priceRangeMax}
                                    sx={{
                                        color: 'primary.main',
                                        '& .MuiSlider-thumb': {
                                            backgroundColor: '#fff',
                                            border: '2px solid currentColor',
                                            width: { xs: 44, md: 16 },
                                            height: { xs: 44, md: 16 },
                                            '&:hover': { boxShadow: '0 0 0 6px rgba(25, 118, 210, 0.12)' },
                                        },
                                        '& .MuiSlider-rail': { opacity: 0.3, bgcolor: 'grey.300' },
                                        '& .MuiSlider-track': { height: 6, borderRadius: 3 },
                                    }}
                                />

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="caption" color="text.secondary">{symbol}{priceRangeMin}</Typography>
                                    <Typography variant="caption" color="text.secondary">{symbol}{priceRangeMax}</Typography>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
                                    <TextField
                                        size="small"
                                        placeholder="Min"
                                        type="number"
                                        value={sliderValue[0]}
                                        onChange={(e) => {
                                            const parsed = parseInt(e.target.value);
                                            const newMin = Math.min(Math.max(priceRangeMin, isNaN(parsed) ? priceRangeMin : parsed), sliderValue[1]);
                                            setSliderValue([newMin, sliderValue[1]]);
                                        }}
                                        onBlur={() => onFilterChange({ ...filters, minPrice: sliderValue[0], maxPrice: sliderValue[1], page: 1 })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') onFilterChange({ ...filters, minPrice: sliderValue[0], maxPrice: sliderValue[1], page: 1 });
                                        }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <Typography variant="caption" fontWeight={600} color="text.secondary">{symbol}</Typography>
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '0.875rem', px: 1, py: 0.75 },
                                            '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'grey.50' },
                                        }}
                                    />
                                    <Divider sx={{ width: 12, borderColor: 'text.disabled' }} />
                                    <TextField
                                        size="small"
                                        placeholder="Max"
                                        type="number"
                                        value={sliderValue[1]}
                                        onChange={(e) => {
                                            const parsed = parseInt(e.target.value);
                                            const newMax = Math.max(Math.min(priceRangeMax, isNaN(parsed) ? priceRangeMax : parsed), sliderValue[0]);
                                            setSliderValue([sliderValue[0], newMax]);
                                        }}
                                        onBlur={() => onFilterChange({ ...filters, minPrice: sliderValue[0], maxPrice: sliderValue[1], page: 1 })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') onFilterChange({ ...filters, minPrice: sliderValue[0], maxPrice: sliderValue[1], page: 1 });
                                        }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <Typography variant="caption" fontWeight={600} color="text.secondary">{symbol}</Typography>
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '0.875rem', px: 1, py: 0.75 },
                                            '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'grey.50' },
                                        }}
                                    />
                                </Box>

                                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Quick Select
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                    {(() => {
                                        const span = priceRangeMax - priceRangeMin;
                                        const third = Math.round(span / 3);
                                        const presets = [
                                            { label: `Under ${symbol}${priceRangeMin + third}`, min: priceRangeMin, max: priceRangeMin + third },
                                            { label: `${symbol}${priceRangeMin + third} - ${symbol}${priceRangeMin + third * 2}`, min: priceRangeMin + third, max: priceRangeMin + third * 2 },
                                            { label: `${symbol}${priceRangeMin + third * 2}+`, min: priceRangeMin + third * 2, max: priceRangeMax },
                                        ];
                                        return presets.map((preset) => {
                                            const isActive = filters.minPrice == preset.min && filters.maxPrice == preset.max;
                                            return (
                                                <FilterChip
                                                    key={preset.label}
                                                    label={preset.label}
                                                    selected={isActive}
                                                    onClick={() => onFilterChange({ ...filters, minPrice: preset.min, maxPrice: preset.max, page: 1 })}
                                                />
                                            );
                                        });
                                    })()}
                                </Box>
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
                                No products available
                            </Typography>
                        )}
                    </Box>
                </FilterSection>
            )}
        </Box>
    );
};

export default ProductFilters;
