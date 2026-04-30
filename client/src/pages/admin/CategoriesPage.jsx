import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, CircularProgress, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Chip, Tooltip, Divider, Stack, MenuItem, CardMedia, Grid,
  List, ListItemButton, ListItemText, ListItemIcon, Collapse,
  Breadcrumbs, Link, ToggleButtonGroup, ToggleButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  FolderOpen as FolderOpenIcon, Folder as FolderIcon,
  Close as CloseIcon, ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon, ViewList as ViewListIcon,
  AccountTree as AccountTreeIcon, NavigateNext as NavigateNextIcon,
  SubdirectoryArrowRight as SubdirectoryArrowRightIcon
} from '@mui/icons-material';

import {
  getCategoryTree, createCategory, updateCategory, deleteCategory,
} from '../../services/categoryService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import MediaPicker from '../../components/common/MediaPicker';
import MediaUploader from '../../components/common/MediaUploader';
import { getMediaUrl } from '../../utils/media';
import { useSettings } from '../../hooks/useSettings';

// --- Helpers ---
const flattenTree = (nodes, result = [], level = 0, path = []) => {
  nodes.forEach((n) => {
    const currentPath = [...path, { id: n.id, name: n.name }];
    result.push({ ...n, level, path: currentPath });
    if (n.children?.length) flattenTree(n.children, result, level + 1, currentPath);
  });
  return result;
};

const getBreadcrumbPath = (nodes, targetId, path = []) => {
    for (const node of nodes) {
        if (node.id === targetId) return [...path, { id: node.id, name: node.name }];
        if (node.children) {
            const found = getBreadcrumbPath(node.children, targetId, [...path, { id: node.id, name: node.name }]);
            if (found) return found;
        }
    }
    return null;
};

