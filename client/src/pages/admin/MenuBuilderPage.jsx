import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MenuService from '../../services/menuService';
import PageService from '../../services/pageService';
import { getCategories } from '../../services/categoryService';
import { getProducts } from '../../services/productService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

const emptyMenuForm = {
  name: '',
  slug: '',
  location: 'header',
  isActive: true,
  sortOrder: 0,
};

const emptyItemForm = {
  parentId: '',
  label: '',
  targetType: 'none',
  targetId: '',
  url: '',
  placement: 'center',
  sortOrder: 0,
  isVisible: true,
  openInNewTab: false,
};

const flattenItems = (items = [], depth = 0, rows = []) => {
  items.forEach((item) => {
    rows.push({ ...item, depth, displayLabel: `${'  '.repeat(depth)}${item.label}` });
    flattenItems(item.children || [], depth + 1, rows);
  });
  return rows;
};

const flattenCategories = (items = [], depth = 0, rows = []) => {
  items.forEach((item) => {
    rows.push({ ...item, displayName: `${'  '.repeat(depth)}${item.name}` });
    flattenCategories(item.children || [], depth + 1, rows);
  });
  return rows;
};

const formatValidationError = (error, fallback) => {
  const details = error?.response?.data?.error?.details;
  if (Array.isArray(details) && details.length) {
    return details.map((detail) => detail.message).join(' ');
  }
  return getApiErrorMessage(error, fallback);
};

const needsTarget = (targetType) => ['page', 'category', 'collection', 'product'].includes(targetType);
const needsUrl = (targetType) => ['custom_url', 'system_route'].includes(targetType);

