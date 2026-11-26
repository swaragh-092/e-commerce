import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, TextField,
  FormControl, InputLabel, Select, MenuItem, Stack, Tooltip,
  Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  DialogContentText, InputAdornment, Paper, FormHelperText,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import ResponsiveDataGrid from '../../components/admin/ResponsiveDataGrid';
import {
  Add as AddIcon, AddCircle as AddCircleIcon, Edit as EditIcon, Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon, Clear as ClearIcon,
  RemoveCircle as RemoveCircleIcon, DeleteSweep as DeleteSweepIcon, Download as DownloadIcon, EditNote as EditNoteIcon,
  Inventory as InventoryIcon, History as HistoryIcon,
  LocalOffer as LocalOfferIcon,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts, getProductById, deleteProduct, updateProduct, bulkUpdateSale, bulkDeleteProducts, bulkUpdateProducts, getStockHistory } from '../../services/productService';
import attributeService from '../../services/attributeService';
import BulkProductTagsDialog from '../../components/admin/BulkProductTagsDialog';
import ProductTagFilter from '../../components/admin/ProductTagFilter';
import { getBrands } from '../../services/brandService';
import { getCategoryTree } from '../../services/categoryService';
import { getSaleLabels } from '../../services/adminService';
import { getMediaUrl } from '../../utils/media';
import { getVariantOptionLabel } from '../../utils/variantOptions';
import { useCurrency, useSettings, useFeature, useFeatureVisible } from '../../hooks/useSettings';
import { useNotification } from '../../context/NotificationContext';
import { formatSaleDateTime, isEndingSoon } from '../../utils/pricing';
import { useAuth } from '../../hooks/useAuth';
import useAdminListQuery from '../../hooks/useAdminListQuery';
import useAdminListSearch from '../../hooks/useAdminListSearch';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatOpenEndedDateRange, toDateTimeLocal, formatDateOnly } from '../../utils/dates';
import {
  PRODUCT_STOREFRONT_STATES,
  PRODUCT_STOREFRONT_STATE_LABELS,
  getProductStorefrontFields,
  getProductStorefrontState,
  getProductStorefrontStateHelp,
} from '../../utils/productStorefrontState';

const STOREFRONT_BASE = (import.meta.env.VITE_APP_URL || window.location.origin);
const normalizeInventoryThreshold = (threshold) => {
  if (threshold === undefined || threshold === null || threshold === '') return 10;
  const parsed = Number(threshold);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
};
const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

