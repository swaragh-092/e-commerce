import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, TextField,
  FormControl, InputLabel, Select, MenuItem, Stack, Tooltip,
  Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  DialogContentText, InputAdornment, Paper,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon, Clear as ClearIcon,
  CheckCircle as CheckCircleIcon, RemoveCircle as RemoveCircleIcon,
  DeleteSweep as DeleteSweepIcon, Download as DownloadIcon, EditNote as EditNoteIcon,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts, deleteProduct, updateProduct, bulkUpdateSale } from '../../services/productService';
import { getCategoryTree } from '../../services/categoryService';
import { getMediaUrl } from '../../utils/media';
import { useCurrency, useSettings } from '../../hooks/useSettings';
import { useNotification } from '../../context/NotificationContext';
import { formatSaleDateTime, isEndingSoon } from '../../utils/pricing';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

const STOREFRONT_BASE = (import.meta.env.VITE_APP_URL || 'http://localhost:3000');
const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
};
const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

const ProductsManagePage = () => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const notify = useNotification();
  const { hasPermission } = useAuth();
  const sales = settings?.sales || {};
  const canCreateProducts = hasPermission(PERMISSIONS.PRODUCTS_CREATE);
  const canUpdateProducts = hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canDeleteProducts = hasPermission(PERMISSIONS.PRODUCTS_DELETE);
  const canBulkSaleProducts = hasPermission(PERMISSIONS.PRODUCTS_BULK_SALE);
  const canBulkModify = canUpdateProducts || canDeleteProducts || canBulkSaleProducts;

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [saleFilter, setSaleFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [flatCategories, setFlatCategories] = useState([]);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '', bulk: false });

  // Server-side sorting
  const [sortModel, setSortModel] = useState([]);

  // Quick-edit dialog (stock + price + sale + status)
  const [editDialog, setEditDialog] = useState({
    open: false,
    row: null,
    quantity: '',
    price: '',
    salePrice: '',
    saleEnabled: false,
    saleStartAt: '',
    saleEndAt: '',
    saleLabel: '',
    status: 'draft',
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
  const openEditDialog = (row) => {
    if (!canUpdateProducts) {
      notify('You do not have permission to update products.', 'error');
      return;
    }

    setEditDialog({
      open: true,
      row,
      quantity: row.quantity,
      price: row.price,
      salePrice: row.salePrice ?? '',
      saleEnabled: row.salePrice !== null && row.salePrice !== undefined && row.salePrice !== '',
      saleStartAt: toDateTimeLocal(row.saleStartAt),
      saleEndAt: toDateTimeLocal(row.saleEndAt),
      saleLabel: row.saleLabel || '',
      status: row.status || 'draft',
      saving: false,
    });
  };
  const handleQuickSave = async () => {
    if (!canUpdateProducts) {
      notify('You do not have permission to update products.', 'error');
      return;
    }

    setEditDialog((s) => ({ ...s, saving: true }));
    try {
      const payload = {
        quantity: parseInt(editDialog.quantity, 10) || 0,
        price: parseFloat(editDialog.price),
        status: editDialog.status,
        ...(editDialog.saleEnabled && editDialog.salePrice !== ''
          ? {
              salePrice: parseFloat(editDialog.salePrice),
              saleStartAt: toIsoOrNull(editDialog.saleStartAt),
              saleEndAt: toIsoOrNull(editDialog.saleEndAt),
              saleLabel: editDialog.saleLabel || null,
            }
          : { salePrice: null, saleStartAt: null, saleEndAt: null, saleLabel: null }),
      };
      await updateProduct(editDialog.row.id, payload);
      setRows((prev) => prev.map((r) => r.id === editDialog.row.id ? {
        ...r,
        ...payload,
        effectivePrice: payload.salePrice ?? payload.price,
        isSaleActive: !!payload.salePrice && (!payload.saleStartAt || new Date(payload.saleStartAt) <= new Date()) && (!payload.saleEndAt || new Date(payload.saleEndAt) >= new Date()),
      } : r));
      notify('Product updated.', 'success');
      setEditDialog((s) => ({ ...s, open: false }));
    } catch (err) {
      notify('Failed to update: ' + (err?.response?.data?.error?.message || err.message), 'error');
      setEditDialog((s) => ({ ...s, saving: false }));
    }
  };

  // CSV export — exports the current page's visible rows
  const handleExportCSV = () => {
    const headers = ['Name', 'SKU', 'Price', 'Sale Price', 'Stock', 'Status'];
    const csvRows = [headers.join(',')];
    rows.forEach((r) => {
      csvRows.push([
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${r.sku || ''}"`,
        r.price,
        r.salePrice ?? '',
        r.quantity,
        r.status,
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
      const tree = res?.data?.categories || [];
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

  const fetchProducts = useCallback(() => {
    setLoading(true);
    const params = {
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      ...(search && { search }),
      ...(status && { status }),
      ...(saleFilter && { saleStatus: saleFilter }),
      ...(categoryFilter && { categoryId: categoryFilter }),
      ...(sortModel[0] && { sortBy: sortModel[0].field, sortOrder: sortModel[0].sort }),
    };
    getProducts(params)
      .then((res) => {
        setRows(res?.data || []);
        setTotal(res?.meta?.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [paginationModel, search, status, saleFilter, categoryFilter, sortModel]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Debounce search: only fire when user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleStatusChange = (val) => {
    setStatus(val);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

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
        await Promise.all(selectedIds.map((sid) => deleteProduct(sid)));
        notify(`${selectedIds.length} products deleted.`, 'success');
        setSelectedIds([]);
      } else {
        await deleteProduct(id);
        notify('Product deleted.', 'success');
      }
      fetchProducts();
    } catch (err) {
      notify('Failed to delete: ' + err.message, 'error');
    }
  };

  const handleBulkStatus = async (newStatus) => {
    if (!canUpdateProducts) {
      notify('You do not have permission to update products.', 'error');
      return;
    }

    try {
      await Promise.all(selectedIds.map((sid) => updateProduct(sid, { status: newStatus })));
      setRows((prev) =>
        prev.map((r) => selectedIds.includes(r.id) ? { ...r, status: newStatus } : r)
      );
      notify(`${selectedIds.length} products set to ${newStatus}.`, 'success');
      setSelectedIds([]);
    } catch (err) {
      notify('Bulk update failed: ' + err.message, 'error');
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
      notify(bulkSaleDialog.mode === 'clear' ? 'Sale removed from selected products.' : 'Sale applied to selected products.', 'success');
      setBulkSaleDialog((s) => ({ ...s, open: false, saving: false }));
      setSelectedIds([]);
      fetchProducts();
    } catch (err) {
      notify('Bulk sale update failed: ' + (err?.response?.data?.error?.message || err.message), 'error');
      setBulkSaleDialog((s) => ({ ...s, saving: false }));
    }
  };

  const handleToggleStatus = async (row) => {
    if (!canUpdateProducts) {
      notify('You do not have permission to update products.', 'error');
      return;
    }

    const newStatus = row.status === 'published' ? 'draft' : 'published';
    try {
      await updateProduct(row.id, { status: newStatus });
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, status: newStatus } : r));
      notify(`Product marked as ${newStatus}.`, 'success');
    } catch (err) {
      notify('Failed to update status: ' + (err?.response?.data?.message || err.message), 'error');
    }
  };

  const editPriceValue = Number(editDialog.price);
  const editSalePriceValue = editDialog.salePrice === '' ? null : Number(editDialog.salePrice);
  const hasInvalidPrice = editDialog.open && (!Number.isFinite(editPriceValue) || editPriceValue < 0);
  const hasInvalidSalePrice = editDialog.open && editDialog.saleEnabled && (
    editDialog.salePrice === '' ||
    !Number.isFinite(editSalePriceValue) ||
    editSalePriceValue < 0 ||
    editSalePriceValue >= editPriceValue
  );
  const hasInvalidQuantity = editDialog.open && (Number.isNaN(Number(editDialog.quantity)) || Number(editDialog.quantity) < 0);
  const hasInvalidSaleDates = editDialog.open && editDialog.saleEnabled && editDialog.saleStartAt && editDialog.saleEndAt && new Date(editDialog.saleEndAt) <= new Date(editDialog.saleStartAt);
  const bulkSaleValue = Number(bulkSaleDialog.value);
  const hasInvalidBulkSale = bulkSaleDialog.mode === 'apply' && (
    !Number.isFinite(bulkSaleValue) ||
    bulkSaleValue <= 0 ||
    (bulkSaleDialog.saleType === 'percentage' && bulkSaleValue >= 100) ||
    (bulkSaleDialog.saleStartAt && bulkSaleDialog.saleEndAt && new Date(bulkSaleDialog.saleEndAt) <= new Date(bulkSaleDialog.saleStartAt))
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
      minWidth: 200,
      sortable: true,
      renderCell: ({ row }) => (
        <Box sx={{ py: 1, overflow: 'hidden' }}>
          <Typography variant="body2" fontWeight={600} noWrap lineHeight={1.4}>
            {row.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.sku ? `SKU: ${row.sku}` : <em style={{ opacity: 0.4 }}>No SKU</em>}
          </Typography>
        </Box>
      ),
    },
    // 3. Merged price: sale price prominent + original struck-through
    {
      field: 'price',
      headerName: 'Price',
      width: 160,
      sortable: true,
      renderCell: ({ row }) => (
        <Box sx={{ py: 1 }}>
          <Typography
            variant="body2"
            fontWeight={700}
            color={row.isSaleActive ? 'error.main' : 'text.primary'}
          >
            {formatPrice(row.effectivePrice ?? row.salePrice ?? row.price)}
          </Typography>
          {row.salePrice && (
            <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through', display: 'block' }}>
              {formatPrice(row.price)}
            </Typography>
          )}
          {row.saleStatus && row.saleStatus !== 'none' && (
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
            <Stack direction="row" spacing={0.5} sx={{ mb: 0.25, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={row.saleStatus === 'active' ? 'Active' : row.saleStatus === 'scheduled' ? 'Scheduled' : 'Expired'}
                color={row.saleStatus === 'active' ? 'error' : row.saleStatus === 'scheduled' ? 'warning' : 'default'}
              />
              {!!row.discountPercent && <Chip size="small" variant="outlined" label={`${row.discountPercent}% OFF`} />}
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
            {endingSoon && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', fontWeight: 700 }} noWrap>
                Inside ending-soon window
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
      width: 90,
      sortable: true,
      renderCell: ({ value }) => {
        const v = Number(value);
        const color = v === 0 ? 'error' : v <= 10 ? 'warning' : 'success';
        return (
          <Chip
            label={v}
            size="small"
            color={color}
            variant={v === 0 ? 'filled' : 'outlined'}
            sx={{ fontWeight: 700, minWidth: 48 }}
          />
        );
      },
    },
    // 5. Click-to-toggle status chip
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: ({ row }) => (
        <Chip
          label={row.status}
          size="small"
          color={row.status === 'published' ? 'success' : 'default'}
          sx={{ fontWeight: 600, textTransform: 'capitalize' }}
        />
      ),
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
            <Tooltip title="Quick edit stock, pricing and status">
              <IconButton size="small" color="primary" onClick={() => openEditDialog(row)}>
                <EditNoteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canUpdateProducts && (
            <Tooltip title="Edit product">
              <IconButton size="small" onClick={() => navigate(`/admin/products/${row.id}/edit`)}>
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
  ];

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Manage Products</Typography>
          <Typography variant="body2" color="text.secondary">{total} products total</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCSV} disabled={rows.length === 0}>
            Export CSV
          </Button>
          {canCreateProducts && (
            <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/admin/products/new">
              Add Product
            </Button>
          )}
        </Stack>
      </Box>

      {/* ── Filters ── */}
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" alignItems="center">
        <TextField
          size="small"
          label="Search name / description"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: 260 }}
          InputProps={{
            endAdornment: searchInput ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => { setSearchInput(''); setSearch(''); }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={status}
            label="Status"
            onChange={(e) => { setStatus(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })); }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="published">Published</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Sale</InputLabel>
          <Select
            value={saleFilter}
            label="Sale"
            onChange={(e) => { setSaleFilter(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })); }}
          >
            <MenuItem value="">All Sales</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="scheduled">Scheduled</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
            <MenuItem value="none">No Sale</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryFilter}
            label="Category"
            onChange={(e) => { setCategoryFilter(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })); }}
          >
            <MenuItem value="">All Categories</MenuItem>
            {flatCategories.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* ── Bulk actions bar (only shown when rows are selected) ── */}
      {selectedIds.length > 0 && canBulkModify && (
        <Paper
          elevation={0}
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
          {canUpdateProducts && (
            <>
              <Button
                size="small" variant="outlined" color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => handleBulkStatus('published')}
              >
                Publish
              </Button>
              <Button
                size="small" variant="outlined" color="inherit"
                startIcon={<RemoveCircleIcon />}
                onClick={() => handleBulkStatus('draft')}
              >
                Set Draft
              </Button>
            </>
          )}
          {canDeleteProducts && (
            <Button
              size="small" variant="outlined" color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={() => confirmDelete(null, `${selectedIds.length} products`, true)}
            >
              Delete
            </Button>
          )}
          {sales.allowBulkSales !== false && canBulkSaleProducts && (
            <>
              <Button size="small" variant="outlined" onClick={() => setBulkSaleDialog({ open: true, mode: 'apply', saleType: 'percentage', value: '', saleLabel: '', saleStartAt: '', saleEndAt: '', saving: false })}>
                Apply Sale
              </Button>
              <Button size="small" variant="outlined" color="warning" onClick={() => setBulkSaleDialog({ open: true, mode: 'clear', saleType: 'percentage', value: '', saleLabel: '', saleStartAt: '', saleEndAt: '', saving: false })}>
                Remove Sale
              </Button>
            </>
          )}
          <Button size="small" color="inherit" onClick={() => setSelectedIds([])}>
            Cancel
          </Button>
        </Paper>
      )}

      {/* ── Data Grid ── */}
      <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 20, 50]}
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={(m) => { setSortModel(m); setPaginationModel((p) => ({ ...p, page: 0 })); }}
          checkboxSelection={canBulkModify}
          rowSelectionModel={selectedIds}
          onRowSelectionModelChange={(ids) => setSelectedIds(ids)}
          disableRowSelectionOnClick
          getRowHeight={() => 'auto'}
          getEstimatedRowHeight={() => 80}
          sx={{
            border: 0,
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
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
        <DialogTitle sx={{ pb: 1.5 }}>
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
              label="Stock Quantity"
              type="number"
              size="small"
              fullWidth
              error={hasInvalidQuantity}
              helperText={hasInvalidQuantity ? 'Stock cannot be negative.' : `Current stock: ${editDialog.row?.quantity ?? 0}`}
              inputProps={{ min: 0 }}
              value={editDialog.quantity}
              onChange={(e) => setEditDialog((s) => ({ ...s, quantity: e.target.value }))}
            />
            <TextField
              label="Price"
              type="number"
              size="small"
              fullWidth
              error={hasInvalidPrice}
              helperText={hasInvalidPrice ? 'Enter a valid price.' : `Current price: ${formatPrice(editDialog.row?.price || 0)}`}
              InputProps={{
                startAdornment: <InputAdornment position="start">{formatPrice(0).replace(/0.00|0/g, '').trim() || '$'}</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: 0 }}
              value={editDialog.price}
              onChange={(e) => setEditDialog((s) => ({ ...s, price: e.target.value }))}
            />
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
                    ? 'Sale price must be lower than the regular price.'
                    : `Current sale price: ${editDialog.row?.salePrice ? formatPrice(editDialog.row.salePrice) : 'None'}`
              }
              InputProps={{
                startAdornment: <InputAdornment position="start">{formatPrice(0).replace(/0.00|0/g, '').trim() || '$'}</InputAdornment>,
              }}
              inputProps={{ step: '0.01', min: 0 }}
              value={editDialog.salePrice}
              onChange={(e) => setEditDialog((s) => ({ ...s, salePrice: e.target.value }))}
            />
            <TextField
              label="Sale Label"
              size="small"
              fullWidth
              disabled={!editDialog.saleEnabled}
              placeholder={sales.defaultSaleLabel || 'Limited Time Offer'}
              value={editDialog.saleLabel}
              onChange={(e) => setEditDialog((s) => ({ ...s, saleLabel: e.target.value }))}
            />
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
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 0.5 }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>Visibility</Typography>
                <Typography variant="caption" color="text.secondary">
                  Control whether this product appears on the storefront.
                </Typography>
              </Box>
              <Button
                size="small"
                variant={editDialog.status === 'published' ? 'contained' : 'outlined'}
                color={editDialog.status === 'published' ? 'success' : 'inherit'}
                onClick={() => setEditDialog((s) => ({
                  ...s,
                  status: s.status === 'published' ? 'draft' : 'published',
                }))}
              >
                {editDialog.status === 'published' ? 'Published' : 'Draft'}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialog((s) => ({ ...s, open: false }))} disabled={editDialog.saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleQuickSave}
            disabled={editDialog.saving || hasInvalidPrice || hasInvalidSalePrice || hasInvalidQuantity || hasInvalidSaleDates}
          >
            {editDialog.saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

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
              This removes the sale price, schedule, and label from all selected products while keeping their base price unchanged.
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
                InputProps={bulkSaleDialog.saleType === 'fixed' ? { startAdornment: <InputAdornment position="start">₹</InputAdornment> } : undefined}
                inputProps={{ min: 0, step: '0.01' }}
                value={bulkSaleDialog.value}
                onChange={(e) => setBulkSaleDialog((s) => ({ ...s, value: e.target.value }))}
              />
              <TextField
                label="Sale Label"
                size="small"
                fullWidth
                value={bulkSaleDialog.saleLabel}
                onChange={(e) => setBulkSaleDialog((s) => ({ ...s, saleLabel: e.target.value }))}
              />
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
    </Box>
  );
};

export default ProductsManagePage;
