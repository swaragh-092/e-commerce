import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, CircularProgress,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Collapse, Tooltip, Alert, Divider, TablePagination,
  FormControl, InputLabel, Select, MenuItem, Grid
} from '@mui/material';

import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import attributeService from '../../services/attributeService';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useNotification } from '../../context/NotificationContext';
import AppErrorBoundary from '../../components/common/AppErrorBoundary';

const DISPLAY_TYPE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'swatch', label: 'Color swatches' },
  { value: 'image', label: 'Image swatches' },
  { value: 'button', label: 'Buttons' },
  { value: 'chip', label: 'Chips' },
  { value: 'radio', label: 'Radio buttons' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'text', label: 'Text labels' },
];

const VALUE_TYPE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'color', label: 'Color' },
  { value: 'size', label: 'Size' },
  { value: 'weight', label: 'Weight' },
  { value: 'length', label: 'Length / Dimension' },
  { value: 'storage', label: 'Storage' },
  { value: 'volume', label: 'Volume' },
  { value: 'material', label: 'Material' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
];

const EMPTY_VALUE_META = {
  value: '',
  displayLabel: '',
  swatchColor: '',
  imageUrl: '',
  unitLabel: '',
};

const ValuesPanel = ({ attribute, onRefresh, canManage }) => {
  const { notify, confirm } = useNotification();
  const [newValue, setNewValue] = useState('');
  const [newMeta, setNewMeta] = useState(EMPTY_VALUE_META);
  const [editingValue, setEditingValue] = useState(null);

  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!canManage) return;
    if (!newValue.trim()) return;
    try {
      setSaving(true);
      await attributeService.addAttributeValue(attribute.id, {
        value: newValue.trim(),
        displayLabel: newMeta.displayLabel.trim() || null,
        swatchColor: newMeta.swatchColor.trim() || null,
        imageUrl: newMeta.imageUrl.trim() || null,
        unitLabel: newMeta.unitLabel.trim() || null,
      });
      setNewValue('');
      setNewMeta(EMPTY_VALUE_META);
      onRefresh();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditValue = (value) => {
    if (!canManage) return;
    setEditingValue({
      id: value.id,
      value: value.value || '',
      displayLabel: value.displayLabel || '',
      swatchColor: value.swatchColor || '',
      imageUrl: value.imageUrl || '',
      unitLabel: value.unitLabel || '',
    });
  };

  const handleUpdateValue = async () => {
    if (!canManage || !editingValue?.id || !editingValue.value.trim()) return;
    try {
      setSaving(true);
      await attributeService.updateAttributeValue(attribute.id, editingValue.id, {
        value: editingValue.value.trim(),
        displayLabel: editingValue.displayLabel.trim() || null,
        swatchColor: editingValue.swatchColor.trim() || null,
        imageUrl: editingValue.imageUrl.trim() || null,
        unitLabel: editingValue.unitLabel.trim() || null,
      });
      setEditingValue(null);
      onRefresh();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (valueId) => {
    if (!canManage) return;
    const confirmed = await confirm('Remove Value', 'Are you sure you want to remove this attribute value?', 'error');
    if (!confirmed) return;
    try {
      await attributeService.removeAttributeValue(attribute.id, valueId);
      onRefresh();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    }
  };


  const handleDragEnd = async (result) => {
    if (!result.destination || !canManage) return;
    if (result.destination.index === result.source.index) return;

    const items = Array.from(attribute.values || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const valueIds = items.map(item => item.id);
    
    try {
      setSaving(true);
      await attributeService.reorderAttributeValues(attribute.id, valueIds);
      onRefresh();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" gutterBottom>Values (Drag to reorder)</Typography>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`values-${attribute.id}`} direction="horizontal">
          {(provided) => (
            <Box 
              ref={provided.innerRef} 
              {...provided.droppableProps}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
            >
              {(attribute.values || []).length === 0 && (
                <Typography variant="body2" color="text.secondary">No values yet.</Typography>
              )}
              {(attribute.values || []).map((value, index) => (
                <Draggable 
                  key={value.id} 
                  draggableId={value.id} 
                  index={index}
                  isDragDisabled={!canManage || saving}
                >
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        bgcolor: snapshot.isDragging ? 'action.hover' : 'transparent',
                        borderRadius: 1,
                        opacity: snapshot.isDragging ? 0.8 : 1
                      }}
                    >
                      <Chip
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {canManage && (
                              <Box {...provided.dragHandleProps} sx={{ display: 'flex', cursor: 'grab' }}>
                                <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              </Box>
                            )}
                            {value.swatchColor && (
                              <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: value.swatchColor, border: '1px solid', borderColor: 'divider' }} />
                            )}
                            {value.imageUrl && (
                              <Box component="img" src={value.imageUrl} alt="" sx={{ width: 18, height: 18, borderRadius: 0.75, objectFit: 'cover' }} />
                            )}
                            {value.displayLabel || value.value}{value.unitLabel && !String(value.displayLabel || value.value).toLowerCase().includes(value.unitLabel.toLowerCase()) ? value.unitLabel : ''}
                          </Box>
                        }
                        size="small"
                        onDelete={canManage ? () => handleRemove(value.id) : undefined}
                        onClick={canManage ? () => openEditValue(value) : undefined}
                        sx={{ 
                          cursor: canManage ? 'pointer' : 'default',
                          '& .MuiChip-label': { pl: canManage ? 0.5 : 1 }
                        }}
                      />
                    </Box>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>

        <TextField
          size="small"
          placeholder="New value…"
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
          sx={{ width: 220 }}
        />
        <TextField
          size="small"
          placeholder="Display label"
          value={newMeta.displayLabel}
          onChange={(event) => setNewMeta((current) => ({ ...current, displayLabel: event.target.value }))}
          sx={{ width: 150 }}
        />
        <TextField
          size="small"
          placeholder="#000 or red"
          value={newMeta.swatchColor}
          onChange={(event) => setNewMeta((current) => ({ ...current, swatchColor: event.target.value }))}
          sx={{ width: 130 }}
        />
        <TextField
          size="small"
          placeholder="Unit"
          value={newMeta.unitLabel}
          onChange={(event) => setNewMeta((current) => ({ ...current, unitLabel: event.target.value }))}
          sx={{ width: 90 }}
        />
        <Button variant="outlined" size="small" onClick={handleAdd} disabled={!canManage || saving || !newValue.trim()}>
          Add
        </Button>
      </Box>

      <Dialog open={!!editingValue} onClose={() => setEditingValue(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Attribute Value</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Value"
                fullWidth
                value={editingValue?.value || ''}
                onChange={(event) => setEditingValue((current) => ({ ...current, value: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Display label"
                fullWidth
                value={editingValue?.displayLabel || ''}
                onChange={(event) => setEditingValue((current) => ({ ...current, displayLabel: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Swatch color"
                placeholder="#111827 or red"
                fullWidth
                value={editingValue?.swatchColor || ''}
                onChange={(event) => setEditingValue((current) => ({ ...current, swatchColor: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Unit override"
                placeholder="kg, GB, ml"
                fullWidth
                value={editingValue?.unitLabel || ''}
                onChange={(event) => setEditingValue((current) => ({ ...current, unitLabel: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Image swatch URL"
                fullWidth
                value={editingValue?.imageUrl || ''}
                onChange={(event) => setEditingValue((current) => ({ ...current, imageUrl: event.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditingValue(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateValue} disabled={saving || !editingValue?.value?.trim()}>
            Save Value
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const AttributesPage = () => {
  const { hasPermission } = useAuth();
  const { notify } = useNotification();
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', displayType: 'auto', valueType: 'auto', unit: '' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const canManageAttributes = hasPermission(PERMISSIONS.ATTRIBUTES_MANAGE);


  const fetchAttributes = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await attributeService.getAttributes({ 
        page: page + 1, 
        limit: rowsPerPage 
      });
      const data = response?.data?.data || {};
      setAttributes(data.rows || []);
      setTotalItems(data.count || 0);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load attributes'));
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage]);


  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const openCreate = () => {
    if (!canManageAttributes) return;
    setEditing(null);
    setFormData({ name: '', displayType: 'auto', valueType: 'auto', unit: '' });
    setDialogOpen(true);
  };

  const openEdit = (attribute) => {
    if (!canManageAttributes) return;
    setEditing(attribute);
    setFormData({
      name: attribute.name,
      displayType: attribute.displayType || 'auto',
      valueType: attribute.valueType || 'auto',
      unit: attribute.unit || '',
    });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!canManageAttributes) return;
    try {
      if (editing) {
        await attributeService.updateAttribute(editing.id, formData);
      } else {
        await attributeService.createAttribute(formData);
      }
      handleDialogClose();
      fetchAttributes();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!canManageAttributes) return;
    const confirmed = await confirm(
      'Delete Attribute Template',
      'Are you sure you want to delete this attribute template? This will also remove all its values and category links.',
      'error'
    );
    if (!confirmed) return;
    try {
      await attributeService.deleteAttribute(id);
      fetchAttributes();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    }
  };


  const toggleExpanded = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };


  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Attribute Templates</Typography>
        {canManageAttributes && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            New Attribute
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.paper' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Slug</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Rendering</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Values</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>

            </TableHead>
            <TableBody>
              {attributes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No attribute templates yet. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
              {attributes.map((attribute) => (
                <React.Fragment key={attribute.id}>
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 600 }}>{attribute.name}</TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1 }}>
                        {attribute.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          label={DISPLAY_TYPE_OPTIONS.find((option) => option.value === (attribute.displayType || 'auto'))?.label || 'Auto detect'}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={VALUE_TYPE_OPTIONS.find((option) => option.value === (attribute.valueType || 'auto'))?.label || 'Auto detect'}
                        />
                        {attribute.unit && <Chip size="small" variant="outlined" label={attribute.unit} />}
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Button
                        size="small"
                        variant="text"
                        endIcon={expanded[attribute.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        onClick={() => toggleExpanded(attribute.id)}
                      >
                        {(attribute.values || []).length} value{(attribute.values || []).length !== 1 ? 's' : ''}
                      </Button>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(attribute)} disabled={!canManageAttributes}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(attribute.id)} disabled={!canManageAttributes}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                      <Collapse in={!!expanded[attribute.id]} timeout="auto" unmountOnExit>
                        <ValuesPanel attribute={attribute} onRefresh={fetchAttributes} canManage={canManageAttributes} />
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={totalItems}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </Paper>

      )}

      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? 'Edit Attribute' : 'New Attribute'}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="Name"
            fullWidth
            value={formData.name}
            onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
            sx={{ mb: 2 }}
            autoFocus
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Display Style</InputLabel>
                <Select
                  label="Display Style"
                  value={formData.displayType}
                  onChange={(event) => setFormData((current) => ({ ...current, displayType: event.target.value }))}
                >
                  {DISPLAY_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Value Type</InputLabel>
                <Select
                  label="Value Type"
                  value={formData.valueType}
                  onChange={(event) => setFormData((current) => ({ ...current, valueType: event.target.value }))}
                >
                  {VALUE_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Default unit"
                placeholder="kg, cm, GB, ml"
                fullWidth
                size="small"
                value={formData.unit}
                onChange={(event) => setFormData((current) => ({ ...current, unit: event.target.value }))}
                helperText="Optional. Used to format values like 500g, 1kg, 128GB, or 1L."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!canManageAttributes || !formData.name.trim()}>
            {editing ? 'Save Changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const AttributesPageWithBoundary = () => (
  <AppErrorBoundary>
    <AttributesPage />
  </AppErrorBoundary>
);

export default AttributesPageWithBoundary;
