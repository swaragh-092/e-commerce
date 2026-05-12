import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  TextField,
  Stack,
  Tooltip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Switch,
  FormControlLabel,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ElectricBolt as ElectricBoltIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';
import brandService from '../../services/brandService';
import { getMediaUrl } from '../../utils/media';
import { useNotification } from '../../context/NotificationContext';
import MediaPicker from '../../components/common/MediaPicker';
import { useAuth } from '../../hooks/useAuth';
import { useBrands } from '../../context/BrandContext';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

const generateSlug = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const BrandsPage = () => {
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const { refreshBrands } = useBrands();

  const canCreateBrand = hasPermission(PERMISSIONS.PRODUCTS_CREATE);
  const canUpdateBrand = hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canDeleteBrand = hasPermission(PERMISSIONS.PRODUCTS_DELETE);
  const canUploadMedia = hasPermission(PERMISSIONS.MEDIA_UPLOAD);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    image: '',
    isActive: true,
    isPromoted: false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: '' });

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const res = await brandService.getBrands({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      });
      setRows(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch (err) {
      notify('Failed to load brands.', 'error');
    } finally {
      setLoading(false);
    }
  }, [paginationModel, search, statusFilter, notify]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const handleOpenDialog = (brand = null) => {
    if ((brand && !canUpdateBrand) || (!brand && !canCreateBrand)) {
      notify('You do not have permission to manage brands.', 'error');
      return;
    }

    if (brand) {
      setEditingBrand(brand);
      setFormData({
        name: brand.name,
        slug: brand.slug,
        description: brand.description || '',
        image: brand.image || '',
        isActive: brand.isActive,
        isPromoted: Boolean(brand.isPromoted),
      });
    } else {
      setEditingBrand(null);
      setFormData({
        name: '',
        slug: '',
        description: '',
        image: '',
        isActive: true,
        isPromoted: false,
      });
    }
    setErrors({});
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingBrand(null);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if ((editingBrand && !canUpdateBrand) || (!editingBrand && !canCreateBrand)) {
      notify('You do not have permission to manage brands.', 'error');
      return;
    }

    if (!validate()) return;

    const payload = {
      ...formData,
      slug: formData.slug.trim() || null,
      description: formData.description.trim() || null,
      image: formData.image || null,
    };

    setSaving(true);
    try {
      if (editingBrand) {
        await brandService.updateBrand(editingBrand.id, payload);
        notify('Brand updated successfully.', 'success');
      } else {
        await brandService.createBrand(payload);
        notify('Brand created successfully.', 'success');
      }
      handleCloseDialog();
      fetchBrands();
      refreshBrands();
    } catch (err) {
      const apiError = err?.response?.data?.error;
      if (apiError?.details && Array.isArray(apiError.details)) {
        const fieldErrors = {};
        apiError.details.forEach((d) => {
          fieldErrors[d.field] = d.message;
        });
        setErrors(fieldErrors);
        notify(apiError.message || 'Validation failed', 'error');
      } else {
        notify(getApiErrorMessage(err, 'Failed to save brand'), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteBrand) {
      notify('You do not have permission to delete brands.', 'error');
      return;
    }

    try {
      await brandService.deleteBrand(deleteConfirm.id);
      notify('Brand deleted successfully.', 'success');
      setDeleteConfirm({ open: false, id: null, name: '' });
      fetchBrands();
      refreshBrands();
    } catch (err) {
      notify('Failed to delete brand', 'error');
    }
  };


  const handleMediaSelect = (media) => {
    if (!media || !media.length) return;
    const selected = media[0];
    setFormData((prev) => ({ ...prev, image: selected.url }));
    setMediaPickerOpen(false);
  };

  const columns = [
    {
      field: 'image',
      headerName: '',
      width: 60,
      sortable: false,
      renderCell: (params) => (
        <Avatar
          src={getMediaUrl(params.value)}
          variant="rounded"
          sx={{ width: 40, height: 40, bgcolor: 'action.hover' }}
        >
          {params.row.name?.[0]}
        </Avatar>
      ),
    },
    { field: 'name', headerName: 'Brand Name', flex: 1, minWidth: 200 },
    { field: 'slug', headerName: 'Slug', width: 200 },
    {
      field: 'isActive',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'isPromoted',
      headerName: 'Promotion',
      width: 150,
      renderCell: (params) => (
        <Chip
          icon={params.value ? <CampaignIcon /> : undefined}
          label={params.value ? 'Promoted' : 'Not promoted'}
          color={params.value ? 'primary' : 'default'}
          variant={params.value ? 'filled' : 'outlined'}
          size="small"
        />
      ),
    },
  ];

  if (canUpdateBrand || canDeleteBrand) {
    columns.push({
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      getActions: (params) => {
        const actions = [];

        if (canUpdateBrand) {
          actions.push(
            <GridActionsCellItem
              icon={<EditIcon />}
              label="Edit"
              onClick={() => handleOpenDialog(params.row)}
            />
          );
        }

        if (canDeleteBrand) {
          actions.push(
            <GridActionsCellItem
              icon={<DeleteIcon />}
              label="Delete"
              onClick={() => setDeleteConfirm({ open: true, id: params.id, name: params.row.name })}
              color="error"
            />
          );
        }

        return actions;
      },
    });
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Brands
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage product brands and logos
          </Typography>
        </Box>
        {canCreateBrand && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Brand
          </Button>
        )}
      </Stack>

      <Paper sx={{ mb: 3, p: 2 }}>
        <form onSubmit={handleSearch}>
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              placeholder="Search brands..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{ width: 300 }}
            />
            <FormControl size="small" sx={{ width: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPaginationModel((prev) => ({ ...prev, page: 0 }));
                }}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active Only</MenuItem>
                <MenuItem value="inactive">Inactive Only</MenuItem>
              </Select>
            </FormControl>
            <Button type="submit" variant="outlined">
              Search
            </Button>
            <Button 
              variant="text" 
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setStatusFilter('all');
                setPaginationModel((prev) => ({ ...prev, page: 0 }));
              }}
            >
              Reset
            </Button>
          </Stack>
        </form>
      </Paper>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={total}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          paginationMode="server"
          disableRowSelectionOnClick
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingBrand ? 'Edit Brand' : 'New Brand'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Brand Name *"
              value={formData.name}
              onChange={(e) => {
                const newName = e.target.value;
                setFormData((prev) => {
                  const newData = { ...prev, name: newName };
                  // Auto-update slug if it's a new brand and slug hasn't been manually edited
                  if (!editingBrand && (!prev.slug || prev.slug === generateSlug(prev.name))) {
                    newData.slug = generateSlug(newName);
                  }
                  return newData;
                });
              }}
              error={!!errors.name}
              helperText={errors.name}
            />
            <TextField
              fullWidth
              label="Slug"
              placeholder="Auto-generated if empty"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              error={!!errors.slug}
              helperText={
                errors.slug || (
                  formData.slug 
                    ? 'Slug used in URLs' 
                    : formData.name 
                      ? `Preview: ${generateSlug(formData.name)}` 
                      : 'Auto-generated from name if left blank'
                )
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Regenerate slug from name">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => setFormData({ ...formData, slug: generateSlug(formData.name) })}
                          disabled={!formData.name?.trim()}
                        >
                          <ElectricBoltIcon fontSize="small" color="warning" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              inputProps={{ maxLength: 2000 }}
              helperText={`${formData.description?.length || 0}/2000 characters`}
              error={!!errors.description}
            />
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Brand Logo
              </Typography>
              {formData.image && (
                <Box sx={{ mb: 2, position: 'relative', width: 100, height: 100 }}>
                  <Avatar
                    src={getMediaUrl(formData.image)}
                    variant="rounded"
                    sx={{ width: 100, height: 100, border: '1px solid', borderColor: 'divider' }}
                  />
                  <IconButton
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                      '&:hover': { bgcolor: 'error.50' },
                    }}
                    onClick={() => setFormData({ ...formData, image: '' })}
                    disabled={!canUpdateBrand && !canCreateBrand}
                  >
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
                </Box>
              )}
              {canUploadMedia ? (
                <Box>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => setMediaPickerOpen(true)}
                    sx={{
                      py: 1.5,
                      borderStyle: 'dashed',
                      borderWidth: 2,
                      '&:hover': { borderStyle: 'dashed', borderWidth: 2 },
                    }}
                  >
                    Select or Upload Logo
                  </Button>
                  <MediaPicker
                    open={mediaPickerOpen}
                    onClose={() => setMediaPickerOpen(false)}
                    onSelect={handleMediaSelect}
                    multiple={false}
                    title="Select Brand Logo"
                  />
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Media upload permission is required to add or replace a brand logo.
                </Typography>
              )}
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              }
              label="Active"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isPromoted}
                  onChange={(e) => setFormData({ ...formData, isPromoted: e.target.checked })}
                />
              }
              label="Promote this brand"
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
              Promoted brands appear in Featured Brands only when they have at least one published product.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Brand'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: null, name: '' })}>
        <DialogTitle>Delete Brand?</DialogTitle>
        <DialogContent>
          Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? 
          Products assigned to this brand will have their brand association removed.
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteConfirm({ open: false, id: null, name: '' })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BrandsPage;
