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
  DeleteSweep as DeleteSweepIcon, Download as DownloadIcon, Tune as TuneIcon,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts, deleteProduct, updateProduct } from '../../services/productService';
import { getCategoryTree } from '../../services/categoryService';
import { getMediaUrl } from '../../utils/media';
import { useCurrency } from '../../hooks/useSettings';
import { useNotification } from '../../context/NotificationContext';

const STOREFRONT_BASE = (import.meta.env.VITE_APP_URL || 'http://localhost:3000');

const ProductsManagePage = () => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const notify = useNotification();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [flatCategories, setFlatCategories] = useState([]);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '', bulk: false });

  // Server-side sorting
  const [sortModel, setSortModel] = useState([]);

  // Quick-edit dialog (stock + price)
  const [editDialog, setEditDialog] = useState({ open: false, row: null, quantity: '', price: '', salePrice: '', saving: false });
  const openEditDialog = (row) =>
    setEditDialog({ open: true, row, quantity: row.quantity, price: row.price, salePrice: row.salePrice ?? '', saving: false });
  const handleQuickSave = async () => {
    setEditDialog((s) => ({ ...s, saving: true }));
    try {
      const payload = {
        quantity: parseInt(editDialog.quantity, 10) || 0,
        price: parseFloat(editDialog.price),
        ...(editDialog.salePrice !== '' ? { salePrice: parseFloat(editDialog.salePrice) } : { salePrice: null }),
      };
      await updateProduct(editDialog.row.id, payload);
      setRows((prev) => prev.map((r) => r.id === editDialog.row.id ? { ...r, ...payload } : r));
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
  }, [paginationModel, search, status, categoryFilter, sortModel]);

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
  const confirmDelete = (id, name, bulk = false) =>
    setDeleteDialog({ open: true, id, name, bulk });

  const handleDelete = async () => {
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

  const handleToggleStatus = async (row) => {
    const newStatus = row.status === 'published' ? 'draft' : 'published';
    try {
      await updateProduct(row.id, { status: newStatus });
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, status: newStatus } : r));
      notify(`Product marked as ${newStatus}.`, 'success');
    } catch (err) {
      notify('Failed to update status: ' + (err?.response?.data?.message || err.message), 'error');
    }
  };

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
        <Box sx={{ py: 0.5, overflow: 'hidden' }}>
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
      width: 120,
      sortable: true,
      renderCell: ({ row }) => (
        <Box>
          <Typography
            variant="body2"
            fontWeight={700}
            color={row.salePrice ? 'error.main' : 'text.primary'}
          >
            {formatPrice(row.salePrice || row.price)}
          </Typography>
          {row.salePrice && (
            <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
              {formatPrice(row.price)}
            </Typography>
          )}
        </Box>
      ),
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
        <Tooltip title={row.status === 'published' ? 'Click to set Draft' : 'Click to Publish'}>
          <Chip
            label={row.status}
            size="small"
            color={row.status === 'published' ? 'success' : 'default'}
            onClick={() => handleToggleStatus(row)}
            sx={{ cursor: 'pointer', fontWeight: 600, textTransform: 'capitalize' }}
          />
        </Tooltip>
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
          <Tooltip title="Quick-edit stock &amp; price">
            <IconButton size="small" color="primary" onClick={() => openEditDialog(row)}>
              <TuneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit product">
            <IconButton size="small" onClick={() => navigate(`/admin/products/${row.id}/edit`)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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
          <Tooltip title="Delete product">
            <IconButton size="small" color="error" onClick={() => confirmDelete(row.id, row.name)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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
          <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/admin/products/new">
            Add Product
          </Button>
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
      {selectedIds.length > 0 && (
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
          <Button
            size="small" variant="outlined" color="error"
            startIcon={<DeleteSweepIcon />}
            onClick={() => confirmDelete(null, `${selectedIds.length} products`, true)}
          >
            Delete
          </Button>
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
          checkboxSelection
          rowSelectionModel={selectedIds}
          onRowSelectionModelChange={(ids) => setSelectedIds(ids)}
          disableRowSelectionOnClick
          rowHeight={64}
          sx={{ border: 0 }}
        />
      </Box>

      {/* ── Quick-Edit Dialog ── */}
      <Dialog
        open={editDialog.open}
        onClose={() => !editDialog.saving && setEditDialog((s) => ({ ...s, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle fontWeight={700}>Quick Edit — {editDialog.row?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Stock Quantity"
              type="number"
              size="small"
              fullWidth
              inputProps={{ min: 0 }}
              value={editDialog.quantity}
              onChange={(e) => setEditDialog((s) => ({ ...s, quantity: e.target.value }))}
            />
            <TextField
              label="Price"
              type="number"
              size="small"
              fullWidth
              inputProps={{ step: '0.01', min: 0 }}
              value={editDialog.price}
              onChange={(e) => setEditDialog((s) => ({ ...s, price: e.target.value }))}
            />
            <TextField
              label="Sale Price (blank to remove)"
              type="number"
              size="small"
              fullWidth
              inputProps={{ step: '0.01', min: 0 }}
              value={editDialog.salePrice}
              onChange={(e) => setEditDialog((s) => ({ ...s, salePrice: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialog((s) => ({ ...s, open: false }))} disabled={editDialog.saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleQuickSave} disabled={editDialog.saving}>
            {editDialog.saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

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