const ProductsManagePage = () => {
  const navigate = useNavigate();
  const { params: searchParams, updateQuery, paginationModel, setPaginationModel, returnTo } = useAdminListQuery(20, 100);
  const { symbol, formatPrice } = useCurrency();
  const { settings } = useSettings();
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const isCompactScreen = useMediaQuery('(max-width: 1440px)');
  const isTabletScreen = useMediaQuery('(max-width: 1024px)');
  const isSmallScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const pricingEnabled = useFeatureVisible('pricing', 'admin');
  const brandsEnabled = useFeatureVisible('brands', 'admin');
  const pricingCapability = useFeature('pricing');
  // Stock tracking is only meaningful in ecommerce mode (cart Tier-1 feature).
  // In catalog mode cart=false, so we hide stock column + stepper entirely.
  const cartEnabled = useFeatureVisible('cart', 'admin');
  const sales = settings?.sales || {};
  const lowStockThreshold = normalizeInventoryThreshold(settings?.catalog?.lowStockThreshold);
  const canCreateProducts = hasPermission(PERMISSIONS.PRODUCTS_CREATE);
  const canUpdateProducts = hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canDeleteProducts = hasPermission(PERMISSIONS.PRODUCTS_DELETE);
  const canBulkSaleProducts = hasPermission(PERMISSIONS.PRODUCTS_BULK_SALE);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(-1);
  const [loading, setLoading] = useState(true);

  const search = searchParams.get('search') || '';
  const requestVersion = useRef(0);
  const { searchInput, setSearchInput, applySearch } = useAdminListSearch(search, updateQuery, 400);
  const status = searchParams.get('status') || '';
  const saleFilter = pricingEnabled ? searchParams.get('saleStatus') || '' : '';
  const categoryFilter = searchParams.get('category') || '';
  const brandFilter = brandsEnabled ? searchParams.get('brand') || '' : '';
  const tagFilter = searchParams.get('tags') || '';
  const lowStockOnly = searchParams.get('stock') === 'low';
  const [brands, setBrands] = useState([]);
  const [flatCategories, setFlatCategories] = useState([]);
  const [saleLabels, setSaleLabels] = useState([]);
  const selectedCategory = flatCategories.find((category) => category.id === categoryFilter);
  const selectedBrand = brands.find((brand) => brand.id === brandFilter);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [tagEditIds, setTagEditIds] = useState(null);

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '', bulk: false });

  // Server-side sorting
  const sortBy = searchParams.get('sortBy');
  const sortOrder = searchParams.get('sortOrder');
  const sortModel = useMemo(() => (
    ['name', 'price', 'quantity', 'updatedAt'].includes(sortBy) && ['asc', 'desc'].includes(sortOrder)
      ? [{ field: sortBy, sort: sortOrder }]
      : []
  ), [sortBy, sortOrder]);

  // Quick-edit dialog (stock + MRP + sale + storefront state)
  const [editDialog, setEditDialog] = useState({
    open: false,
    row: null,
    name: '',
    slug: '',
    quantity: '',
    variantStocks: {},
    userEditedVariantIds: {},
    loadingVariants: false,
    price: '',
    salePrice: '',
    saleEnabled: false,
    saleStartAt: '',
    saleEndAt: '',
    saleLabel: '',
    storefrontState: PRODUCT_STOREFRONT_STATES.DRAFT,
    saving: false,
  });
  const [bulkSaleDialog, setBulkSaleDialog] = useState({
    open: false,
    mode: 'apply',
    saleType: 'percentage',
    value: '',
    saleLabel: '',
    saleStartAt: '',
    saleEndAt: '',
    saving: false,
  });
  const [counts, setCounts] = useState({ published: 0, paused: 0, draft: 0, archived: 0 });
  const hasActiveFilters = Boolean(searchInput || search || status || saleFilter || categoryFilter || brandFilter || tagFilter || lowStockOnly);

  // Step amount for the stock stepper — persists between quick-edit opens
  // Stock history dialog
  const [stockHistoryDialog, setStockHistoryDialog] = useState({ open: false, productId: null, productName: '', rows: [], loading: false, page: 1, total: 0, typeFilter: '' });
  const openStockHistory = async (productId, productName) => {
    setStockHistoryDialog({ open: true, productId, productName, rows: [], loading: true, page: 1, total: 0, typeFilter: '' });
    try {
      const res = await getStockHistory(productId, { page: 1, limit: 20 });
      setStockHistoryDialog((s) => ({ ...s, rows: res?.data || [], total: res?.meta?.total || 0, loading: false }));
    } catch { setStockHistoryDialog((s) => ({ ...s, loading: false })); }
  };
  const fetchStockHistoryPage = async (page, typeFilter) => {
    setStockHistoryDialog((s) => ({ ...s, loading: true, page }));
    try {
      const params = { page, limit: 20 };
      if (typeFilter) params.type = typeFilter;
      const res = await getStockHistory(stockHistoryDialog.productId, params);
      setStockHistoryDialog((s) => ({ ...s, rows: res?.data || [], total: res?.meta?.total || 0, loading: false }));
    } catch { setStockHistoryDialog((s) => ({ ...s, loading: false })); }
  };
  const openEditDialog = (row) => {
    if (!canUpdateProducts) {
      notify('You do not have permission to update products.', 'error');
      return;
    }

    const initialVariantStocks = {};
    (row.variants || []).forEach((v) => {
      initialVariantStocks[v.id] = v.stockQty ?? 0;
    });

    const isVariable = Boolean(row.variants?.length > 0 || row.hasVariants || row.type === 'variable');
    const needsFetch = isVariable && (!row.variants || row.variants.length === 0 || !row.variants.some((v) => v.optionLabel || v.options?.length > 0));

    setEditDialog({
      open: true,
      row,
      name: row.name || '',
      slug: row.slug || '',
      quantity: row.quantity,
      variantStocks: initialVariantStocks,
      userEditedVariantIds: {},
      loadingVariants: needsFetch,
      price: row.price,
      salePrice: row.salePrice ?? '',
      saleEnabled: row.salePrice !== null && row.salePrice !== undefined && row.salePrice !== '',
      saleStartAt: toDateTimeLocal(row.saleStartAt),
      saleEndAt: toDateTimeLocal(row.saleEndAt),
      saleLabel: row.saleLabel || '',
      storefrontState: getProductStorefrontState(row),
      saving: false,
    });

    if (isVariable) {
      getProductById(row.id)
        .then((fullProduct) => {
          const fetchedVariants = fullProduct?.data?.variants || fullProduct?.variants;
          if (Array.isArray(fetchedVariants) && fetchedVariants.length > 0) {
            setEditDialog((prev) => {
              if (prev.row?.id !== row.id) return prev;
              const mergedVariantStocks = { ...prev.variantStocks };
              fetchedVariants.forEach((v) => {
                // If user hasn't explicitly edited this variant, refresh it with the latest fetched stockQty
                if (!prev.userEditedVariantIds?.[v.id]) {
                  mergedVariantStocks[v.id] = v.stockQty ?? 0;
                }
              });
              return {
                ...prev,
                variantStocks: mergedVariantStocks,
                loadingVariants: false,
                row: {
                  ...prev.row,
                  variants: fetchedVariants,
                },
              };
            });
          } else {
            setEditDialog((prev) => (prev.row?.id === row.id ? { ...prev, loadingVariants: false } : prev));
          }
        })
        .catch(() => {
          setEditDialog((prev) => (prev.row?.id === row.id ? { ...prev, loadingVariants: false } : prev));
        });
    }
  };

  const handleVariantStockChange = (variantId, newQty) => {
    setEditDialog((prev) => ({
      ...prev,
      variantStocks: {
        ...prev.variantStocks,
        [variantId]: newQty,
      },
      userEditedVariantIds: {
        ...prev.userEditedVariantIds,
        [variantId]: true,
      },
    }));
  };

  const handleVariantStockStep = (variantId, delta, minQty = 0) => {
    setEditDialog((prev) => {
      const raw = prev.variantStocks[variantId];
      const num = Number(raw);
      const base = Number.isFinite(num) ? Math.floor(num) : 0;
      const next = Math.max(minQty, base + delta);
      return {
        ...prev,
        variantStocks: {
          ...prev.variantStocks,
          [variantId]: next,
        },
        userEditedVariantIds: {
          ...prev.userEditedVariantIds,
          [variantId]: true,
        },
      };
    });
  };

  const handleQuickSave = async () => {
    if (!canUpdateProducts) {
      notify('You do not have permission to update products.', 'error');
      return;
    }

    setEditDialog((s) => ({ ...s, saving: true }));
    try {
      const hasVariants = editDialog.row?.variants?.length > 0;
      let updatedVariants = editDialog.row?.variants || [];

      // 1. If product has variants, update modified variant stocks
      if (hasVariants) {
        const dirtyVariants = updatedVariants.filter((variant) => {
          if (!editDialog.userEditedVariantIds?.[variant.id]) return false;
          const editedVal = editDialog.variantStocks[variant.id];
          return editedVal !== undefined && Number(editedVal) !== Number(variant.stockQty ?? 0);
        });

        if (dirtyVariants.length > 0) {
          for (const variant of dirtyVariants) {
            const nextQty = Number(editDialog.variantStocks[variant.id] || 0);
            await attributeService.updateProductVariant(editDialog.row.id, variant.id, {
              stockQty: nextQty,
            });
          }
          updatedVariants = updatedVariants.map((v) => {
            const editedVal = editDialog.variantStocks[v.id];
            return editedVal !== undefined ? { ...v, stockQty: Number(editedVal) } : v;
          });
        }
      }

      // 2. Compute updated total product quantity
      const newTotalQuantity = hasVariants
        ? updatedVariants.filter((v) => v.isActive !== false).reduce((sum, v) => sum + Number(v.stockQty || 0), 0)
        : (parseInt(editDialog.quantity, 10) || 0);

      // 3. Update top-level product attributes (name, slug, price, sale, storefront state)
      const payload = {
        name: editDialog.name.trim(),
        slug: editDialog.slug.trim(),
        ...(cartEnabled && !hasVariants && { quantity: parseInt(editDialog.quantity, 10) || 0 }),
        ...(pricingCapability && { price: parseFloat(editDialog.price) }),
        ...getProductStorefrontFields(editDialog.storefrontState),
        ...(pricingEnabled ? (editDialog.saleEnabled && editDialog.salePrice !== ''
          ? {
              salePrice: parseFloat(editDialog.salePrice),
              saleStartAt: toIsoOrNull(editDialog.saleStartAt),
              saleEndAt: toIsoOrNull(editDialog.saleEndAt),
              saleLabel: editDialog.saleLabel || null,
            }
          : { salePrice: null, saleStartAt: null, saleEndAt: null, saleLabel: null }) : {}),
      };

      await updateProduct(editDialog.row.id, payload);

      setRows((prev) => prev.map((r) => r.id === editDialog.row.id ? {
        ...r,
        ...payload,
        quantity: newTotalQuantity,
        variants: updatedVariants,
        effectivePrice: pricingEnabled ? (payload.salePrice ?? payload.price) : r.effectivePrice,
        isSaleActive: pricingEnabled ? (!!payload.salePrice && (!payload.saleStartAt || new Date(payload.saleStartAt) <= new Date()) && (!payload.saleEndAt || new Date(payload.saleEndAt) >= new Date())) : r.isSaleActive,
      } : r));

      notify('Product and stock updated successfully.', 'success');
      setEditDialog((s) => ({ ...s, open: false }));
      fetchProducts();
    } catch (err) {
      notify(`Failed to update: ${getApiErrorMessage(err)}`, 'error');
      setEditDialog((s) => ({ ...s, saving: false }));
    }
  };

  const handleExportCSV = (products) => {
    const headers = ['Name', 'SKU', ...(pricingEnabled ? ['MRP', 'Sale Price'] : []), ...(cartEnabled ? ['Stock'] : []), 'Status'];
    const csvCell = (value) => {
      const text = String(value ?? '');
      const safe = /^\s*[=+@-]|^[\t\r\n]/.test(text) ? `'${text}` : text;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const csvRows = [headers.join(',')];
    products.forEach((r) => {
      const total = Number(r?.quantity || 0);
      const reserved = Number(r?.reservedQty || 0);
      const available = Math.max(0, total - reserved);
      csvRows.push([
        csvCell(r.name),
        csvCell(r.sku),
        ...(pricingEnabled ? [r.price, r.salePrice ?? ''] : []),
        ...(cartEnabled ? [available] : []),
        PRODUCT_STOREFRONT_STATE_LABELS[getProductStorefrontState(r)],
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load flat category list for the filter dropdown
  useEffect(() => {
    getCategoryTree().then((res) => {
      const tree = res?.data || [];
      const flat = [];
      const flatten = (arr, path = '') => {
        arr.forEach((c) => {
          const p = path ? `${path} › ${c.name}` : c.name;
          flat.push({ id: c.id, label: p });
          if (c.children?.length) flatten(c.children, p);
        });
      };
      flatten(tree);
      setFlatCategories(flat);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    getSaleLabels()
      .then((res) => {
        const fetchedLabels = res.data?.data || [];
        setSaleLabels(fetchedLabels.filter((label) => label.isActive !== false));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!brandsEnabled) return;
    let cancelled = false;

    const loadBrands = async () => {
      const limit = 1000;
      const brands = [];
      let page = 1;
      let totalPages;
      do {
        const { data } = await getBrands({ page, limit });
        if (cancelled) return;
        brands.push(...(data?.data || []));
        totalPages = data?.meta?.totalPages || 1;
        page += 1;
      } while (page <= totalPages);
      setBrands(brands);
    };

    loadBrands().catch(() => {
      if (!cancelled) setBrands([]);
    });
    return () => { cancelled = true; };
  }, [brandsEnabled]);

  const fetchProducts = useCallback(() => {
    const version = ++requestVersion.current;
    setLoading(true);
    const params = {
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      include: 'variants',
      ...(search && { search }),
      ...(status && { status }),
      ...(saleFilter && { saleStatus: saleFilter }),
      ...(categoryFilter && { categoryId: categoryFilter }),
      ...(brandFilter && { brand: brandFilter }),
      ...(tagFilter && { tags: tagFilter }),
      ...(sortModel[0] && { sortBy: sortModel[0].field, sortOrder: sortModel[0].sort }),
      // Low-stock filter: pass maxQty=lowStockThreshold so the server returns only low-stock items
      ...(lowStockOnly && { maxQty: lowStockThreshold }),
    };
    getProducts(params)
      .then((res) => {
        if (version !== requestVersion.current) return;
        setRows(res?.data || []);
        setTotal(res?.meta?.total || 0);
        setCounts(res?.counts || res?.meta?.counts || { published: 0, paused: 0, draft: 0, archived: 0 });
      })
      .catch((error) => { if (version === requestVersion.current) console.error(error); })
      .finally(() => { if (version === requestVersion.current) setLoading(false); });
  }, [paginationModel, search, status, saleFilter, categoryFilter, brandFilter, tagFilter, sortModel, lowStockOnly, lowStockThreshold]);

  useEffect(() => {
    setSelectedIds([]);
    fetchProducts();
    return () => { requestVersion.current += 1; };
  }, [fetchProducts]);

  const handleStatusChange = (status, lowStock = false) => {
    updateQuery({ status, stock: lowStock ? 'low' : null, page: null });
  };

  const clearFilters = () => applySearch('', { status: null, category: null, tags: null, stock: null, saleStatus: null, brand: null });

  const handleCategoryChange = (category) => updateQuery({ category, page: null });
  const handleTagChange = (tags) => updateQuery({ tags, page: null });
  const handleSaleFilterChange = (saleStatus) => updateQuery({ saleStatus, page: null });
  const handleBrandChange = (brand) => updateQuery({ brand, page: null });

  // ── Actions ─────────────────────────────────────────────────
  const confirmDelete = (id, name, bulk = false) => {
    if (!canDeleteProducts) {
      notify('You do not have permission to delete products.', 'error');
      return;
    }

    setDeleteDialog({ open: true, id, name, bulk });
  };

  const handleDelete = async () => {
    if (!canDeleteProducts) {
      notify('You do not have permission to delete products.', 'error');
      return;
    }

    const { id, bulk } = deleteDialog;
    setDeleteDialog({ open: false, id: null, name: '', bulk: false });
    try {
      if (bulk) {
        await bulkDeleteProducts(selectedIds);
        notify(`${selectedIds.length} products deleted successfully.`, 'success');
        setSelectedIds([]);
      } else {
        await deleteProduct(id);
        notify('Product deleted successfully.', 'success');
      }
      fetchProducts();
    } catch (err) {
      notify('Failed to delete: ' + err.message, 'error');
    }
  };

  const handleBulkStorefrontState = async (storefrontState) => {
    if (!canUpdateProducts) {
      notify('You do not have permission to update products.', 'error');
      return;
    }

    const storefrontFields = getProductStorefrontFields(storefrontState);
    try {
      await bulkUpdateProducts(selectedIds, storefrontFields);
      setRows((prev) =>
        prev.map((r) => selectedIds.includes(r.id) ? { ...r, ...storefrontFields } : r)
      );
      notify(`${selectedIds.length} products set to ${PRODUCT_STOREFRONT_STATE_LABELS[storefrontState]}.`, 'success');
      setSelectedIds([]);
      fetchProducts();
    } catch (err) {
      notify('Bulk update failed: ' + getApiErrorMessage(err), 'error');
    }
  };

  const handleChangeStorefrontState = async (row, storefrontState) => {
    if (!canUpdateProducts) {
      notify('You do not have permission to update products.', 'error');
      return;
    }

    const storefrontFields = getProductStorefrontFields(storefrontState);
    try {
      await updateProduct(row.id, storefrontFields);
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, ...storefrontFields } : r));
      notify(`Product storefront state set to ${PRODUCT_STOREFRONT_STATE_LABELS[storefrontState]}.`, 'success');
      fetchProducts();
    } catch (err) {
      notify(`Failed to update storefront state: ${getApiErrorMessage(err)}`, 'error');
    }
  };

  const handleBulkSale = async () => {
    if (!canBulkSaleProducts) {
      notify('You do not have permission to apply bulk sales.', 'error');
      return;
    }

    setBulkSaleDialog((s) => ({ ...s, saving: true }));
    try {
      const payload = bulkSaleDialog.mode === 'clear'
        ? { action: 'clear', productIds: selectedIds }
        : {
            action: 'apply',
            productIds: selectedIds,
            saleType: bulkSaleDialog.saleType,
            value: Number(bulkSaleDialog.value),
            saleLabel: bulkSaleDialog.saleLabel || null,
            saleStartAt: toIsoOrNull(bulkSaleDialog.saleStartAt),
            saleEndAt: toIsoOrNull(bulkSaleDialog.saleEndAt),
          };
      await bulkUpdateSale(payload);
      notify(
        bulkSaleDialog.mode === 'clear'
          ? 'Sale removed from selected products successfully.'
          : 'Sale applied to selected products successfully.',
        'success'
      );
      setBulkSaleDialog((s) => ({ ...s, open: false, saving: false }));
      setSelectedIds([]);
      fetchProducts();
    } catch (err) {
      notify(`Bulk sale update failed: ${getApiErrorMessage(err)}`, 'error');
      setBulkSaleDialog((s) => ({ ...s, saving: false }));
    }
  };

  const editPriceValue = Number(editDialog.price);
  const editSalePriceValue = editDialog.salePrice === '' ? null : Number(editDialog.salePrice);
  const hasInvalidPrice = pricingCapability && editDialog.open && (editDialog.price === '' || !Number.isFinite(editPriceValue) || editPriceValue <= 0);
  const hasInvalidSalePrice = pricingEnabled && editDialog.open && editDialog.saleEnabled && (
    editDialog.salePrice === '' ||
    !Number.isFinite(editSalePriceValue) ||
    editSalePriceValue < 0 ||
    editSalePriceValue >= editPriceValue
  );
  const hasValidEditDiscount = Boolean(
    editDialog.open &&
    editDialog.saleEnabled &&
    Number.isFinite(editPriceValue) &&
    editPriceValue > 0 &&
    editSalePriceValue !== null &&
    Number.isFinite(editSalePriceValue) &&
    editSalePriceValue > 0 &&
    editSalePriceValue < editPriceValue
  );
  const editDiscountAmount = hasValidEditDiscount ? editPriceValue - editSalePriceValue : 0;
  const editDiscountPercent = hasValidEditDiscount ? Math.round(((editPriceValue - editSalePriceValue) / editPriceValue) * 100) : 0;
  const isVariableProduct = Boolean(
    editDialog.row?.variants?.length > 0 ||
    editDialog.row?.hasVariants ||
    editDialog.row?.type === 'variable'
  );
  const minSimpleStockQty = Math.max(0, Number(editDialog.row?.reservedQty || 0));
  const numSimpleQuantity = Number(editDialog.quantity);
  const hasInvalidQuantity = cartEnabled && editDialog.open && !isVariableProduct && (
    editDialog.quantity === '' ||
    Number.isNaN(numSimpleQuantity) ||
    !Number.isInteger(numSimpleQuantity) ||
    numSimpleQuantity < minSimpleStockQty
  );
  const allVariants = editDialog.row?.variants || [];
  const activeVariants = allVariants.filter((v) => v.isActive !== false);
  const hasInvalidVariantQuantity = cartEnabled && editDialog.open && isVariableProduct && activeVariants.some((v) => {
    const qty = editDialog.variantStocks[v.id] !== undefined ? editDialog.variantStocks[v.id] : v.stockQty;
    if (qty === '' || qty === undefined || qty === null) return true;
    const num = Number(qty);
    if (Number.isNaN(num) || num < 0 || !Number.isInteger(num)) return true;
    if (Number(v.reservedQty || 0) > 0 && num < Number(v.reservedQty)) return true;
    return false;
  });
  const liveVariantTotalStock = activeVariants.reduce((sum, v) => {
    const qty = editDialog.variantStocks[v.id] !== undefined ? editDialog.variantStocks[v.id] : v.stockQty;
    const num = Number(qty);
    return sum + (Number.isNaN(num) || num < 0 || !Number.isInteger(num) ? 0 : num);
  }, 0);
  // Include reservations across all variants (active, inactive, and soft-deleted captured in row.reservedQty)
  const liveVariantReservedStock = Math.max(
    Number(editDialog.row?.reservedQty || 0),
    allVariants.reduce((sum, v) => sum + (Number(v.reservedQty) || 0), 0)
  );
  const liveVariantAvailableStock = Math.max(0, liveVariantTotalStock - liveVariantReservedStock);
  const hasInvalidSaleDates = Boolean(pricingEnabled && editDialog.open && editDialog.saleEnabled && editDialog.saleStartAt && editDialog.saleEndAt && new Date(editDialog.saleEndAt) <= new Date(editDialog.saleStartAt));
  const bulkSaleValue = Number(bulkSaleDialog.value);
  const hasInvalidBulkSale = bulkSaleDialog.mode === 'apply' && (
    !Number.isFinite(bulkSaleValue) ||
    bulkSaleValue <= 0 ||
    (bulkSaleDialog.saleType === 'percentage' && bulkSaleValue >= 100) ||
    (bulkSaleDialog.saleStartAt && bulkSaleDialog.saleEndAt && new Date(bulkSaleDialog.saleEndAt) <= new Date(bulkSaleDialog.saleStartAt))
  );
  const hasUnknownEditSaleLabel = Boolean(
    editDialog.saleLabel && !saleLabels.some((label) => label.id === editDialog.saleLabel)
  );

  // ── Columns ──────────────────────────────────────────────────
  const columns = [
    // 1. Thumbnail
    {
      field: 'images',
      headerName: '',
      width: 62,
      sortable: false,
      renderCell: ({ row }) => {
        const imgUrl = row.images?.[0]?.url ? getMediaUrl(row.images[0].url) : null;
        return (
          <Avatar
            src={imgUrl || undefined}
            variant="rounded"
            sx={{ width: 40, height: 40, bgcolor: 'action.selected', fontSize: '0.75rem', fontWeight: 700 }}
          >
            {!imgUrl && row.name?.[0]?.toUpperCase()}
          </Avatar>
        );
      },
    },
    // 2. Product name + SKU sub-line
    {
      field: 'name',
      headerName: 'Product',
      flex: 1,
      minWidth: isSmallScreen ? 150 : 220,
      maxWidth: 420,
      sortable: true,
      renderCell: ({ row }) => (
        <Box
          component={canUpdateProducts ? Link : 'div'}
          to={canUpdateProducts ? `/admin/products/${row.id}/edit` : undefined}
          state={canUpdateProducts ? { returnTo } : undefined}
          aria-label={canUpdateProducts ? `Edit ${row.name}` : undefined}
          title={canUpdateProducts ? `Edit ${row.name}` : undefined}
          onClick={canUpdateProducts ? (event) => event.stopPropagation() : undefined}
          sx={{
            py: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
            color: 'inherit',
            textDecoration: 'none',
            '&:hover .product-name-primary': { color: 'primary.main', textDecoration: 'underline' },
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
          }}
        >
          <Typography className="product-name-primary" variant="body2" fontWeight={600} noWrap lineHeight={1.4}>
            {row.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {row.sku ? `SKU: ${row.sku}` : <em style={{ opacity: 0.4 }}>No SKU</em>}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'storefrontState',
      headerName: 'Status',
      width: 130,
      sortable: false,
      renderCell: ({ row }) => {
        const state = getProductStorefrontState(row);
        const badge = (
          <Chip
            size="small"
            label={PRODUCT_STOREFRONT_STATE_LABELS[state]}
            color={{ published: 'success', paused: 'warning', draft: 'info', archived: 'default' }[state]}
            variant={state === 'archived' ? 'outlined' : 'filled'}
          />
        );
        if (!canUpdateProducts) return badge;
        return (
          <Select
            size="small"
            variant="standard"
            disableUnderline
            value={state}
            onChange={(event) => handleChangeStorefrontState(row, event.target.value)}
            renderValue={() => badge}
            SelectDisplayProps={{
              'aria-label': 'Status for ' + row.name,
              'aria-description': getProductStorefrontStateHelp(state),
            }}
            sx={{ '& .MuiSelect-select': { py: 0.5 } }}
          >
            {Object.values(PRODUCT_STOREFRONT_STATES).map((option) => (
              <MenuItem key={option} value={option}>{PRODUCT_STOREFRONT_STATE_LABELS[option]}</MenuItem>
            ))}
          </Select>
        );
      },
    },
    {
      field: 'categories',
      headerName: 'Category',
      flex: 1,
      minWidth: 145,
      sortable: false,
      renderCell: ({ row }) => {
        const names = (row.categories || []).map((category) => category.name).filter(Boolean).join(', ');
        return <Typography variant="body2" noWrap title={names || undefined}>{names || '—'}</Typography>;
      },
    },
    {
      field: 'updatedAt',
      headerName: 'Last updated',
      width: 145,
      renderCell: ({ row }) => formatDateOnly(row.updatedAt) || '—',
    },
    // 3. Merged price: sale price prominent + original struck-through
    {
      field: 'price',
      headerName: 'MRP',
      width: 160,
      sortable: true,
      renderCell: ({ row }) => (
        <Box
          component={canUpdateProducts ? Link : 'div'}
          to={canUpdateProducts ? `/admin/products/${row.id}/edit` : undefined}
          state={canUpdateProducts ? { returnTo } : undefined}
          aria-label={canUpdateProducts ? `Edit pricing and tax for ${row.name}` : undefined}
          title={canUpdateProducts ? `Edit ${row.name}` : undefined}
          onClick={canUpdateProducts ? (event) => event.stopPropagation() : undefined}
          sx={{
            py: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            pointerEvents: canUpdateProducts ? 'auto' : 'none',
            color: 'inherit',
            textDecoration: 'none',
            borderRadius: 0.5,
            '&:hover .product-price-primary': { textDecoration: 'underline', color: 'primary.main' },
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
          }}
        >
          <Typography
            className="product-price-primary"
            variant="body2"
            fontWeight={700}
            color={pricingEnabled && row.isSaleActive ? 'error.main' : 'text.primary'}
          >
            {formatPrice(pricingEnabled && (row.effectivePrice ?? row.salePrice) ? (row.effectivePrice ?? row.salePrice) : row.price)}
            {row.unit ? ` / ${row.unit}` : ''}
          </Typography>

          {pricingEnabled && row.salePrice && (
            <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through', display: 'block' }}>
              {formatPrice(row.price)}
            </Typography>
          )}
          {pricingEnabled && row.saleStatus && row.saleStatus !== 'none' && (
            <Typography variant="caption" color={row.saleStatus === 'active' ? 'error.main' : 'text.secondary'} sx={{ display: 'block' }}>
              {row.saleStatus === 'active' ? 'Active sale' : row.saleStatus === 'scheduled' ? 'Scheduled sale' : 'Expired sale'}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'saleMeta',
      headerName: 'Sale',
      width: 220,
      sortable: false,
      renderCell: ({ row }) => {
        if (!row.salePrice) {
          return <Typography variant="caption" color="text.secondary">No sale</Typography>;
        }

        const endingSoon = row.saleStatus === 'active' && isEndingSoon(row.saleEndAt, sales.endingSoonHours);

        return (
          <Box sx={{ py: 1 }}>
            <Stack spacing={0.5} sx={{ mb: 0.25, alignItems: 'flex-start' }}>
              <Stack direction="row" spacing={0.5}>
                <Chip
                  size="small"
                  label={row.saleStatus === 'active' ? 'Active' : row.saleStatus === 'scheduled' ? 'Scheduled' : 'Expired'}
                  color={row.saleStatus === 'active' ? 'error' : row.saleStatus === 'scheduled' ? 'warning' : 'default'}
                />
                {!!row.discountPercent && <Chip size="small" variant="outlined" label={`${row.discountPercent}% OFF`} />}
              </Stack>
              {endingSoon && <Chip size="small" color="warning" label="Ending Soon" />}
            </Stack>
            {row.saleLabel && (
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }} noWrap>
                {row.saleLabel}
              </Typography>
            )}
            {row.saleStartAt && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                Starts {formatSaleDateTime(row.saleStartAt)}
              </Typography>
            )}
            {row.saleEndAt && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                Ends {formatSaleDateTime(row.saleEndAt)}
              </Typography>
            )}
          </Box>
        );
      },
    },
    // 4. Stock with color-coded badge
    {
      field: 'quantity',
      headerName: 'Stock',
      width: 120,
      sortable: true,
      renderCell: ({ row }) => {
        const total = Number(row?.quantity || 0);
        const reserved = Number(row?.reservedQty || 0);
        const available = Math.max(0, total - reserved);
        const color = available === 0 ? 'error' : available <= lowStockThreshold ? 'warning' : 'success';
        const isVariable = Boolean(row?.variants?.length > 0 || row?.hasVariants || row?.type === 'variable');
        const variantCount = row?.variants?.length;
        const tooltipTitle = isVariable && variantCount > 0
          ? `${variantCount} variant${variantCount === 1 ? '' : 's'} · Available: ${available} | Total: ${total} | Reserved: ${reserved}`
          : `Available: ${available} | Total: ${total} | Reserved: ${reserved}`;
        return (
          <Tooltip title={tooltipTitle}>
            <Chip
              label={row.unit ? `${available} ${row.unit}` : available}
              size="small"
              color={color}
              variant={available === 0 ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, minWidth: 54 }}
            />
          </Tooltip>
        );
      },
    },
    // 6. Actions: quick-edit | edit | view on storefront | delete
    {
      field: 'actions',
      headerName: '',
      width: 140,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.25}>
          {canUpdateProducts && (
            <Tooltip title="Quick edit stock, pricing and storefront state">
              <IconButton size="small" color="primary" onClick={() => openEditDialog(row)}>
                <EditNoteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canUpdateProducts && (
            <Tooltip title="Edit product">
              <IconButton size="small" onClick={() => navigate(`/admin/products/${row.id}/edit`, { state: { returnTo } })}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="View on storefront">
            <IconButton
              size="small"
              component="a"
              href={`${STOREFRONT_BASE}/products/${row.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canDeleteProducts && (
            <Tooltip title="Delete product">
              <IconButton size="small" color="error" onClick={() => confirmDelete(row.id, row.name)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ].filter(col => {
    if (col.field === 'price' && !pricingEnabled) return false;
    if (col.field === 'saleMeta' && !pricingEnabled) return false;
    // Hide the Stock column in catalog mode — inventory is irrelevant without a cart
    if (col.field === 'quantity' && !cartEnabled) return false;
    return true;
  });

  const EmptyProductsOverlay = () => (
    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: '100%', minHeight: 240, px: 3, textAlign: 'center' }}>
      <Avatar sx={{ width: 64, height: 64, bgcolor: 'action.hover', color: 'text.disabled' }}>
        <InventoryIcon />
      </Avatar>
      <Box>
        <Typography variant="h6" fontWeight={700}>
          {hasActiveFilters ? 'No products match these filters' : 'No products yet'}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 360 }}>
          {hasActiveFilters
            ? 'Try clearing filters or changing your search to find more products.'
            : 'Create your first product to start building the catalog.'}
        </Typography>
      </Box>
      {hasActiveFilters ? (
        <Button
          variant="outlined"
          onClick={clearFilters}
        >
          Clear filters
        </Button>
      ) : canCreateProducts ? (
        <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/admin/products/new" state={{ returnTo }}>
          Add first product
        </Button>
      ) : null}
    </Stack>
  );

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: { xs: 1.5, sm: 2 },
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h5" component="h1" fontWeight={700}>Products</Typography>
          <Typography role="status" variant="body2" color="text.secondary">
            {loading ? 'Loading products…' : `${total} ${total === 1 ? 'product' : 'products'} ${hasActiveFilters ? 'found' : 'total'}`}
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            flexWrap: 'wrap',
            rowGap: 1,
          }}
        >
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleExportCSV(rows)} disabled={loading || rows.length === 0}>
            Export current page CSV
          </Button>
          {canCreateProducts && (
            <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/admin/products/new" state={{ returnTo }}>
              Add Product
            </Button>
          )}
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" mb={2} role="group" aria-label="Quick filters">
        {[
          { label: 'All', value: '', count: Object.values(PRODUCT_STOREFRONT_STATES).reduce((sum, state) => sum + (counts[state] || 0), 0) },
          { label: 'Published', value: 'published', count: counts.published },
          { label: 'Paused', value: 'paused', count: counts.paused },
          { label: 'Drafts', value: 'draft', count: counts.draft },
          ...(cartEnabled || lowStockOnly ? [{
            label: 'Low Stock',
            value: '',
            lowStock: true,
            count: lowStockOnly ? total : counts.lowStock,
          }] : []),
        ].map(({ label, value, lowStock = false, count }) => {
          const active = status === value && lowStockOnly === lowStock;
          return (
            <Button
              key={label} size="small" aria-pressed={active}
              variant={active ? 'contained' : 'outlined'} color={active ? 'primary' : 'inherit'}
              onClick={() => handleStatusChange(value, lowStock)}
            >
              {label}{!loading && count != null ? ` (${count})` : ''}
            </Button>
          );
        })}
      </Stack>

      {/* ── Filters ── */}
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" alignItems="center" useFlexGap sx={{ rowGap: 1.5 }}>
        <TextField
          size="small"
          label="Search products by name or SKU"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ width: { xs: '100%', sm: 285 } }}
          InputLabelProps={{ shrink: true }}
          InputProps={{
            endAdornment: searchInput ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Clear search" onClick={() => applySearch('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <FormControl size="small" sx={{ minWidth: 140, flexShrink: 0 }}>
          <InputLabel id="storefront-state-filter-label" shrink>Status</InputLabel>
          <Select
            value={status}
            labelId="storefront-state-filter-label"
            label="Status"
            displayEmpty
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="published">Published</MenuItem>
            <MenuItem value="paused">Paused</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
          </Select>
        </FormControl>
        {pricingEnabled && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="product-sale-filter-label" shrink>Sale</InputLabel>
            <Select
              value={saleFilter}
              label="Sale"
              labelId="product-sale-filter-label"
              displayEmpty
              onChange={(e) => handleSaleFilterChange(e.target.value)}
            >
              <MenuItem value="">All Sales</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
              <MenuItem value="none">No Sale</MenuItem>
            </Select>
          </FormControl>
        )}
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="category-filter-label" shrink>Category</InputLabel>
          <Select
            value={categoryFilter}
            labelId="category-filter-label"
            label="Category"
            displayEmpty
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <MenuItem value="">All Categories</MenuItem>
            {categoryFilter && !selectedCategory && <MenuItem value={categoryFilter}>Selected category</MenuItem>}
            {flatCategories.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {brandsEnabled && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="product-brand-filter-label" shrink>Brand</InputLabel>
            <Select
              labelId="product-brand-filter-label"
              label="Brand"
              value={brandFilter}
              displayEmpty
              onChange={(event) => handleBrandChange(event.target.value)}
            >
              <MenuItem value="">All Brands</MenuItem>
              {brandFilter && !selectedBrand && <MenuItem value={brandFilter}>Selected brand</MenuItem>}
              {brands.map((brand) => (
                <MenuItem key={brand.id} value={brand.id}>{brand.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <ProductTagFilter value={tagFilter} onChange={handleTagChange} />
      </Stack>
      {hasActiveFilters && (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" mb={2} role="group" aria-label="Active filters">
          {search && <Chip size="small" label={`Search: ${search}`} onDelete={() => applySearch('')} />}
          {status && <Chip size="small" label={PRODUCT_STOREFRONT_STATE_LABELS[status] || status} onDelete={() => handleStatusChange('')} />}
          {lowStockOnly && <Chip size="small" label={`Stock ≤ ${lowStockThreshold}`} onDelete={() => handleStatusChange('')} />}
          {saleFilter && <Chip size="small" label={`Sale: ${saleFilter}`} onDelete={() => handleSaleFilterChange('')} />}
          {categoryFilter && <Chip size="small" label={selectedCategory?.label || 'Selected category'} onDelete={() => handleCategoryChange('')} />}
          {brandFilter && <Chip size="small" label={selectedBrand?.name || 'Selected brand'} onDelete={() => handleBrandChange('')} />}
          {tagFilter && <Chip size="small" label={`Tag: ${tagFilter}`} onDelete={() => handleTagChange('')} />}
          <Button size="small" onClick={clearFilters}>Clear all</Button>
        </Stack>
      )}

      {/* ── Bulk actions bar (only shown when rows are selected) ── */}
      {selectedIds.length > 0 && (
        <Paper
          elevation={0}
          role="group"
          aria-label="Selected product actions"
          sx={{
            mb: 1.5, px: 2, py: 1,
            display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            border: '1px solid', borderColor: 'primary.main',
            borderRadius: 2, bgcolor: 'primary.50',
          }}
        >
          <Typography variant="body2" fontWeight={600} color="primary.main">
            {selectedIds.length} selected
          </Typography>
          {canUpdateProducts && <Button size="small" onClick={() => handleBulkStorefrontState(PRODUCT_STOREFRONT_STATES.PUBLISHED)}>Publish</Button>}
          {canUpdateProducts && <Button size="small" onClick={() => handleBulkStorefrontState(PRODUCT_STOREFRONT_STATES.PAUSED)}>Pause</Button>}
          {canUpdateProducts && (
            <FormControl size="small" sx={{ minWidth: 135 }}>
              <InputLabel id="bulk-storefront-state-label">Set status</InputLabel>
              <Select
                labelId="bulk-storefront-state-label"
                label="Set status"
                value=""
                onChange={(event) => handleBulkStorefrontState(event.target.value)}
              >
                <MenuItem value="" disabled>Choose a state</MenuItem>
                {Object.values(PRODUCT_STOREFRONT_STATES).map((state) => (
                  <MenuItem key={state} value={state}>{PRODUCT_STOREFRONT_STATE_LABELS[state]}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {canUpdateProducts && <Button size="small" variant="outlined" startIcon={<LocalOfferIcon />} onClick={() => setTagEditIds([...selectedIds])}>Edit tags</Button>}
          {canDeleteProducts && (
            <Button
              size="small" variant="outlined" color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={() => confirmDelete(null, `${selectedIds.length} products`, true)}
            >
              Delete
            </Button>
          )}
          {pricingEnabled && sales.allowBulkSales !== false && canBulkSaleProducts && (
            <>
              <Button size="small" variant="outlined" onClick={() => { getSaleLabels().then((res) => setSaleLabels((res.data?.data || []).filter((l) => l.isActive !== false))).catch(() => {}); setBulkSaleDialog({ open: true, mode: 'apply', saleType: 'percentage', value: '', saleLabel: '', saleStartAt: '', saleEndAt: '', saving: false }); }}>
                Apply Sale
              </Button>
              <Button size="small" variant="outlined" color="warning" onClick={() => setBulkSaleDialog({ open: true, mode: 'clear', saleType: 'percentage', value: '', saleLabel: '', saleStartAt: '', saleEndAt: '', saving: false })}>
                Remove Sale
              </Button>
            </>
          )}
          <Button size="small" startIcon={<DownloadIcon />} disabled={loading || !rows.some((row) => selectedIds.includes(row.id))}
            onClick={() => handleExportCSV(rows.filter((row) => selectedIds.includes(row.id)))}>
            Export selected CSV
          </Button>
          <Button size="small" color="inherit" onClick={() => setSelectedIds([])}>
            Clear selection
          </Button>
        </Paper>
      )}

      {/* ── Data Grid ── */}
      <Box sx={{ 
        bgcolor: 'background.paper', 
        borderRadius: 2, 
        border: '1px solid', 
        borderColor: 'divider',
        minWidth: 0,
        width: '100%',
      }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          requiredColumns={['name', 'actions']}
          unavailableColumns={[...(!pricingEnabled ? ['price', 'saleMeta'] : []), ...(!cartEnabled ? ['quantity'] : [])]}
          columnVisibilityModel={{
            images: !isCompactScreen,
            price: pricingEnabled && !isTabletScreen,
            saleMeta: pricingEnabled && !isCompactScreen,
            quantity: cartEnabled && !isCompactScreen,
            storefrontState: !isSmallScreen,
            categories: !isTabletScreen,
            updatedAt: !isCompactScreen,
          }}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 20, 50, 100]}
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={([sort]) => updateQuery({ sortBy: sort?.field, sortOrder: sort?.sort, page: null })}
          checkboxSelection
          rowSelectionModel={selectedIds}
          onRowSelectionModelChange={(ids) => setSelectedIds(ids)}
          disableRowSelectionOnClick
          getRowHeight={() => 'auto'}
          getEstimatedRowHeight={() => 80}
          pagination
          autoHeight
          slots={{ noRowsOverlay: EmptyProductsOverlay }}
          sx={{
            border: 0,
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-overlayWrapper': {
              minHeight: 260,
            },
          }}
        />
      </Box>

      {/* ── Quick-Edit Dialog ── */}
      <Dialog
        open={editDialog.open}
        onClose={() => !editDialog.saving && setEditDialog((s) => ({ ...s, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle component="div" sx={{ pb: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              src={editDialog.row?.images?.[0]?.url ? getMediaUrl(editDialog.row.images[0].url) : undefined}
              variant="rounded"
              sx={{ width: 44, height: 44, bgcolor: 'action.selected', fontWeight: 700 }}
            >
              {editDialog.row?.name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700} noWrap>
                Quick Edit
              </Typography>
              <Typography variant="body2" fontWeight={600} noWrap>
                {editDialog.row?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {editDialog.row?.sku ? `SKU: ${editDialog.row.sku}` : 'No SKU'}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Product Name"
              size="small"
              fullWidth
              value={editDialog.name}
              onChange={(e) => setEditDialog((s) => ({ ...s, name: e.target.value }))}
            />
            <TextField
              label="Slug"
              size="small"
              fullWidth
              value={editDialog.slug}
              onChange={(e) => setEditDialog((s) => ({ ...s, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
              helperText="URL-friendly name (e.g. apple-iphone-15)"
            />
            {/* ── Stock Stepper — only in ecommerce mode (cart Tier-1 feature) ── */}
            {cartEnabled && (
            <Box>
              {isVariableProduct ? (
                /* ── Variant-managed stock: interactive quick edit ── */
                editDialog.loadingVariants ? (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center', bgcolor: 'action.hover' }}>
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        Loading variant stock...
                      </Typography>
                    </Stack>
                  </Paper>
                ) : (
                <>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                    Stock (managed by variants)
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        Total: {liveVariantTotalStock}
                      </Typography>
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        Available: {liveVariantAvailableStock}
                        {liveVariantReservedStock > 0 && (
                          <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 1, fontWeight: 500 }}>
                            ({liveVariantReservedStock} reserved)
                          </Typography>
                        )}
                      </Typography>
                    </Stack>
                    {activeVariants.length === 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', p: 1, textAlign: 'center' }}>
                        No active variants found. Manage variants on the product edit page.
                      </Typography>
                    ) : (
                      <Stack spacing={0.75} sx={{ maxHeight: 180, overflowY: 'auto', pr: 0.5 }}>
                        {activeVariants.map((v, index) => {
                          const optionText = v.optionLabel || getVariantOptionLabel(v) || (v.options?.map((o) => o.value?.value || o.value?.displayLabel || o.value).filter(Boolean).join(' / '));
                          const variantName = optionText && v.sku
                            ? `${optionText} (${v.sku})`
                            : (optionText || v.sku || `Variant #${index + 1}`);
                          const minQty = Math.max(0, Number(v.reservedQty || 0));
                          const currentQty = editDialog.variantStocks[v.id] !== undefined ? editDialog.variantStocks[v.id] : (v.stockQty ?? 0);
                          const isInvalid = currentQty === '' || Number.isNaN(Number(currentQty)) || Number(currentQty) < minQty || !Number.isInteger(Number(currentQty));

                          return (
                            <Stack
                              key={v.id}
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              spacing={1}
                              sx={{
                                py: 0.5,
                                px: 0.75,
                                borderRadius: 1,
                                bgcolor: 'background.paper',
                                border: '1px solid',
                                borderColor: isInvalid ? 'error.main' : 'divider',
                              }}
                            >
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Tooltip title={variantName}>
                                  <Typography variant="caption" fontWeight={600} color="text.primary" noWrap sx={{ display: 'block', maxWidth: 210 }}>
                                    {variantName}
                                  </Typography>
                                </Tooltip>
                                {isInvalid ? (
                                  <Typography variant="caption" color="error.main" sx={{ fontSize: '0.68rem', display: 'block', fontWeight: 600 }}>
                                    {currentQty === ''
                                      ? 'Quantity required'
                                      : Number.isNaN(Number(currentQty))
                                        ? 'Invalid number'
                                        : Number(currentQty) < minQty
                                          ? `Must be ≥ ${minQty} (reserved)`
                                          : !Number.isInteger(Number(currentQty))
                                            ? 'Must be a whole number'
                                            : 'Invalid quantity'}
                                  </Typography>
                                ) : Number(v.reservedQty) > 0 ? (
                                  <Typography variant="caption" color="warning.dark" sx={{ fontSize: '0.68rem', display: 'block' }}>
                                    {`${v.reservedQty} reserved`}
                                  </Typography>
                                ) : null}
                              </Box>
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Tooltip title={Number(currentQty) <= minQty && minQty > 0 ? `Cannot decrease below reserved stock (${minQty})` : 'Decrease stock'}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleVariantStockStep(v.id, -1, minQty)}
                                      disabled={Number(currentQty) <= minQty}
                                      sx={{
                                        p: 0.25,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        '&:hover': { borderColor: 'error.main', bgcolor: 'error.50' },
                                      }}
                                    >
                                      <RemoveCircleIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <TextField
                                  type="number"
                                  size="small"
                                  error={isInvalid}
                                  inputProps={{
                                    min: minQty,
                                    style: {
                                      textAlign: 'center',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      padding: '3px 4px',
                                      width: 44,
                                    },
                                  }}
                                  value={currentQty}
                                  onChange={(e) => handleVariantStockChange(v.id, e.target.value)}
                                  sx={{ width: 64 }}
                                />
                                <Tooltip title="Increase stock">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => handleVariantStockStep(v.id, 1)}
                                    sx={{
                                      p: 0.25,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      borderRadius: 1,
                                      '&:hover': { borderColor: 'success.main', bgcolor: 'success.50' },
                                    }}
                                  >
                                    <AddCircleIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </Stack>
                          );
                        })}
                      </Stack>
                    )}
                  </Paper>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Adjust stock quantities per variant directly above. For pricing and images, use the full product edit page.
                  </Typography>
                </>
                )
              ) : (
                /* ── Simple product: editable stock stepper ── */
                <>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Stock Quantity
                </Typography>
                <Typography variant="caption" color="text.secondary">—</Typography>
                <Typography variant="caption" color="text.secondary">
                  current:&nbsp;
                  <Box component="span" fontWeight={700} color="text.primary">
                    {editDialog.row?.quantity ?? 0}
                  </Box>
                  {Number(editDialog.row?.reservedQty || 0) > 0 && (
                    <>
                      &nbsp;(Available:&nbsp;
                      <Box component="span" fontWeight={700} color="success.main">
                        {Math.max(0, (editDialog.row?.quantity ?? 0) - (editDialog.row?.reservedQty ?? 0))}
                      </Box>
                      , Reserved:&nbsp;
                      <Box component="span" fontWeight={700} color="warning.main">
                        {editDialog.row?.reservedQty ?? 0}
                      </Box>
                      )
                    </>
                  )}
                </Typography>
              </Stack>

              {/* Decrement | Input | Increment row */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Tooltip title={Number(editDialog.quantity) <= minSimpleStockQty && minSimpleStockQty > 0 ? `Cannot decrease below reserved stock (${minSimpleStockQty})` : 'Decrease stock'}>
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() =>
                        setEditDialog((s) => ({
                          ...s,
                          quantity: Math.max(minSimpleStockQty, (Number(s.quantity) || 0) - 1),
                        }))
                      }
                      disabled={Number(editDialog.quantity) <= minSimpleStockQty}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1.5,
                        '&:hover': { borderColor: 'error.main', bgcolor: 'error.50' },
                      }}
                    >
                      <RemoveCircleIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <TextField
                  type="number"
                  size="small"
                  error={hasInvalidQuantity}
                  inputProps={{ min: minSimpleStockQty, style: { textAlign: 'center', fontWeight: 700, fontSize: '1rem', width: 64 } }}
                  value={editDialog.quantity}
                  onChange={(e) => setEditDialog((s) => ({ ...s, quantity: e.target.value }))}
                  sx={{ width: 96 }}
                />

                <Tooltip title="Increase stock">
                  <IconButton
                    size="small"
                    color="success"
                    onClick={() =>
                      setEditDialog((s) => ({
                        ...s,
                        quantity: (Number(s.quantity) || 0) + 1,
                      }))
                    }
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      '&:hover': { borderColor: 'success.main', bgcolor: 'success.50' },
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              {hasInvalidQuantity && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                  {numSimpleQuantity < minSimpleStockQty
                    ? `Stock cannot be less than reserved stock (${minSimpleStockQty}).`
                    : 'Quantity must be a valid non-negative integer.'}
                </Typography>
              )}
                </>
              )}
              <Button
                size="small"
                variant="text"
                startIcon={<HistoryIcon />}
                onClick={() => openStockHistory(editDialog.row.id, editDialog.row.name)}
                sx={{ mt: 1, alignSelf: 'flex-start' }}
              >
                View Stock History
              </Button>
            </Box>
            )}
            {pricingCapability && <TextField
              label="MRP"
              type="number"
              size="small"
              fullWidth
              error={hasInvalidPrice}
              helperText={hasInvalidPrice ? 'Enter a valid MRP.' : `Current MRP: ${formatPrice(editDialog.row?.price || 0)}`}
              InputProps={{
                startAdornment: <InputAdornment position="start">{formatPrice(0).replace(/0.00|0/g, '').trim() || '$'}</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: 0 }}
              value={editDialog.price}
              onChange={(e) => setEditDialog((s) => ({ ...s, price: e.target.value }))}
            />}
            {pricingEnabled && editDialog.row?.id && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: -1.25 }}>
                <Typography variant="caption" color="text.secondary">
                  Tax rates are managed with pricing in the full editor.
                </Typography>
                <Button
                  component={Link}
                  to={`/admin/products/${editDialog.row.id}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  size="small"
                >
                  Open Pricing &amp; Tax
                </Button>
              </Box>
            )}
            {pricingEnabled && (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 0.5 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>On Sale</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Turn this off to remove the sale price.
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant={editDialog.saleEnabled ? 'contained' : 'outlined'}
                    color={editDialog.saleEnabled ? 'error' : 'inherit'}
                    onClick={() => setEditDialog((s) => ({
                      ...s,
                      saleEnabled: !s.saleEnabled,
                      salePrice: !s.saleEnabled ? (s.salePrice === '' ? s.row?.salePrice ?? s.price : s.salePrice) : '',
                    }))}
                  >
                    {editDialog.saleEnabled ? 'Sale Enabled' : 'No Sale'}
                  </Button>
                </Stack>
                <TextField
                  label="Sale Price"
                  type="number"
                  size="small"
                  fullWidth
                  disabled={!editDialog.saleEnabled}
                  error={hasInvalidSalePrice}
                  helperText={
                    !editDialog.saleEnabled
                      ? 'Sale price is currently removed.'
                      : hasInvalidSalePrice
                        ? 'Sale price must be lower than the MRP.'
                        : hasValidEditDiscount
                          ? `Discount: ${formatPrice(editDiscountAmount)} (${editDiscountPercent}% OFF)`
                          : `Current sale price: ${editDialog.row?.salePrice ? formatPrice(editDialog.row.salePrice) : 'None'}`
                  }
                  FormHelperTextProps={{
                    sx: hasValidEditDiscount && !hasInvalidSalePrice && editDialog.saleEnabled
                      ? { color: 'success.main', fontWeight: 600 }
                      : {},
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">{formatPrice(0).replace(/0.00|0/g, '').trim() || '$'}</InputAdornment>,
                  }}
                  inputProps={{ step: '0.01', min: 0 }}
                  value={editDialog.salePrice}
                  onChange={(e) => setEditDialog((s) => ({ ...s, salePrice: e.target.value }))}
                />
                {hasValidEditDiscount && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 1.5,
                      py: 1,
                      borderRadius: 1.5,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.15)' : '#edf7ed',
                      border: '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.35)' : '#b7dfb9',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <LocalOfferIcon sx={{ fontSize: 16, color: 'success.main' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.dark', fontSize: '0.8125rem' }}>
                        Discount: {formatPrice(editDiscountAmount)}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${editDiscountPercent}% OFF`}
                      size="small"
                      color="success"
                      sx={{ fontWeight: 700, height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                )}
                <FormControl fullWidth size="small" disabled={!editDialog.saleEnabled}>
                  <InputLabel id="quick-edit-sale-label-select">Sale Label</InputLabel>
                  <Select
                    labelId="quick-edit-sale-label-select"
                    label="Sale Label"
                    value={editDialog.saleLabel}
                    onChange={(e) => setEditDialog((s) => ({ ...s, saleLabel: e.target.value }))}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {hasUnknownEditSaleLabel && (
                      <MenuItem value={editDialog.saleLabel} disabled>
                        {editDialog.saleLabel}
                      </MenuItem>
                    )}
                    {saleLabels.map((label) => (
                      <MenuItem key={label.id} value={label.id}>
                        {label.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {(() => {
                    const selected = saleLabels.find(l => l.id === editDialog.saleLabel);
                    const scheduleLabel = selected
                      ? formatOpenEndedDateRange(selected.startDate, selected.endDate)
                      : '';
                    if (scheduleLabel) {
                      return (
                        <FormHelperText sx={{ color: 'primary.main', fontWeight: 600 }}>
                          Global schedule: {scheduleLabel}
                        </FormHelperText>
                      );
                    }
                    return null;
                  })()}
                </FormControl>
                {sales.allowScheduling !== false && (
                  <>
                    <TextField
                      label="Sale Starts"
                      type="datetime-local"
                      size="small"
                      fullWidth
                      disabled={!editDialog.saleEnabled}
                      InputLabelProps={{ shrink: true }}
                      value={editDialog.saleStartAt}
                      onChange={(e) => setEditDialog((s) => ({ ...s, saleStartAt: e.target.value }))}
                    />
                    <TextField
                      label="Sale Ends"
                      type="datetime-local"
                      size="small"
                      fullWidth
                      disabled={!editDialog.saleEnabled}
                      error={hasInvalidSaleDates}
                      helperText={hasInvalidSaleDates ? 'Sale end must be after the start date.' : 'Leave blank for an open-ended sale'}
                      InputLabelProps={{ shrink: true }}
                      value={editDialog.saleEndAt}
                      onChange={(e) => setEditDialog((s) => ({ ...s, saleEndAt: e.target.value }))}
                    />
                  </>
                )}
              </>
            )}
            <FormControl fullWidth size="small" sx={{ pt: 0.5 }}>
              <InputLabel id="quick-edit-storefront-state-label">Storefront state</InputLabel>
              <Select
                value={editDialog.storefrontState}
                labelId="quick-edit-storefront-state-label"
                label="Storefront state"
                onChange={(event) => setEditDialog((current) => ({
                  ...current,
                  storefrontState: event.target.value,
                }))}
              >
                {Object.values(PRODUCT_STOREFRONT_STATES).map((state) => (
                  <MenuItem key={state} value={state}>{PRODUCT_STOREFRONT_STATE_LABELS[state]}</MenuItem>
                ))}
              </Select>
              <FormHelperText>{getProductStorefrontStateHelp(editDialog.storefrontState)}</FormHelperText>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialog((s) => ({ ...s, open: false }))} disabled={editDialog.saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleQuickSave}
            disabled={editDialog.saving || editDialog.loadingVariants || hasInvalidPrice || hasInvalidSalePrice || hasInvalidQuantity || hasInvalidVariantQuantity || hasInvalidSaleDates}
          >
            {editDialog.saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {canUpdateProducts && tagEditIds && <BulkProductTagsDialog
        productIds={tagEditIds}
        onClose={() => setTagEditIds(null)}
        onSaved={(result) => {
          notify(`Tags updated on ${result.updatedCount} of ${result.selectedCount} selected products.`, 'success');
          setTagEditIds(null);
          setSelectedIds([]);
          fetchProducts();
        }}
      />}

      {sales.allowBulkSales !== false && canBulkSaleProducts && <Dialog
        open={bulkSaleDialog.open}
        onClose={() => !bulkSaleDialog.saving && setBulkSaleDialog((s) => ({ ...s, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle fontWeight={700}>{bulkSaleDialog.mode === 'clear' ? 'Remove Sale' : `Apply Sale to ${selectedIds.length} Products`}</DialogTitle>
        <DialogContent>
          {bulkSaleDialog.mode === 'clear' ? (
            <DialogContentText>
              This removes the sale price, schedule, and label from all selected products while keeping their base MRP unchanged.
            </DialogContentText>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Discount Type</InputLabel>
                <Select
                  value={bulkSaleDialog.saleType}
                  label="Discount Type"
                  onChange={(e) => setBulkSaleDialog((s) => ({ ...s, saleType: e.target.value }))}
                >
                  <MenuItem value="percentage">Percentage Off</MenuItem>
                  <MenuItem value="fixed">Fixed Sale Price</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={bulkSaleDialog.saleType === 'percentage' ? 'Discount Percentage' : 'Sale Price'}
                type="number"
                size="small"
                fullWidth
                error={hasInvalidBulkSale}
                helperText={bulkSaleDialog.saleType === 'percentage' ? 'Use a value below 100.' : 'This value becomes each selected product’s sale price.'}
                InputProps={bulkSaleDialog.saleType === 'fixed' ? { startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> } : undefined}
                inputProps={{ min: 0, step: '0.01' }}
                value={bulkSaleDialog.value}
                onChange={(e) => setBulkSaleDialog((s) => ({ ...s, value: e.target.value }))}
              />
              <FormControl fullWidth size="small">
                <InputLabel id="bulk-sale-label-select">Sale Label</InputLabel>
                <Select
                  labelId="bulk-sale-label-select"
                  label="Sale Label"
                  value={bulkSaleDialog.saleLabel}
                  onChange={(e) => setBulkSaleDialog((s) => ({ ...s, saleLabel: e.target.value }))}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {saleLabels.map((label) => (
                    <MenuItem key={label.id} value={label.id}>
                      {label.name}
                    </MenuItem>
                  ))}
                </Select>
                {(() => {
                  const selected = saleLabels.find(l => l.id === bulkSaleDialog.saleLabel);
                  const scheduleLabel = selected
                    ? formatOpenEndedDateRange(selected.startDate, selected.endDate)
                    : '';
                  if (scheduleLabel) {
                    return (
                      <FormHelperText sx={{ color: 'primary.main', fontWeight: 600 }}>
                        Global schedule: {scheduleLabel}
                      </FormHelperText>
                    );
                  }
                  return null;
                })()}
              </FormControl>
              {sales.allowScheduling !== false && (
                <>
                  <TextField
                    label="Sale Starts"
                    type="datetime-local"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={bulkSaleDialog.saleStartAt}
                    onChange={(e) => setBulkSaleDialog((s) => ({ ...s, saleStartAt: e.target.value }))}
                  />
                  <TextField
                    label="Sale Ends"
                    type="datetime-local"
                    size="small"
                    fullWidth
                    error={!!bulkSaleDialog.saleStartAt && !!bulkSaleDialog.saleEndAt && new Date(bulkSaleDialog.saleEndAt) <= new Date(bulkSaleDialog.saleStartAt)}
                    helperText="Leave blank for an open-ended sale"
                    InputLabelProps={{ shrink: true }}
                    value={bulkSaleDialog.saleEndAt}
                    onChange={(e) => setBulkSaleDialog((s) => ({ ...s, saleEndAt: e.target.value }))}
                  />
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBulkSaleDialog((s) => ({ ...s, open: false }))} disabled={bulkSaleDialog.saving}>Cancel</Button>
          <Button variant="contained" color={bulkSaleDialog.mode === 'clear' ? 'warning' : 'primary'} onClick={handleBulkSale} disabled={bulkSaleDialog.saving || hasInvalidBulkSale}>
            {bulkSaleDialog.saving ? 'Saving…' : bulkSaleDialog.mode === 'clear' ? 'Remove Sale' : 'Apply Sale'}
          </Button>
        </DialogActions>
      </Dialog>}

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog((s) => ({ ...s, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle fontWeight={700}>
          Delete Product{deleteDialog.bulk ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteDialog.bulk
              ? `Permanently delete ${deleteDialog.name}? This cannot be undone.`
              : `Permanently delete "${deleteDialog.name}"? This cannot be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog((s) => ({ ...s, open: false }))}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Stock History Dialog ── */}
      <Dialog
        open={stockHistoryDialog.open}
        onClose={() => setStockHistoryDialog((s) => ({ ...s, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="div">
          <Typography variant="h6" fontWeight={700}>Stock History</Typography>
          <Typography variant="body2" color="text.secondary">{stockHistoryDialog.productName}</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            {['', 'ADJUSTMENT', 'RESERVE', 'RELEASE', 'SHIP', 'RETURN'].map((t) => (
              <Chip
                key={t || 'all'}
                label={t || 'All'}
                size="small"
                variant={stockHistoryDialog.typeFilter === t ? 'filled' : 'outlined'}
                color={stockHistoryDialog.typeFilter === t ? 'primary' : 'default'}
                onClick={() => {
                  setStockHistoryDialog((s) => ({ ...s, typeFilter: t, page: 1 }));
                  fetchStockHistoryPage(1, t);
                }}
                sx={{ cursor: 'pointer', textTransform: 'capitalize' }}
              />
            ))}
          </Stack>
          {stockHistoryDialog.loading ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Loading...</Typography>
          ) : stockHistoryDialog.rows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No stock transactions found.</Typography>
          ) : (
            <Stack spacing={1.5}>
              {stockHistoryDialog.rows.map((tx) => {
                const typeColors = { ADJUSTMENT: 'info', RESERVE: 'warning', RELEASE: 'secondary', SHIP: 'error', RETURN: 'success' };
                const direction = tx.metadata?.direction;
                return (
                  <Paper key={tx.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={tx.type} size="small" color={typeColors[tx.type] || 'default'} sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
                          {tx.variant?.sku && <Typography variant="caption" color="text.secondary">Variant: {tx.variant.sku}</Typography>}
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {tx.beforeStock ?? '?'} → <Box component="span" fontWeight={700} color={direction === 'increase' || tx.type === 'RETURN' ? 'success.main' : tx.type === 'SHIP' ? 'error.main' : 'text.primary'}>{tx.afterStock ?? '?'}</Box>
                          <Box component="span" color="text.secondary"> ({direction === 'increase' || tx.type === 'RETURN' ? '+' : '-'}{tx.qty})</Box>
                        </Typography>
                        {tx.metadata?.reason && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Reason: {tx.metadata.reason}</Typography>}
                        {tx.order && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Order: #{tx.order.orderNumber}</Typography>}
                      </Box>
                      <Box sx={{ textAlign: 'right', minWidth: 100 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {new Date(tx.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {new Date(tx.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        {tx.actor && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{tx.actor.firstName} {tx.actor.lastName}</Typography>}
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
          {stockHistoryDialog.total > 20 && (
            <Stack direction="row" justifyContent="center" spacing={1} sx={{ mt: 2 }}>
              <Button size="small" disabled={stockHistoryDialog.page <= 1} onClick={() => fetchStockHistoryPage(stockHistoryDialog.page - 1, stockHistoryDialog.typeFilter)}>Prev</Button>
              <Typography variant="body2" sx={{ lineHeight: '32px' }}>Page {stockHistoryDialog.page} of {Math.ceil(stockHistoryDialog.total / 20)}</Typography>
              <Button size="small" disabled={stockHistoryDialog.page >= Math.ceil(stockHistoryDialog.total / 20)} onClick={() => fetchStockHistoryPage(stockHistoryDialog.page + 1, stockHistoryDialog.typeFilter)}>Next</Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStockHistoryDialog((s) => ({ ...s, open: false }))}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductsManagePage;
