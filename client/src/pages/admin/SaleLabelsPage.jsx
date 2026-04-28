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
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import {
  getSaleLabels,
  createSaleLabel,
  updateSaleLabel,
  deleteSaleLabel,
  reorderSaleLabels,
} from '../../services/adminService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

const SaleLabelsPage = () => {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    id: '',
    name: '',
    color: '#000000',
    isActive: true,
  });

  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.SETTINGS_MANAGE);

  useEffect(() => {
    fetchLabels();
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
      });
    } else {
      setEditingId(null);
      setForm({
        id: '',
        name: '',
        color: '#EF4444',
        isActive: true,
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

  const handleSave = async () => {
    if (!form.id || !form.name || !form.color) {
      notify('Please fill out all required fields.', 'warning');
      return;
    }

    // Hex color validation
    if (!/^#[0-9A-F]{6}$/i.test(form.color)) {
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
          name: form.name,
          color: form.color,
          isActive: form.isActive,
        });
        notify('Sale label updated successfully.', 'success');
      } else {
        await createSaleLabel({
          id: form.id,
          name: form.name,
          color: form.color,
          isActive: form.isActive,
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

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sale label? Products using this label will fall back to displaying the raw ID text.')) {
      return;
    }

    try {
      await deleteSaleLabel(id);
      notify('Sale label deleted successfully.', 'success');
      fetchLabels();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to delete sale label.', 'error');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    if (sourceIndex === destIndex) return;

    const items = Array.from(labels);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destIndex, 0, reorderedItem);

    // Update UI immediately for snappiness
    setLabels(items);

    // Prepare payload
    const payload = items.map((item, index) => ({
      id: item.id,
      name: item.name,
      color: item.color,
      isActive: item.isActive,
      priority: index,
    }));

    try {
      await reorderSaleLabels(payload);
      // Let it remain, or optionally refetch:
      // fetchLabels();
    } catch (err) {
      notify('Failed to save label ordering.', 'error');
      fetchLabels(); // revert on failure
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
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Sale Labels</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage the central catalog of sale labels available for products. Drag to reorder.
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
                {labels.map((label, index) => (
                  <Draggable key={label.id} draggableId={label.id} index={index} isDragDisabled={!canManage}>
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          p: 2,
                          borderBottom: index < labels.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                          bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper',
                          ...(snapshot.isDragging ? { boxShadow: 3 } : {}),
                        }}
                      >
                        <Box
                          {...provided.dragHandleProps}
                          sx={{ mr: 2, display: 'flex', alignItems: 'center', color: 'text.secondary', cursor: canManage ? 'grab' : 'default' }}
                        >
                          <DragIndicatorIcon />
                        </Box>

                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {label.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            ID: {label.id}
                          </Typography>
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

                        <Box sx={{ width: 100, textAlign: 'center' }}>
                          <Typography variant="body2" color={label.isActive ? 'success.main' : 'text.disabled'} fontWeight={label.isActive ? 600 : 400}>
                            {label.isActive ? 'Active' : 'Inactive'}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, width: 80, justifyContent: 'flex-end' }}>
                          {canManage && (
                            <>
                              <IconButton size="small" onClick={() => handleOpen(label)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => handleDelete(label.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Draggable>
                ))}
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

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Sale Label' : 'New Sale Label'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Display Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                helperText="What customers see (e.g. 'Flash Sale')"
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
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
                      value={form.color}
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
            <Grid item xs={12} sm={6}>
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={<Switch checked={form.isActive} onChange={handleChange} name="isActive" />}
                  label="Active"
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save Label'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SaleLabelsPage;
