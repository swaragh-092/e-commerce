import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  TextField,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Switch,
  FormControlLabel,
  MenuItem,
} from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalOffer as TagIcon,
  Store as StoreIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import * as promotionService from '../../services/promotionService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function PromotionsPage() {
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canManage = hasPermission(PERMISSIONS.PROMOTIONS_MANAGE);
  const canRead = hasPermission(PERMISSIONS.PROMOTIONS_READ) || canManage;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    type: 'sale',
    badgeColor: '',
    badgeIcon: '',
    description: '',
    startDate: '',
    endDate: '',
    priority: 0,
    isActive: true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: '' });

  const fetchPromotions = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const res = await promotionService.getPromotions({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
      });
      setRows(res.data?.data || []);
      setTotal(res.data?.meta?.total || 0);
    } catch (err) {
      notify('Failed to load promotions.', 'error');
    } finally {
      setLoading(false);
    }
  }, [paginationModel, search, notify, canRead]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const handleOpenDialog = (promo = null) => {
    if (!canManage) {
      notify('You do not have permission to manage promotions.', 'error');
      return;
    }

    if (promo) {
      setEditingPromo(promo);
      setFormData({
        name: promo.name,
        label: promo.label,
        type: promo.type || 'sale',
        badgeColor: promo.badgeColor || '',
        badgeIcon: promo.badgeIcon || '',
        description: promo.description || '',
        startDate: promo.startDate ? promo.startDate.substring(0, 16) : '',
        endDate: promo.endDate ? promo.endDate.substring(0, 16) : '',
        priority: promo.priority || 0,
        isActive: promo.isActive,
      });
    } else {
      setEditingPromo(null);
      setFormData({
        name: '',
        label: '',
        type: 'sale',
        badgeColor: '',
        badgeIcon: '',
        description: '',
        startDate: '',
        endDate: '',
        priority: 0,
        isActive: true,
      });
    }
    setErrors({});
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingPromo(null);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.label.trim()) errs.label = 'Label is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!canManage) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      };

      if (editingPromo) {
        await promotionService.updatePromotion(editingPromo.id, payload);
        notify('Promotion updated successfully.', 'success');
      } else {
        await promotionService.createPromotion(payload);
        notify('Promotion created successfully.', 'success');
      }
      handleCloseDialog();
      fetchPromotions();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to save promotion'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canManage) return;

    try {
      await promotionService.deletePromotion(deleteConfirm.id);
      notify('Promotion deleted successfully.', 'success');
      setDeleteConfirm({ open: false, id: null, name: '' });
      fetchPromotions();
    } catch (err) {
      notify('Failed to delete promotion', 'error');
    }
  };

  const columns = [
    {
      field: 'status',
      headerName: '',
      width: 60,
      renderCell: (params) => (
        <TagIcon color={params.row.isActive ? 'primary' : 'disabled'} />
      ),
    },
    { field: 'name', headerName: 'Campaign Name', flex: 1, minWidth: 200 },
    { 
      field: 'label', 
      headerName: 'Badge Label', 
      width: 150,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          size="small" 
          sx={{ fontWeight: 'bold' }}
        />
      )
    },
    { field: 'type', headerName: 'Type', width: 120, textTransform: 'capitalize' },
    {
      field: 'startDate',
      headerName: 'Start Date',
      width: 160,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : 'N/A',
    },
    {
      field: 'endDate',
      headerName: 'End Date',
      width: 160,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : 'N/A',
    },
    {
      field: 'productsCount',
      headerName: 'Products',
      width: 100,
      renderCell: (params) => params.row.products?.length || 0,
    },
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
  ];

  if (canManage) {
    columns.push({
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 150,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<StoreIcon />}
          label="Manage Products"
          onClick={() => navigate(`/admin/promotions/${params.id}`)}
        />,
        <GridActionsCellItem
          icon={<EditIcon />}
          label="Edit"
          onClick={() => handleOpenDialog(params.row)}
        />,
        <GridActionsCellItem
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => setDeleteConfirm({ open: true, id: params.id, name: params.row.name })}
          color="error"
        />,
      ],
    });
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Promotions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage sale campaigns and dynamic display labels
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Create Promotion
          </Button>
        )}
      </Stack>

      <Paper sx={{ mb: 3, p: 2 }}>
        <form onSubmit={handleSearch}>
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              placeholder="Search promotions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{ width: 300 }}
            />
            <Button type="submit" variant="outlined">
              Search
            </Button>
            {search && (
              <Button
                variant="text"
                color="inherit"
                onClick={() => {
                  setSearch('');
                  setSearchInput('');
                  setPaginationModel((p) => ({ ...p, page: 0 }));
                }}
              >
                Clear
              </Button>
            )}
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
        <DialogTitle>{editingPromo ? 'Edit Promotion' : 'New Promotion'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} mt={1}>
            <TextField
              fullWidth
              label="Campaign Name *"
              helperText={errors.name || "Internal use (e.g. 'Summer Clearance 2026')"}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!errors.name}
            />
            
            <TextField
              fullWidth
              label="Badge Label *"
              helperText={errors.label || "Storefront text (e.g. 'Flash Sale')"}
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              error={!!errors.label}
            />

            <Stack direction="row" spacing={2}>
              <TextField
                select
                fullWidth
                label="Campaign Type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <MenuItem value="sale">Regular Sale</MenuItem>
                <MenuItem value="flash">Flash Sale</MenuItem>
                <MenuItem value="seasonal">Seasonal</MenuItem>
                <MenuItem value="clearance">Clearance</MenuItem>
                <MenuItem value="bundle">Bundle</MenuItem>
              </TextField>

              <TextField
                fullWidth
                label="Badge Color (Hex)"
                placeholder="e.g. #FF4500"
                value={formData.badgeColor}
                onChange={(e) => setFormData({ ...formData, badgeColor: e.target.value })}
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Start Date"
                InputLabelProps={{ shrink: true }}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
              <TextField
                fullWidth
                type="datetime-local"
                label="End Date"
                InputLabelProps={{ shrink: true }}
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </Stack>

            <TextField
              fullWidth
              label="Description (Internal)"
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <Stack direction="row" spacing={4} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
              <TextField
                type="number"
                label="Priority"
                size="small"
                sx={{ width: 100 }}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) || 0 })}
                helperText="Higher overrides"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Promotion'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: null, name: '' })}>
        <DialogTitle>Delete Promotion?</DialogTitle>
        <DialogContent>
          Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? 
          Products assigned to this campaign will lose their badges immediately.
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
}
