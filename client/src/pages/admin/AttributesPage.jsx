import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, CircularProgress,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Collapse, Tooltip, Alert, Divider, TablePagination,
  FormControl, InputLabel, Select, MenuItem, Grid, InputAdornment
} from '@mui/material';

import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
  DragIndicator as DragIndicatorIcon,
  Search as SearchIcon, Clear as ClearIcon,
  RestartAlt as ResetIcon, FilterList as FilterListIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import attributeService from '../../services/attributeService';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useNotification } from '../../context/NotificationContext';
import AppErrorBoundary from '../../components/common/AppErrorBoundary';
import UnitSelector from '../../components/admin/UnitSelector';


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
    const confirmed = await confirm(
      'Remove Value',
      'Are you sure you want to remove this attribute value? Values in use by products or variant options cannot be removed.',
      'error'
    );
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
        <Box sx={{ width: 140 }}>
          <UnitSelector
            size="small"
            margin="none"
            placeholder="Unit"
            label=""
            value={newMeta.unitLabel}
            onChange={(val) => setNewMeta((current) => ({ ...current, unitLabel: val }))}
            helperText=""
          />
        </Box>
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
              <UnitSelector
                label="Unit override"
                placeholder="Select or type unit"
                size="medium"
                margin="none"
                value={editingValue?.unitLabel || ''}
                onChange={(val) => setEditingValue((current) => ({ ...current, unitLabel: val }))}
                helperText="Optional. Override default unit for this specific value."
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
  const { notify, confirm } = useNotification();
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

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [displayTypeFilter, setDisplayTypeFilter] = useState('all');
  const [valueTypeFilter, setValueTypeFilter] = useState('all');
  const [hasValuesFilter, setHasValuesFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('sortOrder-ASC');

  const canManageAttributes = hasPermission(PERMISSIONS.ATTRIBUTES_MANAGE);

  // Reset to first page when any search or filter changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, displayTypeFilter, valueTypeFilter, hasValuesFilter, sortFilter]);

  const fetchAttributes = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [sortBy, sortOrder] = sortFilter.split('-');
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        sortBy,
        sortOrder,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (displayTypeFilter !== 'all') params.displayType = displayTypeFilter;
      if (valueTypeFilter !== 'all') params.valueType = valueTypeFilter;
      if (hasValuesFilter !== 'all') params.hasValues = hasValuesFilter;

      const response = await attributeService.getAttributes(params);
      const data = response?.data?.data || {};
      setAttributes(data.rows || []);
      setTotalItems(data.count || 0);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load attributes'));
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch, displayTypeFilter, valueTypeFilter, hasValuesFilter, sortFilter]);

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
    displayTypeFilter !== 'all' ||
    valueTypeFilter !== 'all' ||
    hasValuesFilter !== 'all' ||
    sortFilter !== 'sortOrder-ASC'
  );

  const handleClearFilters = () => {
    setSearchInput('');
    setDisplayTypeFilter('all');
    setValueTypeFilter('all');
    setHasValuesFilter('all');
    setSortFilter('sortOrder-ASC');
    setPage(0);
  };

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
      'Are you sure you want to delete this attribute template? This will remove all its values and category links. Templates in use by products or variant options cannot be deleted.',
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
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Attribute Templates</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage product variation attributes, swatches, and specifications
          </Typography>
        </Box>
        {canManageAttributes && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} id="new-attribute-button">
            New Attribute
          </Button>
        )}
      </Box>

      {/* Search and Filters Toolbar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={1.5} alignItems="center">
          {/* Search Field */}
          <Grid item xs={12} sm={6} md={3.5}>
            <TextField
              id="attributes-search-input"
              size="small"
              fullWidth
              placeholder="Search by name, slug, or value..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchInput ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchInput('')} aria-label="clear search">
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Grid>

          {/* Display Style Filter */}
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="display-style-filter-label">Display Style</InputLabel>
              <Select
                labelId="display-style-filter-label"
                id="display-style-filter"
                value={displayTypeFilter}
                label="Display Style"
                onChange={(e) => setDisplayTypeFilter(e.target.value)}
              >
                <MenuItem value="all">All Styles</MenuItem>
                {DISPLAY_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Value Type Filter */}
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="value-type-filter-label">Value Type</InputLabel>
              <Select
                labelId="value-type-filter-label"
                id="value-type-filter"
                value={valueTypeFilter}
                label="Value Type"
                onChange={(e) => setValueTypeFilter(e.target.value)}
              >
                <MenuItem value="all">All Value Types</MenuItem>
                {VALUE_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Values Filter */}
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="has-values-filter-label">Values</InputLabel>
              <Select
                labelId="has-values-filter-label"
                id="has-values-filter"
                value={hasValuesFilter}
                label="Values"
                onChange={(e) => setHasValuesFilter(e.target.value)}
              >
                <MenuItem value="all">All Templates</MenuItem>
                <MenuItem value="yes">With Values</MenuItem>
                <MenuItem value="no">Empty / No Values</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Sort By Filter */}
          <Grid item xs={6} sm={3} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="sort-filter-label">Sort By</InputLabel>
              <Select
                labelId="sort-filter-label"
                id="sort-filter"
                value={sortFilter}
                label="Sort By"
                onChange={(e) => setSortFilter(e.target.value)}
              >
                <MenuItem value="sortOrder-ASC">Default (Sort Order)</MenuItem>
                <MenuItem value="name-ASC">Name (A → Z)</MenuItem>
                <MenuItem value="name-DESC">Name (Z → A)</MenuItem>
                <MenuItem value="createdAt-DESC">Newest Added</MenuItem>
                <MenuItem value="createdAt-ASC">Oldest Added</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Active Filter Chips Bar */}
        {hasActiveFilters && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mr: 0.5 }}>
              Active Filters:
            </Typography>
            {debouncedSearch.trim() && (
              <Chip
                size="small"
                label={`Search: "${debouncedSearch}"`}
                onDelete={() => setSearchInput('')}
                color="primary"
                variant="outlined"
              />
            )}
            {displayTypeFilter !== 'all' && (
              <Chip
                size="small"
                label={`Style: ${DISPLAY_TYPE_OPTIONS.find((o) => o.value === displayTypeFilter)?.label || displayTypeFilter}`}
                onDelete={() => setDisplayTypeFilter('all')}
                color="primary"
                variant="outlined"
              />
            )}
            {valueTypeFilter !== 'all' && (
              <Chip
                size="small"
                label={`Type: ${VALUE_TYPE_OPTIONS.find((o) => o.value === valueTypeFilter)?.label || valueTypeFilter}`}
                onDelete={() => setValueTypeFilter('all')}
                color="primary"
                variant="outlined"
              />
            )}
            {hasValuesFilter !== 'all' && (
              <Chip
                size="small"
                label={`Values: ${hasValuesFilter === 'yes' ? 'With Values' : 'Empty'}`}
                onDelete={() => setHasValuesFilter('all')}
                color="primary"
                variant="outlined"
              />
            )}
            {sortFilter !== 'sortOrder-ASC' && (
              <Chip
                size="small"
                label={`Sort: ${sortFilter === 'name-ASC' ? 'Name (A-Z)' : sortFilter === 'name-DESC' ? 'Name (Z-A)' : sortFilter === 'createdAt-DESC' ? 'Newest' : sortFilter === 'createdAt-ASC' ? 'Oldest' : sortFilter}`}
                onDelete={() => setSortFilter('sortOrder-ASC')}
                variant="outlined"
              />
            )}
            <Button
              size="small"
              color="inherit"
              startIcon={<ResetIcon fontSize="small" />}
              onClick={handleClearFilters}
              sx={{ ml: 'auto', textTransform: 'none', fontSize: '0.8rem', py: 0.25 }}
            >
              Reset Filters
            </Button>
          </Box>
        )}
      </Paper>

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
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    {hasActiveFilters ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <SearchIcon sx={{ fontSize: 40, color: 'action.disabled' }} />
                        <Typography variant="body1" fontWeight={600} color="text.primary">
                          No matching attribute templates
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Try adjusting your search query or filters
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<ResetIcon />}
                          onClick={handleClearFilters}
                          sx={{ mt: 1 }}
                        >
                          Clear All Filters
                        </Button>
                      </Box>
                    ) : (
                      'No attribute templates yet. Create one to get started.'
                    )}
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
              <UnitSelector
                label="Default unit"
                placeholder="Select or type unit (e.g. kg, cm, ml)"
                size="small"
                margin="none"
                value={formData.unit}
                onChange={(val) => setFormData((current) => ({ ...current, unit: val }))}
                helperText="Optional. Used to format values like 500g, 1kg, or 1L."
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
