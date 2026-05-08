import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';

import MenuService from '../../services/menuService';
import PageService from '../../services/pageService';
import { getCategories } from '../../services/categoryService';
import { getProducts } from '../../services/productService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

import MenuSelector from './menu/MenuSelector';
import MenuSettings from './menu/MenuSettings';
import MenuItemGrid from './menu/MenuItemGrid';
import MenuDialog from './menu/MenuDialog';
import MenuItemDialog from './menu/MenuItemDialog';

import {
  emptyItemForm,
  emptyMenuForm,
  getDefaultPlacement,
  needsTarget,
  needsUrl,
  placementByLocation,
} from './menu/constants';
import { flattenCategories, flattenItems, formatValidationError } from './menu/utils';

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
  const [selectedIds, setSelectedIds] = useState([]);
  const [pages, setPages] = useState([]);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const { notify, confirm } = useNotification();
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
          PageService.adminGetPages({ page: 1, limit: 1000, status: 'published' }),
          getCategories(),
          getProducts({ page: 1, limit: 1000, status: 'published' }),
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
      alignment: menu.alignment || 'left',
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
        alignment: selectedMenu.alignment,
        isActive: selectedMenu.isActive,
        sortOrder: selectedMenu.sortOrder,
      });

      notify('Menu settings updated.', 'success');
      const previousId = selectedMenuId;
      await fetchMenus();
      // If the ID didn't change, fetchMenus won't trigger the useEffect, so we refresh manually
      if (previousId === selectedMenuId) {
        fetchSelectedMenu();
      }

    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to update menu.'), 'error');
    }
  };

  const deleteSelectedMenu = async () => {
    if (!selectedMenu || !(await confirm('Delete Menu', `Delete "${selectedMenu.name}"?`, 'danger'))) return;
    try {
      await MenuService.adminDeleteMenu(selectedMenu.id);
      notify('Menu deleted.', 'success');
      setSelectedMenuId('');
      fetchMenus('');
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
    } : { ...emptyItemForm, placement: getDefaultPlacement(selectedMenu?.location), sortOrder: rows.length * 10 });
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

    if (!payload.label) throw new Error('Label is required.');
    if (needsUrl(targetType) && !payload.url) throw new Error('URL is required for this link type.');
    if (needsTarget(targetType) && !payload.targetId) throw new Error('Please choose a target.');

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
    if (!selectedMenu || !(await confirm('Delete Menu Item', `Delete "${item.label}" and its children?`, 'danger'))) return;
    try {
      await MenuService.adminDeleteMenuItem(selectedMenu.id, item.id);
      notify(`"${item.label}" deleted.`, 'success', {
        label: 'Undo',
        callback: async () => {
          try {
            await MenuService.adminRestoreMenuItem(selectedMenu.id, item.id);
            notify('Item restored.', 'success');
            fetchSelectedMenu();
          } catch (error) {
            notify('Failed to restore item.', 'error');
          }
        }
      });
      fetchSelectedMenu();
    } catch (error) {
      notify(formatValidationError(error, 'Failed to delete menu item.'), 'error');
    }

  };


  const bulkDeleteItems = async () => {
    if (!selectedMenu || selectedIds.length === 0 || !(await confirm('Bulk Delete', `Delete ${selectedIds.length} items and their children?`, 'danger'))) return;
    setLoading(true);
    try {
      await MenuService.adminBulkDeleteMenuItems(selectedMenu.id, selectedIds);
      notify(`Deleted ${selectedIds.length} items.`, 'success');
      setSelectedIds([]);
      fetchSelectedMenu();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to delete items.'), 'error');
      fetchSelectedMenu();
    } finally {
      setLoading(false);
    }
  };


  const bulkMoveItems = async (targetMenuId) => {
    if (!selectedMenu || selectedIds.length === 0 || targetMenuId === selectedMenu.id) return;
    setLoading(true);
    try {
      await MenuService.adminMoveMenuItems(selectedIds, targetMenuId);
      notify(`Moved ${selectedIds.length} items to the target menu.`, 'success');
      setSelectedIds([]);
      fetchSelectedMenu();
    } catch (error) {
      notify('Failed to move items.', 'error');
      fetchSelectedMenu();
    } finally {
      setLoading(false);
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

  const basePlacementOptions = placementByLocation[selectedMenu?.location || menuForm.location] || placementByLocation.header;
  const placementOptions = itemForm.placement && !basePlacementOptions.some((option) => option.value === itemForm.placement)
    ? [...basePlacementOptions, { value: itemForm.placement, label: `Current: ${itemForm.placement}` }]
    : basePlacementOptions;

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Menu Builder</Typography>
        {canManage && (
          <Button variant="contained" onClick={() => openMenuDialog()}>New Menu</Button>
        )}
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <MenuSelector 
            menus={menus} 
            selectedMenuId={selectedMenuId} 
            setSelectedMenuId={setSelectedMenuId} 
            onRefresh={fetchMenus}
          />
        </Grid>


        <Grid item xs={12} md={9}>
          <MenuSettings
            selectedMenu={selectedMenu}
            setSelectedMenu={setSelectedMenu}
            canManage={canManage}
            saveSelectedMenu={saveSelectedMenu}
            deleteSelectedMenu={deleteSelectedMenu}
          />

          <MenuItemGrid
            rows={rows}
            loading={loading}
            canManage={canManage}
            selectedMenu={selectedMenu}
            menus={menus}
            openItemDialog={openItemDialog}
            nudgeItem={nudgeItem}
            deleteItem={deleteItem}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            bulkDeleteItems={bulkDeleteItems}
            bulkMoveItems={bulkMoveItems}
            onRefresh={fetchSelectedMenu}
          />


        </Grid>
      </Grid>

      <MenuDialog
        open={menuDialogOpen}
        onClose={() => setMenuDialogOpen(false)}
        menuForm={menuForm}
        setMenuForm={setMenuForm}
        onSave={saveMenu}
      />

      <MenuItemDialog
        open={itemDialogOpen}
        onClose={() => setItemDialogOpen(false)}
        editingItem={editingItem}
        itemForm={itemForm}
        setItemForm={setItemForm}
        parentOptions={parentOptions}
        targetOptions={targetOptions}
        placementOptions={placementOptions}
        onSave={saveItem}
        selectedMenu={selectedMenu}
      />

    </Box>
  );
};

export default MenuBuilderPage;
