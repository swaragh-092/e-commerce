import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  LinearProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../services/adminService';
import { useNotification } from '../../context/NotificationContext';
import { useCurrency } from '../../hooks/useSettings';

const empty = {
  code: '',
  type: 'percentage',
  value: '',
  minOrderAmount: '',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: 1,
  startDate: '',
  endDate: '',
  isActive: true,
};

const CouponsPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create mode
  const [form, setForm] = useState(empty);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const notify = useNotification();
  const { formatPrice } = useCurrency();

  const validate = (f) => {
    const errs = {};
    if (!f.code?.trim()) errs.code = 'Code is required';
    if (f.value === '' || f.value === null || f.value === undefined) {
      errs.value = 'Value is required';
    } else if (Number(f.value) <= 0) {
      errs.value = 'Must be a positive number';
    } else if (f.type === 'percentage' && Number(f.value) > 100) {
      errs.value = 'Percentage cannot exceed 100';
    }
    if (
      f.minOrderAmount !== '' &&
      f.minOrderAmount !== null &&
      f.minOrderAmount !== undefined &&
      Number(f.minOrderAmount) < 0
    )
      errs.minOrderAmount = 'Must be 0 or more';
    if (
      f.type === 'percentage' &&
      f.maxDiscount !== '' &&
      f.maxDiscount !== null &&
      f.maxDiscount !== undefined &&
      Number(f.maxDiscount) < 0
    )
      errs.maxDiscount = 'Must be 0 or more';
    if (
      f.usageLimit !== '' &&
      f.usageLimit !== null &&
      f.usageLimit !== undefined &&
      Number(f.usageLimit) < 1
    )
      errs.usageLimit = 'Must be at least 1';
    if (
      f.perUserLimit !== '' &&
      f.perUserLimit !== null &&
      f.perUserLimit !== undefined &&
      Number(f.perUserLimit) < 1
    )
      errs.perUserLimit = 'Must be at least 1';
    if (!f.startDate) errs.startDate = 'Start date is required';
    if (!f.endDate) errs.endDate = 'End date is required';
    else if (f.startDate && new Date(f.endDate) <= new Date(f.startDate))
      errs.endDate = 'End date must be after start date';
    return errs;
  };

  const fetchCoupons = () => {
    setLoading(true);
    getCoupons({ page: paginationModel.page + 1, limit: paginationModel.pageSize })
      .then((res) => {
        setRows(res.data.data?.rows || res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCoupons();
  }, [paginationModel]);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setFormErrors({});
    setOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ ...row });
    setFormErrors({});
    setOpen(true);
  };

  const cleanForm = (f) => {
    const numericFields = ['value', 'minOrderAmount', 'maxDiscount', 'usageLimit', 'perUserLimit'];
    const out = { ...f };
    numericFields.forEach((k) => {
      if (out[k] === '' || out[k] === null || out[k] === undefined) {
        delete out[k];
      } else {
        out[k] = Number(out[k]);
      }
    });
    // applicableIds must be an array or omitted — never send null/non-array
    if (!Array.isArray(out.applicableIds) || out.applicableIds.length === 0) {
      delete out.applicableIds;
    }
    return out;
  };

  const handleSave = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    setSaving(true);
    try {
      const payload = cleanForm(form);
      if (editing) await updateCoupon(editing.id, payload);
      else await createCoupon(payload);
      setOpen(false);
      fetchCoupons();
    } catch (e) {
      const err = e.response?.data;
      const apiErr = err?.error || err;
      const msg = apiErr?.message || 'Failed to save coupon.';
      const details = apiErr?.details?.map((d) => d.message).join('; ');
      notify(details ? `${msg}: ${details}` : msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    deleteCoupon(id)
      .then(fetchCoupons)
      .catch(() => notify('Failed to delete.', 'error'));
  };

  const set = (k, v) => {
    setFormErrors((prev) => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
    setForm((f) => ({ ...f, [k]: v }));
  };

  const columns = [
    {
      field: 'code',
      headerName: 'Code',
      width: 140,
      renderCell: ({ value }) => <strong>{value}</strong>,
    },
    { field: 'type', headerName: 'Type', width: 110 },
    {
      field: 'value',
      headerName: 'Value',
      width: 90,
      renderCell: ({ row }) => (row.type === 'percentage' ? `${row.value}%` : formatPrice(row.value)),
    },
    {
      field: 'usage',
      headerName: 'Usage',
      width: 120,
      renderCell: ({ row }) => {
        const pct = row.usageLimit ? (row.usedCount / row.usageLimit) * 100 : -1;
        return (
          <Box sx={{ width: '100%' }}>
            <Typography variant="caption">
              {row.usedCount}/{row.usageLimit ?? '∞'}
            </Typography>
            {pct >= 0 && (
              <LinearProgress variant="determinate" value={Math.min(pct, 100)} sx={{ mt: 0.5 }} />
            )}
          </Box>
        );
      },
    },
    {
      field: 'isActive',
      headerName: 'Active',
      width: 80,
      renderCell: ({ value }) => (
        <Chip label={value ? 'Active' : 'Off'} size="small" color={value ? 'success' : 'default'} />
      ),
    },
    {
      field: 'endDate',
      headerName: 'Expires',
      width: 120,
      renderCell: ({ value }) => (value ? new Date(value).toLocaleDateString() : '—'),
    },
    {
      field: 'actions',
      headerName: '',
      width: 90,
      sortable: false,
      renderCell: ({ row }) => (
        <>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openEdit(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Coupons
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New Coupon
        </Button>
      </Box>

      <Box
        sx={{
          height: 560,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          disableRowSelectionOnClick
        />
      </Box>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setFormErrors({});
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editing ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Code *"
            value={form.code}
            error={!!formErrors.code}
            helperText={formErrors.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select value={form.type} label="Type" onChange={(e) => set('type', e.target.value)}>
              <MenuItem value="percentage">Percentage</MenuItem>
              <MenuItem value="fixed_amount">Fixed Amount</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            size="small"
            label={form.type === 'percentage' ? 'Value (%) *' : 'Value ($) *'}
            type="number"
            value={form.value}
            error={!!formErrors.value}
            helperText={formErrors.value}
            inputProps={{ min: 0, max: form.type === 'percentage' ? 100 : undefined, step: 'any' }}
            onChange={(e) => set('value', e.target.value)}
          />
          <TextField
            fullWidth
            size="small"
            label="Min Order Amount"
            type="number"
            value={form.minOrderAmount || ''}
            error={!!formErrors.minOrderAmount}
            helperText={formErrors.minOrderAmount}
            inputProps={{ min: 0, step: 'any' }}
            onChange={(e) => set('minOrderAmount', e.target.value)}
          />
          {form.type === 'percentage' && (
            <TextField
              fullWidth
              size="small"
              label="Max Discount Amount (blank = no cap)"
              type="number"
              value={form.maxDiscount || ''}
              error={!!formErrors.maxDiscount}
              helperText={formErrors.maxDiscount}
              inputProps={{ min: 0, step: 'any' }}
              onChange={(e) => set('maxDiscount', e.target.value)}
            />
          )}
          <TextField
            fullWidth
            size="small"
            label="Usage Limit (blank = unlimited)"
            type="number"
            value={form.usageLimit || ''}
            error={!!formErrors.usageLimit}
            helperText={formErrors.usageLimit}
            inputProps={{ min: 1, step: 1 }}
            onChange={(e) => set('usageLimit', e.target.value)}
          />
          <TextField
            fullWidth
            size="small"
            label="Per-User Limit"
            type="number"
            value={form.perUserLimit}
            error={!!formErrors.perUserLimit}
            helperText={formErrors.perUserLimit}
            inputProps={{ min: 1, step: 1 }}
            onChange={(e) => set('perUserLimit', e.target.value)}
          />
          <TextField
            fullWidth
            size="small"
            label="Start Date *"
            type="datetime-local"
            value={form.startDate?.slice(0, 16) || ''}
            InputLabelProps={{ shrink: true }}
            error={!!formErrors.startDate}
            helperText={formErrors.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
          <TextField
            fullWidth
            size="small"
            label="End Date *"
            type="datetime-local"
            value={form.endDate?.slice(0, 16) || ''}
            InputLabelProps={{ shrink: true }}
            error={!!formErrors.endDate}
            helperText={formErrors.endDate}
            onChange={(e) => set('endDate', e.target.value)}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.isActive)}
                onChange={(e) => set('isActive', e.target.checked)}
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpen(false);
              setFormErrors({});
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CouponsPage;
