import React, { useState, useEffect } from 'react';
import { Box, Button, Menu, MenuItem, Typography, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getCategoryTree } from '../../services/categoryService';

const CategoryNav = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [anchorEls, setAnchorEls] = useState({});
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await getCategoryTree();
                if (res?.data?.categories) {
                    setCategories(res.data.categories);
                }
            } catch (err) {
                console.error("Failed to load categories:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, []);

    const handleOpen = (event, id) => {
        setAnchorEls({ ...anchorEls, [id]: event.currentTarget });
    };

    const handleClose = (id) => {
        setAnchorEls({ ...anchorEls, [id]: null });
    };

    if (loading) return <Box sx={{ display: 'flex', gap: 2, p: 1 }}><CircularProgress size={20} /></Box>;
    if (!categories.length) return null;

    return (
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', p: 1, borderBottom: 1, borderColor: 'divider' }}>
            {categories.map((cat) => (
                <Box key={cat.id}>
                    <Button 
                        color="inherit" 
                        onClick={(e) => cat.children?.length ? handleOpen(e, cat.id) : navigate(`/products?category=${cat.slug}`)}
                    >
                        {cat.name}
                    </Button>
                    {cat.children && cat.children.length > 0 && (
                        <Menu
                            anchorEl={anchorEls[cat.id]}
                            open={Boolean(anchorEls[cat.id])}
                            onClose={() => handleClose(cat.id)}
                            MenuListProps={{ onMouseLeave: () => handleClose(cat.id) }}
                        >
                            <MenuItem onClick={() => { handleClose(cat.id); navigate(`/products?category=${cat.slug}`); }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>All {cat.name}</Typography>
                            </MenuItem>
                            {cat.children.map(subCat => (
                                <MenuItem key={subCat.id} onClick={() => { handleClose(cat.id); navigate(`/products?category=${subCat.slug}`); }}>
                                    {subCat.name}
                                </MenuItem>
                            ))}
                        </Menu>
                    )}
                </Box>
            ))}
        </Box>
    );
};

export default CategoryNav;
