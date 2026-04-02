import { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, FormControl, InputLabel,
  Select, Alert, LinearProgress, Switch, FormControlLabel,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../services/adminService';

const empty = {
  code: '', type: 'percentage', value: '', minOrderAmount: '', maxDiscount: '',
  usageLimit: '', perUserLimit: 1, startDate: '', endDate: '', isActive: true,
};

const CouponsPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create mode
  const [form, setForm] = useState(empty);
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => { fetchCoupons(); }, [paginationModel]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) await updateCoupon(editing.id, form);
      else await createCoupon(form);
      setOpen(false);
      fetchCoupons();
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.error?.message || 'Failed to save coupon.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    deleteCoupon(id).then(fetchCoupons).catch(() => setAlert({ type: 'error', msg: 'Failed to delete.' }));
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const columns = [
    { field: 'code', headerName: 'Code', width: 140, renderCell: ({ value }) => <strong>{value}</strong> },
    { field: 'type', headerName: 'Type', width: 110 },
    {
      field: 'value', headerName: 'Value', width: 90,
      renderCell: ({ row }) => row.type === 'percentage' ? `${row.value}%` : `$${row.value}`,
    },
    {
      field: 'usage', headerName: 'Usage', width: 120,
      renderCell: ({ row }) => {
        const pct = row.usageLimit ? (row.usedCount / row.usageLimit) * 100 : -1;
        return (
          <Box sx={{ width: '100%' }}>
            <Typography variant="caption">{row.usedCount}/{row.usageLimit ?? '∞'}</Typography>
            {pct >= 0 && <LinearProgress variant="determinate" value={Math.min(pct, 100)} sx={{ mt: 0.5 }} />}
          </Box>
        );
      },
    },
    {
      field: 'isActive', headerName: 'Active', width: 80,
      renderCell: ({ value }) => <Chip label={value ? 'Active' : 'Off'} size="small" color={value ? 'success' : 'default'} />,
    },
    {
      field: 'endDate', headerName: 'Expires', width: 120,
      renderCell: ({ value }) => value ? new Date(value).toLocaleDateString() : '—',
    },
    {
      field: 'actions', headerName: '', width: 90, sortable: false,
      renderCell: ({ row }) => (
        <>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Coupons</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New Coupon</Button>
      </Box>

      {alert && <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>{alert.msg}</Alert>}

      <Box sx={{ height: 560, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <DataGrid rows={rows} columns={columns} rowCount={total} loading={loading}
          paginationMode="server" paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel} disableRowSelectionOnClick />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField fullWidth size="small" label="Code" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select value={form.type} label="Type" onChange={(e) => set('type', e.target.value)}>
              <MenuItem value="percentage">Percentage</MenuItem>
              <MenuItem value="fixed_amount">Fixed Amount</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Value" type="number" value={form.value} onChange={(e) => set('value', e.target.value)} />
          <TextField fullWidth size="small" label="Min Order Amount" type="number" value={form.minOrderAmount || ''} onChange={(e) => set('minOrderAmount', e.target.value)} />
          <TextField fullWidth size="small" label="Usage Limit (blank = unlimited)" type="number" value={form.usageLimit || ''} onChange={(e) => set('usageLimit', e.target.value)} />
          <TextField fullWidth size="small" label="Per-User Limit" type="number" value={form.perUserLimit} onChange={(e) => set('perUserLimit', e.target.value)} />
          <TextField fullWidth size="small" label="Start Date" type="datetime-local" value={form.startDate?.slice(0, 16) || ''} InputLabelProps={{ shrink: true }} onChange={(e) => set('startDate', e.target.value)} />
          <TextField fullWidth size="small" label="End Date" type="datetime-local" value={form.endDate?.slice(0, 16) || ''} InputLabelProps={{ shrink: true }} onChange={(e) => set('endDate', e.target.value)} />
          <FormControlLabel control={<Switch checked={Boolean(form.isActive)} onChange={(e) => set('isActive', e.target.checked)} />} label="Active" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CouponsPage;
