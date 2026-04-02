import React, { useState, useEffect } from 'react';
import { Box, Typography, Slider, FormControl, Select, MenuItem, InputLabel, Button, List, ListItem, ListItemText, Collapse } from '@mui/material';
import { getCategoryTree } from '../../services/categoryService';

const ProductFilters = ({ filters, onFilterChange }) => {
    const [categories, setCategories] = useState([]);
    // Local state for slider — only commits to URL on release (prevents per-pixel API calls)
    const [sliderValue, setSliderValue] = useState([
        parseInt(filters.minPrice) || 0,
        parseInt(filters.maxPrice) || 2000,
    ]);

    useEffect(() => {
        getCategoryTree().then(res => {
            if (res?.data?.categories) setCategories(res.data.categories);
        }).catch(console.error);
    }, []);

    // Sync slider when URL params change externally (e.g. clear all)
    useEffect(() => {
        setSliderValue([
            parseInt(filters.minPrice) || 0,
            parseInt(filters.maxPrice) || 2000,
        ]);
    }, [filters.minPrice, filters.maxPrice]);

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Categories</Typography>
            <List dense>
                <ListItem button onClick={() => onFilterChange({ ...filters, category: '', page: 1 })} selected={!filters.category}>
                    <ListItemText primary="All Products" />
                </ListItem>
                {categories.map(cat => (
                    <React.Fragment key={cat.id}>
                        <ListItem button onClick={() => onFilterChange({ ...filters, category: cat.slug, page: 1 })} selected={filters.category === cat.slug}>
                            <ListItemText primary={cat.name} />
                        </ListItem>
                        <Collapse in={true} timeout="auto" unmountOnExit>
                            <List component="div" disablePadding>
                                {cat.children?.map(sub => (
                                    <ListItem key={sub.id} button sx={{ pl: 4 }} onClick={() => onFilterChange({ ...filters, category: sub.slug, page: 1 })} selected={filters.category === sub.slug}>
                                        <ListItemText primary={sub.name} />
                                    </ListItem>
                                ))}
                            </List>
                        </Collapse>
                    </React.Fragment>
                ))}
            </List>

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
                    max={2000}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption">${sliderValue[0]}</Typography>
                    <Typography variant="caption">${sliderValue[1]}</Typography>
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

            <Button fullWidth variant="outlined" sx={{ mt: 3 }} onClick={() => onFilterChange({ search: '', category: '', minPrice: '', maxPrice: '', sort: 'newest', page: 1 })}>
                Clear All Filters
            </Button>
        </Box>
    );
};

export default ProductFilters;