const MenuBuilderPage = () => {
  const [menus, setMenus] = useState([]);
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [menuForm, setMenuForm] = useState(emptyMenuForm);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItem, setEditingItem] = useState(null);
  const [pages, setPages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.MENUS_MANAGE);

  const rows = useMemo(() => flattenItems(selectedMenu?.items || []), [selectedMenu]);
  const parentOptions = rows.filter((row) => row.id !== editingItem?.id);
  const categoryOptions = useMemo(() => flattenCategories(categories), [categories]);

  const fetchMenus = async (preferredId = selectedMenuId) => {
    setLoading(true);
    try {
      const response = await MenuService.adminGetMenus({ includeInactive: true });
      const nextMenus = response.data || [];
      setMenus(nextMenus);
      const nextSelected = preferredId || nextMenus[0]?.id || '';
      setSelectedMenuId(nextSelected);
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to load menus.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectedMenu = async () => {
    if (!selectedMenuId) {
      setSelectedMenu(null);
      return;
    }
    setLoading(true);
    try {
      const response = await MenuService.adminGetMenuById(selectedMenuId);
      setSelectedMenu(response.data);
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to load menu details.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  useEffect(() => {
    const fetchTargets = async () => {
      try {
        const [pagesResponse, categoriesResponse, productsResponse] = await Promise.all([
          PageService.adminGetPages({ page: 1, limit: 100, status: 'published' }),
          getCategories(),
          getProducts({ page: 1, limit: 100, status: 'published' }),
        ]);
        setPages(pagesResponse.data || []);
        setCategories(categoriesResponse || []);
        setProducts(productsResponse.data || []);
      } catch (error) {
        notify(formatValidationError(error, 'Failed to load menu target options.'), 'error');
      }
    };

    fetchTargets();
  }, []);

  useEffect(() => {
    fetchSelectedMenu();
  }, [selectedMenuId]);

  const openMenuDialog = (menu = null) => {
    setMenuForm(menu ? {
      name: menu.name || '',
      slug: menu.slug || '',
      location: menu.location || 'header',
      isActive: menu.isActive !== false,
      sortOrder: menu.sortOrder || 0,
    } : emptyMenuForm);
    setMenuDialogOpen(true);
  };

  const saveMenu = async () => {
    try {
      const response = await MenuService.adminCreateMenu(menuForm);
      setMenuDialogOpen(false);
      notify('Menu saved.', 'success');
      fetchMenus(response.data.id);
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to save menu.'), 'error');
    }
  };

  const saveSelectedMenu = async () => {
    if (!selectedMenu) return;
    try {
      await MenuService.adminUpdateMenu(selectedMenu.id, {
        name: selectedMenu.name,
        slug: selectedMenu.slug,
        location: selectedMenu.location,
        isActive: selectedMenu.isActive,
        sortOrder: selectedMenu.sortOrder,
      });
      notify('Menu settings updated.', 'success');
      fetchMenus();
      fetchSelectedMenu();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to update menu.'), 'error');
    }
  };

  const deleteSelectedMenu = async () => {
    if (!selectedMenu || !window.confirm(`Delete "${selectedMenu.name}"?`)) return;
    try {
      await MenuService.adminDeleteMenu(selectedMenu.id);
      notify('Menu deleted.', 'success');
      setSelectedMenuId('');
      fetchMenus();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to delete menu.'), 'error');
    }
  };

  const openItemDialog = (item = null) => {
    setEditingItem(item);
    setItemForm(item ? {
      parentId: item.parentId || '',
      label: item.label || '',
      targetType: item.targetType || 'none',
      targetId: item.targetId || '',
      url: item.url || '',
      placement: item.placement || 'center',
      sortOrder: item.sortOrder || 0,
      isVisible: item.isVisible !== false,
      openInNewTab: item.openInNewTab || false,
    } : { ...emptyItemForm, placement: selectedMenu?.location === 'footer' ? 'quick_links' : 'center', sortOrder: rows.length * 10 });
    setItemDialogOpen(true);
  };

  const buildItemPayload = () => {
    const label = itemForm.label.trim();
    const targetType = itemForm.targetType || 'none';
    const payload = {
      parentId: itemForm.parentId || null,
      label,
      targetType,
      targetId: needsTarget(targetType) ? itemForm.targetId || null : null,
      url: needsUrl(targetType) ? itemForm.url.trim() : null,
      placement: itemForm.placement,
      sortOrder: Number(itemForm.sortOrder) || 0,
      isVisible: Boolean(itemForm.isVisible),
      openInNewTab: needsUrl(targetType) ? Boolean(itemForm.openInNewTab) : false,
    };

    if (!payload.label) {
      throw new Error('Label is required.');
    }
    if (needsUrl(targetType) && !payload.url) {
      throw new Error('URL is required for this link type.');
    }
    if (needsTarget(targetType) && !payload.targetId) {
      throw new Error('Please choose a target.');
    }

    return payload;
  };

  const saveItem = async () => {
    if (!selectedMenu) return;
    try {
      const payload = buildItemPayload();
      if (editingItem) {
        await MenuService.adminUpdateMenuItem(selectedMenu.id, editingItem.id, payload);
      } else {
        await MenuService.adminCreateMenuItem(selectedMenu.id, payload);
      }
      setItemDialogOpen(false);
      notify('Menu item saved.', 'success');
      fetchSelectedMenu();
    } catch (error) {
      notify(formatValidationError(error, 'Failed to save menu item.'), 'error');
    }
  };

  const deleteItem = async (item) => {
    if (!selectedMenu || !window.confirm(`Delete "${item.label}" and its children?`)) return;
    try {
      await MenuService.adminDeleteMenuItem(selectedMenu.id, item.id);
      notify('Menu item deleted.', 'success');
      fetchSelectedMenu();
    } catch (error) {
      notify(formatValidationError(error, 'Failed to delete menu item.'), 'error');
    }
  };

  const nudgeItem = async (item, direction) => {
    const siblings = rows.filter((row) => (row.parentId || '') === (item.parentId || '') && row.placement === item.placement);
    const currentIndex = siblings.findIndex((row) => row.id === item.id);
    const swapWith = siblings[currentIndex + direction];
    if (!swapWith) return;

    try {
      await MenuService.adminReorderMenuItems(selectedMenu.id, [
        { id: item.id, parentId: item.parentId || null, placement: item.placement, sortOrder: swapWith.sortOrder },
        { id: swapWith.id, parentId: swapWith.parentId || null, placement: swapWith.placement, sortOrder: item.sortOrder },
      ]);
      fetchSelectedMenu();
    } catch (error) {
      notify(formatValidationError(error, 'Failed to reorder menu items.'), 'error');
    }
  };

  const targetOptions = useMemo(() => {
    if (itemForm.targetType === 'page') return pages.map((page) => ({ id: page.id, label: page.title }));
    if (itemForm.targetType === 'category' || itemForm.targetType === 'collection') {
      return categoryOptions.map((category) => ({ id: category.id, label: category.displayName }));
    }
    if (itemForm.targetType === 'product') return products.map((product) => ({ id: product.id, label: product.name }));
    return [];
  }, [itemForm.targetType, pages, categoryOptions, products]);

  const columns = [
    { field: 'displayLabel', headerName: 'Label', flex: 1, renderCell: (params) => (
      <Typography sx={{ pl: params.row.depth * 2, fontWeight: params.row.depth === 0 ? 700 : 400 }}>
        {params.row.label}
      </Typography>
    ) },
    { field: 'placement', headerName: 'Placement', width: 130 },
    { field: 'targetType', headerName: 'Type', width: 130 },
    { field: 'url', headerName: 'URL', flex: 1 },
    { field: 'sortOrder', headerName: 'Order', width: 90 },
    { field: 'isVisible', headerName: 'Visible', width: 100, renderCell: (params) => (
      <Chip label={params.value ? 'Visible' : 'Hidden'} color={params.value ? 'success' : 'default'} size="small" />
    ) },
    { field: 'actions', headerName: 'Actions', width: 190, sortable: false, renderCell: (params) => (
      <Box>
        <Tooltip title="Move up"><span><IconButton disabled={!canManage} onClick={() => nudgeItem(params.row, -1)}><KeyboardArrowUpIcon /></IconButton></span></Tooltip>
        <Tooltip title="Move down"><span><IconButton disabled={!canManage} onClick={() => nudgeItem(params.row, 1)}><KeyboardArrowDownIcon /></IconButton></span></Tooltip>
        <Tooltip title="Edit"><span><IconButton disabled={!canManage} onClick={() => openItemDialog(params.row)}><EditIcon /></IconButton></span></Tooltip>
        <Tooltip title="Delete"><span><IconButton disabled={!canManage} color="error" onClick={() => deleteItem(params.row)}><DeleteIcon /></IconButton></span></Tooltip>
      </Box>
    ) },
  ];

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Menu Builder</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openMenuDialog()}>
            New Menu
          </Button>
        )}
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" mb={2}>Menus</Typography>
            <Stack spacing={1}>
              {menus.map((menu) => (
                <Button
                  key={menu.id}
                  variant={menu.id === selectedMenuId ? 'contained' : 'outlined'}
                  onClick={() => setSelectedMenuId(menu.id)}
                  sx={{ justifyContent: 'space-between' }}
                >
                  <span>{menu.name}</span>
                  <Chip label={menu.location} size="small" />
                </Button>
              ))}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 2, mb: 2 }}>
            {selectedMenu ? (
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField fullWidth label="Name" value={selectedMenu.name || ''} disabled={!canManage}
                    onChange={(e) => setSelectedMenu({ ...selectedMenu, name: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="Slug" value={selectedMenu.slug || ''} disabled={!canManage}
                    onChange={(e) => setSelectedMenu({ ...selectedMenu, slug: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Location</InputLabel>
                    <Select label="Location" value={selectedMenu.location || 'header'} disabled={!canManage}
                      onChange={(e) => setSelectedMenu({ ...selectedMenu, location: e.target.value })}>
                      <MenuItem value="header">Header</MenuItem>
                      <MenuItem value="footer">Footer</MenuItem>
                      <MenuItem value="mobile">Mobile</MenuItem>
                      <MenuItem value="sidebar">Sidebar</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={1.5}>
                  <TextField fullWidth label="Order" type="number" value={selectedMenu.sortOrder || 0} disabled={!canManage}
                    onChange={(e) => setSelectedMenu({ ...selectedMenu, sortOrder: Number(e.target.value) })} />
                </Grid>
                <Grid item xs={6} md={1.5}>
                  <Stack direction="row" alignItems="center">
                    <Switch checked={selectedMenu.isActive !== false} disabled={!canManage}
                      onChange={(e) => setSelectedMenu({ ...selectedMenu, isActive: e.target.checked })} />
                    <Typography>Active</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" disabled={!canManage} onClick={saveSelectedMenu}>Save</Button>
                    <IconButton color="error" disabled={!canManage} onClick={deleteSelectedMenu}><DeleteIcon /></IconButton>
                  </Stack>
                </Grid>
              </Grid>
            ) : (
              <Typography color="text.secondary">Create a menu to begin.</Typography>
            )}
          </Paper>

          <Paper sx={{ height: 560, width: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" p={2}>
              <Box>
                <Typography variant="h6">Items</Typography>
                <Typography variant="body2" color="text.secondary">
                  Header supports left, center, and right placement. Footer quick links use the footer menu.
                </Typography>
              </Box>
              <Button variant="contained" startIcon={<AddIcon />} disabled={!canManage || !selectedMenu} onClick={() => openItemDialog()}>
                Add Item
              </Button>
            </Stack>
            <Divider />
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              disableRowSelectionOnClick
              pageSizeOptions={[25, 50, 100]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            />
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={menuDialogOpen} onClose={() => setMenuDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Menu</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Name" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} />
            <TextField label="Slug" helperText="Optional. Leave empty to generate." value={menuForm.slug || ''} onChange={(e) => setMenuForm({ ...menuForm, slug: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Location</InputLabel>
              <Select label="Location" value={menuForm.location} onChange={(e) => setMenuForm({ ...menuForm, location: e.target.value })}>
                <MenuItem value="header">Header</MenuItem>
                <MenuItem value="footer">Footer</MenuItem>
                <MenuItem value="mobile">Mobile</MenuItem>
                <MenuItem value="sidebar">Sidebar</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMenuDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveMenu}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Label" value={itemForm.label} onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Parent</InputLabel>
                <Select label="Parent" value={itemForm.parentId || ''} onChange={(e) => setItemForm({ ...itemForm, parentId: e.target.value })}>
                  <MenuItem value="">No parent</MenuItem>
                  {parentOptions.map((item) => (
                    <MenuItem key={item.id} value={item.id}>{item.displayLabel}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type"
                  value={itemForm.targetType}
                  onChange={(e) => setItemForm({
                    ...itemForm,
                    targetType: e.target.value,
                    targetId: '',
                    url: '',
                    openInNewTab: false,
                  })}
                >
                  <MenuItem value="none">No Link / Parent</MenuItem>
                  <MenuItem value="custom_url">Custom URL</MenuItem>
                  <MenuItem value="system_route">System Route</MenuItem>
                  <MenuItem value="page">Page</MenuItem>
                  <MenuItem value="category">Category</MenuItem>
                  <MenuItem value="product">Product</MenuItem>
                  <MenuItem value="collection">Collection</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {needsTarget(itemForm.targetType) && (
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Target</InputLabel>
                  <Select
                    label="Target"
                    value={itemForm.targetId || ''}
                    onChange={(e) => setItemForm({ ...itemForm, targetId: e.target.value })}
                  >
                    <MenuItem value="">Choose target</MenuItem>
                    {targetOptions.map((target) => (
                      <MenuItem key={target.id} value={target.id}>{target.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {needsUrl(itemForm.targetType) && (
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label={itemForm.targetType === 'system_route' ? 'Route' : 'URL'}
                  placeholder={itemForm.targetType === 'system_route' ? '/products' : 'https://example.com or /products'}
                  value={itemForm.url || ''}
                  onChange={(e) => setItemForm({ ...itemForm, url: e.target.value })}
                />
              </Grid>
            )}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Placement</InputLabel>
                <Select label="Placement" value={itemForm.placement} onChange={(e) => setItemForm({ ...itemForm, placement: e.target.value })}>
                  <MenuItem value="left">Header Left</MenuItem>
                  <MenuItem value="center">Header Center</MenuItem>
                  <MenuItem value="right">Header Right</MenuItem>
                  <MenuItem value="quick_links">Footer Quick Links</MenuItem>
                  <MenuItem value="footer_column">Footer Column</MenuItem>
                  <MenuItem value="mobile">Mobile</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth type="number" label="Order" value={itemForm.sortOrder} onChange={(e) => setItemForm({ ...itemForm, sortOrder: Number(e.target.value) })} />
            </Grid>
            <Grid item xs={6} md={3}>
              <Stack direction="row" alignItems="center">
                <Switch checked={itemForm.isVisible} onChange={(e) => setItemForm({ ...itemForm, isVisible: e.target.checked })} />
                <Typography>Visible</Typography>
              </Stack>
            </Grid>
            {needsUrl(itemForm.targetType) && (
              <Grid item xs={6} md={3}>
                <Stack direction="row" alignItems="center">
                  <Switch checked={itemForm.openInNewTab} onChange={(e) => setItemForm({ ...itemForm, openInNewTab: e.target.checked })} />
                  <Typography>New tab</Typography>
                </Stack>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveItem}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MenuBuilderPage;
