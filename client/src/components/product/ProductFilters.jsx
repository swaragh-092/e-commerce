import React, { useState, useEffect } from 'react';
import { Box, Typography, Slider, FormControl, Select, MenuItem, InputLabel, Button, Collapse, List, ListItem, ListItemText } from '@mui/material';
import { getCategoryTree } from '../../services/categoryService';

const ProductFilters = ({ filters, onFilterChange }) => {
    const [categories, setCategories] = useState([]);
    
    useEffect(() => {
        getCategoryTree().then(res => {
            if (res?.data?.categories) setCategories(res.data.categories);
        }).catch(console.error);
    }, []);

    const handlePriceChange = (e, newValue) => {
        onFilterChange({ ...filters, minPrice: newValue[0], maxPrice: newValue[1], page: 1 });
    };

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
                    value={[parseInt(filters.minPrice) || 0, parseInt(filters.maxPrice) || 1000]}
                    onChange={(e, val) => onFilterChange({ ...filters, minPrice: val[0], maxPrice: val[1], page: 1 })}
                    onChangeCommitted={handlePriceChange}
                    valueLabelDisplay="auto"
                    min={0}
                    max={2000}
                />
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
