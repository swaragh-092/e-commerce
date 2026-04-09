import React, { useState, useEffect } from 'react';
import { Box, Typography, Slider, FormControl, Select, MenuItem, InputLabel, Button, List, ListItem, ListItemText } from '@mui/material';
import { useCategories } from '../../context/CategoryContext';
import { useCurrency, useSettings } from '../../hooks/useSettings';
import brandService from '../../services/brandService';

/**
 * Recursively renders a category and its children up to maxDepth.
 * depth starts at 1 (root). indent is the left-padding multiplier.
 */
const CategoryItem = ({ cat, depth, maxDepth, filters, onFilterChange }) => {
    const indent = depth * 2; // MUI spacing units per level
    const hasChildren = cat.children?.length > 0 && depth < maxDepth;

    return (
        <>
            <ListItem
                button
                sx={{ pl: indent }}
                onClick={() => onFilterChange({ ...filters, category: cat.slug, page: 1 })}
                selected={filters.category === cat.slug}
            >
                <ListItemText
                    primary={cat.name}
                    primaryTypographyProps={{ variant: depth === 1 ? 'body2' : 'caption', fontWeight: depth === 1 ? 600 : 400 }}
                />
            </ListItem>
            {hasChildren && (
                <List component="div" disablePadding>
                    {cat.children.map(child => (
                        <CategoryItem
                            key={child.id}
                            cat={child}
                            depth={depth + 1}
                            maxDepth={maxDepth}
                            filters={filters}
                            onFilterChange={onFilterChange}
                        />
                    ))}
                </List>
            )}
        </>
    );
};

const ProductFilters = ({ filters, onFilterChange }) => {
    const { categories } = useCategories();
    const { formatPrice } = useCurrency();
    const { settings } = useSettings();
    const priceRangeMax = parseInt(settings?.catalog?.priceRangeMax) || 2000;
    const categoryDepth = parseInt(settings?.catalog?.categoryDepth) || 3;

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

    // Local state for slider — only commits to URL on release (prevents per-pixel API calls)
    const [sliderValue, setSliderValue] = useState([
        parseInt(filters.minPrice) || 0,
        parseInt(filters.maxPrice) || priceRangeMax,
    ]);

    // Sync slider when URL params change externally (e.g. clear all)
    useEffect(() => {
        setSliderValue([
            parseInt(filters.minPrice) || 0,
            parseInt(filters.maxPrice) || priceRangeMax,
        ]);
    }, [filters.minPrice, filters.maxPrice, priceRangeMax]);

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Categories</Typography>
            <List dense>
                <ListItem button onClick={() => onFilterChange({ ...filters, category: '', page: 1 })} selected={!filters.category}>
                    <ListItemText primary="All Products" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} />
                </ListItem>
                {categories.map(cat => (
                    <CategoryItem
                        key={cat.id}
                        cat={cat}
                        depth={1}
                        maxDepth={categoryDepth}
                        filters={filters}
                        onFilterChange={onFilterChange}
                    />
                ))}
            </List>

            {brands.length > 0 && (
                <>
                    <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Brands</Typography>
                    <List dense>
                        <ListItem 
                            button 
                            onClick={() => onFilterChange({ ...filters, brand: '', page: 1 })} 
                            selected={!filters.brand}
                        >
                            <ListItemText primary="All Brands" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} />
                        </ListItem>
                        {brands.map(brand => (
                            <ListItem
                                key={brand.id}
                                button
                                onClick={() => onFilterChange({ ...filters, brand: brand.slug, page: 1 })}
                                selected={filters.brand === brand.slug}
                            >
                                <ListItemText 
                                    primary={brand.name} 
                                    primaryTypographyProps={{ variant: 'body2' }} 
                                />
                            </ListItem>
                        ))}
                    </List>
                </>
            )}

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Price Range</Typography>
            <Box sx={{ px: 2 }}>
                <Slider
                    value={sliderValue}
                    onChange={(_, val) => setSliderValue(val)}           /* local only — no API call */
                    onChangeCommitted={(_, val) =>                        /* fires API on release */
                        onFilterChange({ ...filters, minPrice: val[0], maxPrice: val[1], page: 1 })
                    }
                    valueLabelDisplay="auto" 
                    min={0}
                    max={priceRangeMax}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption">{formatPrice(sliderValue[0])}</Typography>
                    <Typography variant="caption">{formatPrice(sliderValue[1])}</Typography>
                </Box>
            </Box>

            <FormControl fullWidth sx={{ mt: 3 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                    value={filters.sort || 'newest'}
                    label="Sort By"
                    onChange={(e) => onFilterChange({ ...filters, sort: e.target.value, page: 1 })}
                >
                    <MenuItem value="newest">Newest Arrivals</MenuItem>
                    <MenuItem value="price_asc">Price: Low to High</MenuItem>
                    <MenuItem value="price_desc">Price: High to Low</MenuItem>
                    <MenuItem value="name_asc">Name: A to Z</MenuItem>
                </Select>
            </FormControl>

            <Button fullWidth variant="outlined" sx={{ mt: 3 }} onClick={() => onFilterChange({ search: '', category: '', brand: '', minPrice: '', maxPrice: '', sort: 'newest', page: 1 })}>
                Clear All Filters
            </Button>
        </Box>
    );
};

export default ProductFilters;
