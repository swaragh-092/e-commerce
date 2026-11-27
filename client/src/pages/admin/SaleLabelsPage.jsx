import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  IconButton,
  Grid,
  CircularProgress,
  Autocomplete,
  Chip,
  Tooltip,
  Alert,
  getContrastRatio,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LabelIcon from '@mui/icons-material/Label';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import {
  getSaleLabels,
  getSaleLabelUsage,
  createSaleLabel,
  updateSaleLabel,
  deleteSaleLabel,
  reorderSaleLabels,
} from '../../services/adminService';
import { getProducts, bulkUpdateProducts } from '../../services/productService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { formatOpenEndedDateRange, toDateTimeLocal } from '../../utils/dates';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const getLabelStatus = (label, now) => {
  if (label.isActive === false) return { text: 'Disabled', color: 'default' };
  if (label.startDate && new Date(label.startDate).getTime() > now) return { text: 'Scheduled', color: 'info' };
  if (label.endDate && new Date(label.endDate).getTime() < now) return { text: 'Expired', color: 'warning' };
  return { text: 'Active', color: 'success' };
};

const SaleBadge = ({ name, color }) => (
  <Chip size="small" label={name || 'Sale Label'} sx={{ maxWidth: '100%', bgcolor: HEX_COLOR.test(color) ? color : 'error.main', color: '#fff' }} />
);

