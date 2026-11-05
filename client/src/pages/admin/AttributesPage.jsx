import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, CircularProgress,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Tooltip, Alert, Divider, TablePagination,
  FormControl, InputLabel, Select, MenuItem, Grid, InputAdornment
} from '@mui/material';

import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ListAlt as ValuesIcon,
  Search as SearchIcon, Clear as ClearIcon,
  RestartAlt as ResetIcon, FilterList as FilterListIcon
} from '@mui/icons-material';

import attributeService from '../../services/attributeService';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useNotification } from '../../context/NotificationContext';
import AppErrorBoundary from '../../components/common/AppErrorBoundary';
import UnitCategorySelector from '../../components/admin/UnitCategorySelector';
import { useUnitCatalog } from '../../context/UnitCatalogContext';
import { getAttributeUnitCategory } from '../../constants/units';
import AttributeValuesDialog from '../../components/admin/AttributeValuesDialog';
import AttributePresentationPreview from '../../components/admin/AttributePresentationPreview';
import UnitSettingsDialog from '../../components/admin/UnitSettingsDialog';
import SettingsIcon from '@mui/icons-material/Settings';


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

const AttributesPage = () => {
  const { units, loading: unitsLoading, error: unitsError } = useUnitCatalog();
  const { hasPermission } = useAuth();
  const { notify, confirm } = useNotification();
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [valuesAttribute, setValuesAttribute] = useState(null);
  const [savingAttribute, setSavingAttribute] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unitSettingsOpen, setUnitSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', displayType: 'auto', valueType: 'auto', unitCategory: '' });
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
    setFormData({ name: '', displayType: 'auto', valueType: 'auto', unitCategory: '' });
    setDialogOpen(true);
  };

  const openEdit = (attribute) => {
    if (!canManageAttributes) return;
    setEditing(attribute);
    setFormData({
      name: attribute.name,
      displayType: attribute.displayType || 'auto',
      valueType: attribute.valueType || 'auto',
      unitCategory: getAttributeUnitCategory(attribute, units),
    });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (savingAttribute) return;
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!canManageAttributes || savingAttribute) return;
    setSavingAttribute(true);
    try {
      const payload = { ...formData, unitCategory: formData.unitCategory || null };
      if (editing) {
        await attributeService.updateAttribute(editing.id, payload);
      } else {
        const response = await attributeService.createAttribute(payload);
        const created = response?.data?.data;
        if (created?.id) setValuesAttribute({ ...payload, ...created, values: created.values || [] });
        else notify('Attribute created. Open its values from the list to continue.', 'warning');
      }
      setDialogOpen(false);
      setEditing(null);
      fetchAttributes();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setSavingAttribute(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canManageAttributes) return;
    const confirmed = await confirm(
      'Delete Attribute Template',
      'Sure with deleting with Attribute?',
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
          <Typography variant="h5" component="h1" fontWeight="bold">Attribute Templates</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage product variation attributes, swatches, and specifications
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {hasPermission(PERMISSIONS.SETTINGS_MANAGE) && (
            <Button variant="outlined" startIcon={<SettingsIcon />} onClick={() => setUnitSettingsOpen(true)}>Unit settings</Button>
          )}
          {canManageAttributes && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} id="new-attribute-button">
              New Attribute
            </Button>
          )}
        </Box>
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
                  <TableRow
                    hover
                    tabIndex={0}
                    aria-label={`View values for ${attribute.name}`}
                    aria-haspopup="dialog"
                    onClick={() => setValuesAttribute(attribute)}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        setValuesAttribute(attribute);
                      }
                    }}
                    sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
                  >
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
                        {getAttributeUnitCategory(attribute, units) && <Chip size="small" variant="outlined" label={getAttributeUnitCategory(attribute, units)} />}
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<ValuesIcon />}
                        aria-haspopup="dialog"
                        onClick={(event) => { event.stopPropagation(); setValuesAttribute(attribute); }}
                      >
                        {(attribute.values || []).length} value{(attribute.values || []).length !== 1 ? 's' : ''}
                      </Button>
                    </TableCell>
                    <TableCell align="right" onClick={(event) => event.stopPropagation()}>
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

      {valuesAttribute && <AttributeValuesDialog
        key={valuesAttribute.id} initialAttribute={valuesAttribute}
        canManage={canManageAttributes} onChange={fetchAttributes}
        onClose={() => setValuesAttribute(null)}
      />}
      {unitSettingsOpen && <UnitSettingsDialog onClose={() => { setUnitSettingsOpen(false); fetchAttributes(); }} />}
      <Dialog open={dialogOpen} onClose={handleDialogClose} disableRestoreFocus={Boolean(valuesAttribute)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Attribute' : 'New Attribute'}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="Name"
            disabled={savingAttribute}
            fullWidth
            value={formData.name}
            onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
            sx={{ mb: 2 }}
            autoFocus
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" disabled={savingAttribute}>
                <InputLabel id="attribute-display-style-label">Display Style</InputLabel>
                <Select
                  labelId="attribute-display-style-label"
                  label="Display Style"
                  value={formData.displayType}
                  onChange={(event) => setFormData((current) => ({ ...current, displayType: event.target.value }))}
                >
                  {DISPLAY_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">How customers select an option on the product page. Auto chooses from the type, images, and number of choices.</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" disabled={savingAttribute}>
                <InputLabel id="attribute-value-type-label">Value Type</InputLabel>
                <Select
                  labelId="attribute-value-type-label"
                  label="Value Type"
                  value={formData.valueType}
                  onChange={(event) => setFormData((current) => ({ ...current, valueType: event.target.value }))}
                >
                  {VALUE_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">What the values represent. Auto uses the name and slug. This guides the automatic style; it does not validate numbers or select units.</Typography>
            </Grid>
            <Grid item xs={12}>
              <UnitCategorySelector
                disabled={savingAttribute}
                value={formData.unitCategory}
                onChange={(unitCategory) => setFormData((current) => ({ ...current, unitCategory }))}
              />
            </Grid>
          </Grid>
          <AttributePresentationPreview attribute={{ ...formData, slug: editing?.slug || '' }} values={editing?.values || []} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="error" onClick={handleDialogClose} disabled={savingAttribute}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={savingAttribute || !canManageAttributes || !formData.name.trim() || unitsLoading || Boolean(unitsError)}>
            {savingAttribute ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
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