// --- CategoryTreeItem Component (Left Panel Node) ---
const CategoryTreeItem = ({ node, level, expandedIds, toggleNode, selectedId, onSelect }) => {
    const isExpanded = expandedIds.includes(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    const handleRowClick = () => {
        onSelect(node.id);
        if (!isExpanded && hasChildren) {
            toggleNode(node.id);
        }
    };

    return (
        <React.Fragment>
            <ListItemButton
                onClick={handleRowClick}
                sx={{
                    pl: 2 + level * 2,
                    py: 1,
                    bgcolor: isSelected ? 'action.selected' : 'transparent',
                    borderLeft: isSelected ? '3px solid' : '3px solid transparent',
                    borderColor: 'primary.main',
                    '&:hover': {
                        bgcolor: isSelected ? 'action.selected' : 'action.hover'
                    }
                }}
            >
                <ListItemIcon sx={{ minWidth: 28 }}>
                    {hasChildren ? (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
                            sx={{ p: 0.2, mr: 0.5 }}>
                            {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                        </IconButton>
                    ) : (
                        <Box sx={{ width: 24, height: 24, mr: 0.5 }} />
                    )}
                </ListItemIcon>
                <ListItemIcon sx={{ minWidth: 32 }}>
                    {isSelected || isExpanded ? <FolderOpenIcon color={isSelected ? "primary" : "action"} fontSize="small" /> : <FolderIcon color="action" fontSize="small" />}
                </ListItemIcon>
                <ListItemText 
                    primary={node.name} 
                    primaryTypographyProps={{ 
                        variant: 'body2', 
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? 'text.primary' : 'text.secondary',
                        noWrap: true
                    }} 
                />
                {hasChildren && (
                    <Chip label={node.children.length} size="small" sx={{ height: 16, fontSize: '0.65rem' }} />
                )}
            </ListItemButton>
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                    {node.children?.map(child => (
                        <CategoryTreeItem 
                            key={child.id} node={child} level={level + 1}
                            expandedIds={expandedIds} toggleNode={toggleNode}
                            selectedId={selectedId} onSelect={onSelect}
                        />
                    ))}
                </List>
            </Collapse>
        </React.Fragment>
    );
};

// --- CategoryDetailsPanel Component (Right Panel) ---
const CategoryDetailsPanel = ({ categoryId, categories, onEdit, onDelete, onAddChild, onNavigateNode, canManageCategories }) => {
    const selectedPath = useMemo(() => getBreadcrumbPath(categories, categoryId) || [], [categories, categoryId]);
    const selectedCatNode = useMemo(() => {
        let found = null;
        const findNode = (nodes, id) => {
            for(const n of nodes) {
                if(n.id === id) { found = n; return; }
                else if(n.children) findNode(n.children, id);
            }
        };
        findNode(categories, categoryId);
        return found;
    }, [categories, categoryId]);

    if (!selectedCatNode) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', py: 12, color: 'text.secondary' }}>
                <AccountTreeIcon sx={{ fontSize: 64, mb: 2, opacity: 0.2 }} />
                <Typography variant="h6">Select a Category</Typography>
                <Typography variant="body2">Click on a category in the tree to view its details.</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
                {selectedPath.map((crumb, idx) => (
                    idx === selectedPath.length - 1 ? (
                        <Typography key={crumb.id} color="text.primary" fontWeight={600}>
                            {crumb.name}
                        </Typography>
                    ) : (
                        <Link 
                            key={crumb.id} 
                            component="button" 
                            variant="body1" 
                            underline="hover" 
                            color="inherit" 
                            onClick={() => onNavigateNode(crumb.id)}>
                            {crumb.name}
                        </Link>
                    )
                ))}
            </Breadcrumbs>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {selectedCatNode.image && (
                        <Box sx={{ width: 80, height: 80, borderRadius: 2, overflow: 'hidden', flexShrink: 0, border: '1px solid', borderColor: 'divider' }}>
                            <img src={getMediaUrl(selectedCatNode.image)} alt={selectedCatNode.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </Box>
                    )}
                    <Box>
                        <Typography variant="h4" fontWeight={700} gutterBottom>{selectedCatNode.name}</Typography>
                        {selectedCatNode.description && (
                            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
                                {selectedCatNode.description}
                            </Typography>
                        )}
                    </Box>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<EditIcon />} onClick={() => onEdit(selectedCatNode)} disabled={!canManageCategories}>Edit</Button>
                    <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => onDelete(selectedCatNode.id)} disabled={!canManageCategories}>Delete</Button>
                </Stack>
            </Box>

            <Divider sx={{ mb: 4 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" fontWeight={600}>Subcategories ({selectedCatNode.children?.length || 0})</Typography>
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => onAddChild(selectedCatNode)} disabled={!canManageCategories}>
                    Add Subcategory
                </Button>
            </Box>

            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {!selectedCatNode.children || selectedCatNode.children.length === 0 ? (
                    <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', color: 'text.secondary', bgcolor: 'background.default' }}>
                        <SubdirectoryArrowRightIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                        <Typography variant="h6" fontWeight={500} gutterBottom>No subcategories</Typography>
                        <Typography variant="body2">This category has no direct subcategories.</Typography>
                        <Button variant="outlined" size="small" startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => onAddChild(selectedCatNode)} disabled={!canManageCategories}>
                            Create One
                        </Button>
                    </Paper>
                ) : (
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="medium">
                            <TableHead sx={{ bgcolor: 'action.hover' }}>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell align="center">Subcategories</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {selectedCatNode.children.map(child => (
                                    <TableRow key={child.id} hover>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} onClick={() => onNavigateNode(child.id)}>
                                                {child.image ? (
                                                    <Box sx={{ width: 40, height: 40, borderRadius: 1.5, overflow: 'hidden' }}>
                                                        <img src={getMediaUrl(child.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </Box>
                                                ) : (
                                                    <Box sx={{ width: 40, height: 40, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                                                        <FolderIcon color="action" />
                                                    </Box>
                                                )}
                                                <Typography variant="body1" fontWeight={500} color="primary.main" sx={{ '&:hover': { textDecoration: 'underline' } }}>{child.name}</Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip label={child.children?.length || 0} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Tooltip title="View Subcategory">
                                                    <IconButton size="small" onClick={() => onNavigateNode(child.id)}>
                                                        <ChevronRightIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => onEdit(child)} disabled={!canManageCategories}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" color="error" onClick={() => onDelete(child.id)} disabled={!canManageCategories}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Box>
    );
};

// --- CategoryFlatView Component ---
const CategoryFlatView = ({ flatCategories, onEdit, onDelete, onAddChild, canManageCategories }) => {
    return (
        <TableContainer component={Paper} variant="outlined">
            <Table>
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                        <TableCell>Category</TableCell>
                        <TableCell>Hierarchy Path</TableCell>
                        <TableCell align="right">Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {flatCategories.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={3} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                                <FolderOpenIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                                <Typography>No categories yet.</Typography>
                            </TableCell>
                        </TableRow>
                    )}
                    {flatCategories.map(cat => {
                        const pathStr = cat.path.map(p => p.name).join(' > ');
                        return (
                            <TableRow key={cat.id} hover>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        {cat.image ? (
                                            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, overflow: 'hidden' }}>
                                                <img src={getMediaUrl(cat.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </Box>
                                        ) : (
                                            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                                                <FolderIcon color="action" />
                                            </Box>
                                        )}
                                        <Box>
                                            <Typography variant="body2" fontWeight={600}>{cat.name}</Typography>
                                            {cat.children && cat.children.length > 0 && (
                                                <Typography variant="caption" color="text.secondary">{cat.children.length} subcategories</Typography>
                                            )}
                                        </Box>
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="text.secondary">{pathStr}</Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                        <Tooltip title="Add Subcategory">
                                            <IconButton size="small" onClick={() => onAddChild(cat)} disabled={!canManageCategories}>
                                                <AddIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => onEdit(cat)} disabled={!canManageCategories}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => onDelete(cat.id)} disabled={!canManageCategories}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

// --- Main Page Component ---
const CategoriesPage = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // View state
    const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'flat'
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [expandedNodeIds, setExpandedNodeIds] = useState([]);

    // Dialog state
    const [openDialog, setOpenDialog] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingCat, setEditingCat] = useState(null);
    const [formData, setFormData] = useState({ 
        name: '', 
        description: '', 
        parentId: '', 
        image: '',
        metaTitle: '',
        metaDescription: '',
        metaKeywords: '',
        ogImage: ''
    });
    const [formErrors, setFormErrors] = useState({});
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

    const { notify, confirm } = useNotification();
    const { hasPermission } = useAuth();
    const { settings } = useSettings();
    const canManageCategories = hasPermission(PERMISSIONS.CATEGORIES_MANAGE);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const res = await getCategoryTree();
            setCategories(res?.data || []);
            
            // Auto expand root items on first load if not expanded yet
            if (expandedNodeIds.length === 0 && res?.data) {
                setExpandedNodeIds(res.data.map(c => c.id));
            }
        } catch {
            notify('Failed to load categories.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Tree interactions
    const toggleNode = (id) => {
        setExpandedNodeIds(prev => 
            prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
        );
    };

    const handleNavigateNode = (id) => {
        setSelectedCategoryId(id);
        
        // Ensure path to node is expanded
        const path = getBreadcrumbPath(categories, id) || [];
        const idsToExpand = path.map(p => p.id);
        setExpandedNodeIds(prev => {
            const newExpanded = new Set([...prev, ...idsToExpand]);
            return Array.from(newExpanded);
        });
    };

    // Dialog actions
    const openCreate = (parent = null) => {
        if (!canManageCategories) {
            notify('You do not have permission to manage categories.', 'error');
            return;
        }
        setEditingCat(null);
        setFormData({ 
            name: '', 
            description: '', 
            parentId: parent?.id || '', 
            image: '',
            metaTitle: '',
            metaDescription: '',
            metaKeywords: '',
            ogImage: ''
        });
        setFormErrors({});
        setOpenDialog(true);
    };

    const openEdit = (cat) => {
        if (!canManageCategories) {
            notify('You do not have permission to manage categories.', 'error');
            return;
        }
        setEditingCat(cat);
        setFormData({
            name: cat.name,
            description: cat.description || '',
            parentId: cat.parentId || '',
            image: cat.image || '',
            metaTitle: cat.metaTitle || '',
            metaDescription: cat.metaDescription || '',
            metaKeywords: cat.metaKeywords || '',
            ogImage: cat.ogImage || '',
        });
        setFormErrors({});
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingCat(null);
    };

    const handleSaveDialog = async () => {
        if (!canManageCategories) {
            notify('You do not have permission to manage categories.', 'error');
            return;
        }

        const errs = {};
        if (!formData.name.trim()) errs.name = 'Name is required.';
        if (Object.keys(errs).length) {
            setFormErrors(errs);
            return;
        }

        setSaving(true);
        try {
            const data = { ...formData, parentId: formData.parentId || null };
            if (!data.image) data.image = null;
            if (!data.ogImage) data.ogImage = null;
            if (!data.metaTitle) data.metaTitle = null;
            if (!data.metaDescription) data.metaDescription = null;
            if (!data.metaKeywords) data.metaKeywords = null;

            if (editingCat) {
                await updateCategory(editingCat.id, data);
                notify('Category updated successfully.', 'success');
            } else {
                const res = await createCategory(data);
                notify('Category created successfully.', 'success');
                // Auto-select newly created category if applicable
                if (res?.data?.id) setSelectedCategoryId(res.data.id);
                // Ensure parent is expanded
                if (data.parentId) {
                   setExpandedNodeIds(prev => prev.includes(data.parentId) ? prev : [...prev, data.parentId]);
                }
            }
            handleCloseDialog();
            fetchCategories();
        } catch (err) {
            notify(getApiErrorMessage(err), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleMediaSelect = (media) => {
        if (!media) return;
        setFormData((f) => ({ ...f, image: media.url }));
        setMediaPickerOpen(false);
    };

    const handleDelete = async (id) => {
        if (!canManageCategories) {
            notify('You do not have permission to manage categories.', 'error');
            return;
        }

        if (!(await confirm('Delete Category', 'Delete this category? Sub-categories may also be affected.', 'danger'))) return;
        try {
            await deleteCategory(id);
            notify('Category deleted successfully.', 'success');
            if (selectedCategoryId === id) setSelectedCategoryId(null);
            fetchCategories();
        } catch (err) {
            notify(`Cannot delete: ${getApiErrorMessage(err)}`, 'error');
        }
    };

    const flatCategories = useMemo(() => flattenTree(categories), [categories]);
    const totalCount = flatCategories.length;

    return (
        <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            {/* Page Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2, flexShrink: 0 }}>
                <Box>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        Categories Management
                    </Typography>
                    {!loading && (
                        <Typography variant="body1" color="text.secondary">
                            {totalCount} {totalCount === 1 ? 'category' : 'categories'} organized hierarchically
                        </Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_, val) => val && setViewMode(val)}
                        size="small"
                        color="primary"
                    >
                        <ToggleButton value="tree">
                            <AccountTreeIcon sx={{ mr: 1, fontSize: 20 }} /> Tree View
                        </ToggleButton>
                        <ToggleButton value="flat">
                            <ViewListIcon sx={{ mr: 1, fontSize: 20 }} /> Flat View
                        </ToggleButton>
                    </ToggleButtonGroup>

                    {canManageCategories && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate()}>
                            Add Root Category
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Main Content Area */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, py: 12 }}>
                    <CircularProgress />
                </Box>
            ) : viewMode === 'flat' ? (
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                    <CategoryFlatView 
                        flatCategories={flatCategories} 
                        onEdit={openEdit} 
                        onDelete={handleDelete} 
                        onAddChild={openCreate} 
                        canManageCategories={canManageCategories} 
                    />
                </Box>
            ) : (
                <Grid container spacing={3} sx={{ flexGrow: 1, minHeight: 0 }}>
                    {/* Left Pane: Tree Navigation */}
                    <Grid item xs={12} md={4} lg={3} sx={{ height: '100%' }}>
                        <Paper variant="outlined" sx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
                            <Box sx={{ p: 2, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="subtitle2" fontWeight={600} color="text.secondary">CATEGORY HIERARCHY</Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
                                {categories.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                                        <Typography variant="body2">No categories found.</Typography>
                                    </Box>
                                ) : (
                                    <List component="nav" disablePadding>
                                        {categories.map(cat => (
                                            <CategoryTreeItem 
                                                key={cat.id} 
                                                node={cat} 
                                                level={0}
                                                expandedIds={expandedNodeIds}
                                                toggleNode={toggleNode}
                                                selectedId={selectedCategoryId}
                                                onSelect={setSelectedCategoryId}
                                            />
                                        ))}
                                    </List>
                                )}
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Right Pane: Details & Actions */}
                    <Grid item xs={12} md={8} lg={9} sx={{ height: '100%' }}>
                        <Paper variant="outlined" sx={{ height: '100%', overflow: 'auto', borderRadius: 2 }}>
                            <CategoryDetailsPanel 
                                categoryId={selectedCategoryId}
                                categories={categories}
                                onEdit={openEdit}
                                onDelete={handleDelete}
                                onAddChild={openCreate}
                                onNavigateNode={handleNavigateNode}
                                canManageCategories={canManageCategories}
                            />
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {/* Category Form Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>{editingCat ? 'Edit Category' : 'New Category'}</DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>Category Image</Typography>
                        {formData.image ? (
                            <Box sx={{ position: 'relative', width: '100%', height: 180, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                                <CardMedia
                                    component="img"
                                    image={getMediaUrl(formData.image)}
                                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <IconButton 
                                    size="small" 
                                    onClick={() => setFormData(f => ({ ...f, image: '' }))}
                                    sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'background.paper', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        ) : (
                            <Box>
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => setMediaPickerOpen(true)}
                                    sx={{
                                        py: 3,
                                        borderStyle: 'dashed',
                                        borderWidth: 2,
                                        '&:hover': { borderStyle: 'dashed', borderWidth: 2 }
                                    }}
                                >
                                    Select or Upload Category Image
                                </Button>
                                <MediaPicker
                                    open={mediaPickerOpen}
                                    onClose={() => setMediaPickerOpen(false)}
                                    onSelect={handleMediaSelect}
                                    multiple={false}
                                    title="Select Category Image"
                                />
                            </Box>
                        )}
                    </Box>

                    <TextField
                        autoFocus
                        label="Name *"
                        fullWidth
                        value={formData.name}
                        error={!!formErrors.name}
                        helperText={formErrors.name}
                        onChange={(e) => {
                            setFormData((f) => ({ ...f, name: e.target.value }));
                            if (formErrors.name) setFormErrors((f) => ({ ...f, name: undefined }));
                        }}
                    />
                    <TextField
                        label="Description"
                        fullWidth
                        multiline
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                    />
                    <TextField
                        select
                        label="Parent Category"
                        fullWidth
                        value={formData.parentId}
                        onChange={(e) => setFormData((f) => ({ ...f, parentId: e.target.value }))}
                        helperText="Leave empty to create a top-level category"
                    >
                        <MenuItem value="">— None (top level) —</MenuItem>
                        {flatCategories
                            .filter((c) => c.id !== editingCat?.id) // Cannot be own parent
                            .map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                    {c.path.map(p => p.name).join(' > ')}
                                </MenuItem>
                            ))}
                    </TextField>

                    {settings?.features?.seo !== false && (
                        <>
                            <Divider sx={{ my: 1 }} />
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>SEO Settings</Typography>
                                    <Chip label="Optional" size="small" variant="outlined" sx={{ ml: 1, height: 20, fontSize: '0.65rem' }} />
                                </Box>
                                
                                <Stack spacing={2}>
                                    <TextField
                                        label="Meta Title"
                                        fullWidth
                                        size="small"
                                        value={formData.metaTitle}
                                        onChange={(e) => setFormData(f => ({ ...f, metaTitle: e.target.value }))}
                                        placeholder={formData.name}
                                        helperText="Clickable title in search results"
                                    />
                                    <TextField
                                        label="Meta Description"
                                        fullWidth
                                        size="small"
                                        multiline
                                        rows={2}
                                        value={formData.metaDescription}
                                        onChange={(e) => setFormData(f => ({ ...f, metaDescription: e.target.value }))}
                                        placeholder={formData.description}
                                        helperText="Brief summary for search engines"
                                    />
                                    <TextField
                                        label="Keywords"
                                        fullWidth
                                        size="small"
                                        value={formData.metaKeywords}
                                        onChange={(e) => setFormData(f => ({ ...f, metaKeywords: e.target.value }))}
                                        helperText="Internal search tags (comma separated)"
                                    />
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                                            Social Share Image (OG Image)
                                        </Typography>
                                        {formData.ogImage ? (
                                            <Box sx={{ position: 'relative', width: '100%', height: 120, borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                                                <CardMedia
                                                    component="img"
                                                    image={getMediaUrl(formData.ogImage)}
                                                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                                <IconButton 
                                                    size="small" 
                                                    onClick={() => setFormData(f => ({ ...f, ogImage: '' }))}
                                                    sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper', p: 0.5 }}
                                                >
                                                    <CloseIcon fontSize="inherit" />
                                                </IconButton>
                                            </Box>
                                        ) : (
                                            <MediaUploader 
                                                multiple={false} 
                                                onUploadSuccess={(media) => {
                                                    setFormData(f => ({ ...f, ogImage: media.url }));
                                                }} 
                                            />
                                        )}
                                    </Box>
                                </Stack>
                            </Box>
                        </>
                    )}
                </DialogContent>
                <Divider />
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={handleCloseDialog} disabled={saving} color="inherit">
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleSaveDialog} disabled={saving || !canManageCategories}>
                        {saving ? 'Saving…' : 'Save Category'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CategoriesPage;
