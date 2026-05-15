import React, { useState, useRef, useEffect } from 'react';
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
    const scrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const check = () => {
            setCanScrollLeft(el.scrollLeft > 5);
            setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
        };
        check();
        el.addEventListener('scroll', check);
        window.addEventListener('resize', check);
        return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
    }, [categories.length]);

    const handleOpen = (event, id) => setAnchorEls(prev => ({ ...prev, [id]: event.currentTarget }));
    const handleClose = (id) => setAnchorEls(prev => ({ ...prev, [id]: null }));

    if (loading) return <Box sx={{ display: 'flex', gap: 2, p: 1 }}><CircularProgress size={20} /></Box>;
    if (!categories.length) return null;

    const fadeStyle = {
        content: '""', position: 'absolute', top: 0, bottom: 0, width: 32, pointerEvents: 'none', zIndex: 1,
    };

    return (
        <Box sx={{ position: 'relative', borderBottom: 1, borderColor: 'divider',
            '&::before': canScrollLeft ? { ...fadeStyle, left: 0, background: 'linear-gradient(to right, rgba(255,255,255,0.95), transparent)' } : {},
            '&::after': canScrollRight ? { ...fadeStyle, right: 0, background: 'linear-gradient(to left, rgba(255,255,255,0.95), transparent)' } : {},
        }}>
            <Box ref={scrollRef} sx={{ overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
                <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, p: { xs: 0.75, md: 1 } }}>
                {categories.map((cat) => {
                    const hasChildren = cat.children?.length > 0 && categoryDepth > 1;
                    return (
                        <Box key={cat.id} sx={{ flexShrink: 0 }}>
                            <Button
                                color="inherit"
                                size="small"
                                onClick={(e) => hasChildren ? handleOpen(e, cat.id) : navigate(`/products?category=${cat.slug}`)}
                                sx={{ fontSize: { xs: '0.8rem', md: '0.875rem' }, px: { xs: 1.5, md: 1.5 }, minHeight: 44, minWidth: 44, whiteSpace: 'nowrap' }}
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
            </Box>
        </Box>
    );
};

export default CategoryNav;
