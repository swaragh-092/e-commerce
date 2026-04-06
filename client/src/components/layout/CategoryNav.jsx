import React, { useState } from 'react';
import { Box, Button, Menu, MenuItem, Typography, CircularProgress, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../../context/CategoryContext';
import { useSettings } from '../../hooks/useSettings';

/**
 * Recursively flattens category children into MenuItem rows with visual indentation.
 * Used inside the top-nav dropdown so all levels are accessible in one panel.
 */
const renderMenuItems = (children, depth, maxDepth, navigate, closeMenu) => {
    if (!children?.length || depth > maxDepth) return null;
    return children.map(child => (
        <React.Fragment key={child.id}>
            <MenuItem
                onClick={() => { closeMenu(); navigate(`/products?category=${child.slug}`); }}
                sx={{ pl: 2 + (depth - 1) * 2 }}
            >
                <Typography variant="body2" fontWeight={depth === 1 ? 600 : 400}>
                    {child.name}
                </Typography>
            </MenuItem>
            {child.children?.length > 0 && depth < maxDepth && (
                renderMenuItems(child.children, depth + 1, maxDepth, navigate, closeMenu)
            )}
        </React.Fragment>
    ));
};

const CategoryNav = () => {
    const { categories, loading } = useCategories();
    const { settings } = useSettings();
    const categoryDepth = parseInt(settings?.catalog?.categoryDepth) || 3;
    const [anchorEls, setAnchorEls] = useState({});
    const navigate = useNavigate();

    const handleOpen = (event, id) => setAnchorEls(prev => ({ ...prev, [id]: event.currentTarget }));
    const handleClose = (id) => setAnchorEls(prev => ({ ...prev, [id]: null }));

    if (loading) return <Box sx={{ display: 'flex', gap: 2, p: 1 }}><CircularProgress size={20} /></Box>;
    if (!categories.length) return null;

    return (
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', p: 1, borderBottom: 1, borderColor: 'divider' }}>
            {categories.map((cat) => {
                const hasChildren = cat.children?.length > 0 && categoryDepth > 1;
                return (
                    <Box key={cat.id}>
                        <Button
                            color="inherit"
                            onClick={(e) => hasChildren ? handleOpen(e, cat.id) : navigate(`/products?category=${cat.slug}`)}
                        >
                            {cat.name}
                        </Button>
                        {hasChildren && (
                            <Menu
                                anchorEl={anchorEls[cat.id]}
                                open={Boolean(anchorEls[cat.id])}
                                onClose={() => handleClose(cat.id)}
                                MenuListProps={{ onMouseLeave: () => handleClose(cat.id) }}
                            >
                                <MenuItem onClick={() => { handleClose(cat.id); navigate(`/products?category=${cat.slug}`); }}>
                                    <Typography variant="body2" fontWeight="bold">All {cat.name}</Typography>
                                </MenuItem>
                                <Divider />
                                {renderMenuItems(cat.children, 1, categoryDepth - 1, navigate, () => handleClose(cat.id))}
                            </Menu>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};

export default CategoryNav;