const SaleLabelsPage = () => {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [now, setNow] = useState(Date.now);

  const [form, setForm] = useState({
    id: '',
    name: '',
    color: '#000000',
    isActive: true,
    startDate: '',
    endDate: '',
  });

  const { notify, confirm } = useNotification();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.SETTINGS_MANAGE);
  const canBulkSale = hasPermission(PERMISSIONS.PRODUCTS_UPDATE) && hasPermission(PERMISSIONS.PRODUCTS_READ);

  // Bulk assign state
  const [assignDialog, setAssignDialog] = useState({ open: false, labelId: '', labelName: '' });
  const [productOptions, setProductOptions] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productPages, setProductPages] = useState(1);
  const [productError, setProductError] = useState(false);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const replacements = selectedProducts.filter(p => p.saleLabel && p.saleLabel !== assignDialog.labelId);

  useEffect(() => {
    if (!assignDialog.open) return;
    let current = true;
    setProductsLoading(true);
    setProductOptions([]);
    setProductError(false);
    const timer = setTimeout(async () => {
      try {
        const res = await getProducts({ page: productPage, limit: 25, search: productSearch.trim() });
        if (!current) return;
        setProductOptions(res.data || []);
        setProductPages(res.meta?.totalPages || 1);
      } catch {
        if (current) setProductError(true);
      } finally {
        if (current) setProductsLoading(false);
      }
    }, productSearch.trim() ? 250 : 0);
    return () => { current = false; clearTimeout(timer); };
  }, [assignDialog.open, productSearch, productPage, searchAttempt]);

  const openAssignDialog = (label) => {
    setAssignDialog({ open: true, labelId: label.id, labelName: label.name });
    setSelectedProducts([]);
    setProductSearch('');
    setProductPage(1);
    setProductPages(1);
  };

  const handleBulkAssign = async () => {
    if (selectedProducts.length === 0) { notify('Select at least one product.', 'warning'); return; }
    setAssignSaving(true);
    try {
      await bulkUpdateProducts(
        selectedProducts.map((p) => p.id),
        { saleLabel: assignDialog.labelId }
      );
      notify(`Label "${assignDialog.labelName}" assigned to ${selectedProducts.length} products.`, 'success');
      setAssignDialog({ open: false, labelId: '', labelName: '' });
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to assign label.', 'error');
    } finally {
      setAssignSaving(false);
    }
  };

  useEffect(() => {
    fetchLabels();
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const fetchLabels = async () => {
    try {
      setLoading(true);
      const res = await getSaleLabels();
      // Ensure labels are sorted by priority
      const fetched = res.data?.data || [];
      fetched.sort((a, b) => a.priority - b.priority);
      setLabels(fetched);
    } catch (err) {
      notify('Failed to fetch sale labels.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (label = null) => {
    if (label) {
      setEditingId(label.id);
      setForm({
        id: label.id,
        name: label.name,
        color: label.color || '#000000',
        isActive: label.isActive ?? true,
        startDate: toDateTimeLocal(label.startDate),
        endDate: toDateTimeLocal(label.endDate),
      });
    } else {
      setEditingId(null);
      setForm({
        id: '',
        name: '',
        color: '#EF4444',
        isActive: true,
        startDate: '',
        endDate: '',
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const invalidRange = Boolean(form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate));

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving || invalidRange) return;
    if (!form.id || !form.name.trim() || !form.color) {
      notify('Please fill out all required fields.', 'warning');
      return;
    }

    // Hex color validation
    if (!HEX_COLOR.test(form.color)) {
      notify('Color must be a valid 6-character hex code (e.g., #FF0000).', 'warning');
      return;
    }

    // ID must only contain lowercase letters, digits, and hyphens (no spaces)
    if (!editingId && !/^[a-z0-9-]+$/.test(form.id)) {
      notify('Label ID may only contain lowercase letters, numbers, and hyphens (no spaces).', 'warning');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await updateSaleLabel(editingId, {
          name: form.name.trim(),
          color: form.color,
          isActive: form.isActive,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        });
        notify('Sale label updated successfully.', 'success');
      } else {
        await createSaleLabel({
          id: form.id,
          name: form.name.trim(),
          color: form.color,
          isActive: form.isActive,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        });
        notify('Sale label created successfully.', 'success');
      }
      handleClose();
      fetchLabels();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to save sale label.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async ({ id, name }) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const response = await getSaleLabelUsage(id);
      const count = response.data?.data?.productCount;
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('Product count unavailable');
      const impact = count === 0 ? 'No products use this label.' : `${count.toLocaleString()} ${count === 1 ? 'product uses' : 'products use'} this label and may display its ID after deletion. To keep assignments, cancel and turn off Enabled in the label editor.`;
      if (!(await confirm({ title: `Delete ${name}?`, message: impact, confirmText: 'Delete label', severity: 'error' }))) return;
      await deleteSaleLabel(id);
      notify('Sale label deleted successfully.', 'success');
      fetchLabels();
    } catch (err) {
      notify(err.response?.data?.message || 'Couldn’t check label usage or complete deletion. Try again.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragEnd = async (result) => {
    if (result.destination) await moveLabel(result.source.index, result.destination.index);
  };

  const moveLabel = async (sourceIndex, destIndex) => {
    if (!canManage || reordering || sourceIndex === destIndex || destIndex < 0 || destIndex >= labels.length) return;

    const items = Array.from(labels);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destIndex, 0, reorderedItem);

    setReordering(true);
    setLabels(items);

    // Prepare payload
    const payload = items.map((item, index) => ({
      id: item.id,
      name: item.name,
      color: item.color,
      isActive: item.isActive,
      startDate: item.startDate ?? null,
      endDate: item.endDate ?? null,
      priority: index,
    }));

    try {
      await reorderSaleLabels(payload);
      notify('Label order saved.', 'success');
    } catch (err) {
      notify('Failed to save label ordering.', 'error');
      setLabels(labels);
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight={700}>Sale Labels</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage storefront badges and their default sale schedules.{canManage ? ' Drag labels or use the arrow buttons to reorder.' : ''}
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            New Label
          </Button>
        )}
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sale-labels-list">
            {(provided) => (
              <Box
                {...provided.droppableProps}
                ref={provided.innerRef}
                sx={{ display: 'flex', flexDirection: 'column' }}
              >
                {labels.map((label, index) => {
                  const status = getLabelStatus(label, now);
                  const schedule = formatOpenEndedDateRange(label.startDate, label.endDate);
                  return (
                  <Draggable key={label.id} draggableId={label.id} index={index} isDragDisabled={!canManage || reordering}>
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 1.5,
                          alignItems: 'center',
                          p: 2,
                          borderBottom: index < labels.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                          bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper',
                          ...(snapshot.isDragging ? { boxShadow: 3 } : {}),
                        }}
                      >
                        {canManage && <Box
                          {...provided.dragHandleProps}
                          sx={{ mr: 2, display: 'flex', alignItems: 'center', color: 'text.secondary', cursor: canManage ? 'grab' : 'default' }}
                        >
                          <DragIndicatorIcon />
                        </Box>}

                        <Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
                          <SaleBadge name={label.name} color={label.color} />
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                            ID: {label.id}
                          </Typography>
                          {schedule && (
                            <Typography variant="caption" color="primary.main" sx={{ display: 'block', fontWeight: 600 }}>
                              Schedule: {schedule} ({timezone})
                            </Typography>
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', width: 120 }}>
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              bgcolor: label.color,
                              mr: 1,
                              border: '1px solid',
                              borderColor: 'divider'
                            }}
                          />
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {label.color}
                          </Typography>
                        </Box>

                        <Chip size="small" variant="outlined" color={status.color} label={status.text} />

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end' }}>
                          {canManage && labels.length > 1 && <>
                            <IconButton size="small" aria-label={`Move ${label.name} up`} disabled={reordering || index === 0} onClick={() => moveLabel(index, index - 1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
                            <IconButton size="small" aria-label={`Move ${label.name} down`} disabled={reordering || index === labels.length - 1} onClick={() => moveLabel(index, index + 1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
                          </>}
                          {canBulkSale && (
                            <Tooltip title="Assign to products">
                              <IconButton aria-label={`Assign ${label.name} to products`} size="small" color="primary" onClick={() => openAssignDialog(label)}>
                                <LabelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canManage && (
                            <>
                              <IconButton aria-label={`Edit ${label.name}`} size="small" disabled={reordering} onClick={() => handleOpen(label)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton aria-label={`Delete ${label.name}`} size="small" color="error" disabled={reordering || Boolean(deletingId)} onClick={() => handleDelete(label)}>
                                {deletingId === label.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Draggable>
                  );
                })}
                {provided.placeholder}
                {labels.length === 0 && (
                  <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                    No sale labels found. Create one to get started.
                  </Box>
                )}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
      </Paper>

      <Dialog open={open} onClose={() => !saving && handleClose()} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: handleSave, noValidate: true }} aria-labelledby="sale-label-dialog-title">
        <DialogTitle id="sale-label-dialog-title">{editingId ? 'Edit Sale Label' : 'New Sale Label'}</DialogTitle>
        <DialogContent dividers sx={{ overscrollBehavior: 'contain' }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Display Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                helperText="What customers see (e.g. ‘Flash Sale’)"
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Label ID"
                name="id"
                value={form.id}
                onChange={handleChange}
                disabled={!!editingId} // Cannot change ID after creation
                helperText="A unique identifier (e.g. 'flash-sale', 'clearance'). No spaces."
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} sx={{ order: 2 }}>
              <TextField
                fullWidth
                label="Hex Color"
                name="color"
                value={form.color}
                onChange={handleChange}
                helperText="e.g. #FF0000"
                size="small"
                required
                InputProps={{
                  startAdornment: (
                    <input
                      type="color"
                      name="color"
                      aria-label="Choose badge color"
                      value={HEX_COLOR.test(form.color) ? form.color : '#000000'}
                      onChange={handleChange}
                      style={{
                        width: 24,
                        height: 24,
                        padding: 0,
                        border: 'none',
                        marginRight: 8,
                        cursor: 'pointer',
                        background: 'transparent',
                      }}
                    />
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} sx={{ order: 2 }}>
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={<Switch checked={form.isActive} onChange={handleChange} name="isActive" />}
                  label="Enabled"
                />
              </Box>
            </Grid>
            <Grid item xs={12} sx={{ order: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>Storefront Badge Preview</Typography>
              <SaleBadge name={form.name} color={form.color} />
              {HEX_COLOR.test(form.color) && getContrastRatio(form.color, '#fff') < 4.5 && (
                <Typography variant="caption" display="block" mt={0.75}>Choose a darker background to make the white badge text easier to read.</Typography>
              )}
            </Grid>
            <Grid item xs={12} sx={{ order: 2 }}>
              <Typography variant="body2" color="text.secondary">Default schedule ({timezone}). Product-specific dates can override these dates.</Typography>
            </Grid>
            <Grid item xs={12} sm={6} sx={{ order: 2 }}>
              <TextField
                fullWidth
                label="Global Start Date"
                name="startDate"
                type="datetime-local"
                value={form.startDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                size="small"
                helperText="Leave blank for no start restriction."
              />
            </Grid>
            <Grid item xs={12} sm={6} sx={{ order: 2 }}>
              <TextField
                fullWidth
                label="Global End Date"
                name="endDate"
                type="datetime-local"
                value={form.endDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                size="small"
                error={invalidRange}
                helperText={invalidRange ? 'End time must be after the start time.' : 'Leave blank for no expiry.'}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving || invalidRange}>
            {saving ? 'Saving…' : 'Save Label'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={assignDialog.open} aria-labelledby="assign-sale-label-title" onClose={() => !assignSaving && setAssignDialog({ open: false, labelId: '', labelName: '' })} maxWidth="sm" fullWidth>
        <DialogTitle id="assign-sale-label-title">Assign “{assignDialog.labelName}” to Products</DialogTitle>
        <DialogContent dividers sx={{ overscrollBehavior: 'contain' }}>
          <Typography variant="body2" color="text.secondary" mb={2}>Search by name or SKU. Your selection stays as you browse.</Typography>
          <Autocomplete
            multiple
            disableCloseOnSelect
            disabled={assignSaving}
            options={[...productOptions, ...selectedProducts.filter(p => !productOptions.some(option => option.id === p.id))]}
            filterSelectedOptions
            loading={productsLoading}
            loadingText="Searching products…"
            noOptionsText={productError ? 'Search unavailable' : 'No matching products'}
            filterOptions={(options) => options}
            inputValue={productSearch}
            onInputChange={(_, value, reason) => {
              if (reason === 'input' || reason === 'clear') {
                setProductSearch(value);
                setProductPage(1);
              }
            }}
            getOptionLabel={(o) => `${o.name}${o.sku ? ` (${o.sku})` : ''}`}
            value={selectedProducts}
            onChange={(_, v) => setSelectedProducts(v)}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderTags={(value, getTagProps) => value.map((o, i) => <Chip {...getTagProps({ i })} key={o.id} label={o.name} size="small" />)}
            renderInput={(params) => <TextField {...params} label="Search Products" size="small" />}
          />
          {productError && <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={() => setSearchAttempt(n => n + 1)}>Retry</Button>}>Couldn’t load products.</Alert>}
          {productPages > 1 && <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
            <Button disabled={assignSaving || productsLoading || productPage <= 1} onClick={() => setProductPage(p => p - 1)}>Previous</Button>
            <Typography variant="caption" aria-live="polite">Page {productPage} of {productPages}</Typography>
            <Button disabled={assignSaving || productsLoading || productPage >= productPages} onClick={() => setProductPage(p => p + 1)}>Next</Button>
          </Box>}
          {replacements.length > 0 && <Alert severity="warning" sx={{ mt: 2 }}>
            This replaces the current label on {replacements.length} {replacements.length === 1 ? 'product' : 'products'}: {replacements.map(p => `${p.name} (${labels.find(l => l.id === p.saleLabel)?.name || p.saleLabel})`).join(', ')}.
          </Alert>}
          <Typography variant="caption" component="p" sx={{ mt: 2 }} aria-live="polite">{selectedProducts.length} selected. Prices and product-specific dates stay the same.</Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={assignSaving} onClick={() => setAssignDialog({ open: false, labelId: '', labelName: '' })}>Cancel</Button>
          <Button variant="contained" onClick={handleBulkAssign} disabled={assignSaving || selectedProducts.length === 0}>
            {assignSaving ? 'Assigning…' : `Assign to ${selectedProducts.length} ${selectedProducts.length === 1 ? 'product' : 'products'}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SaleLabelsPage;
