import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, TextField, MenuItem, FormControl, InputLabel, Select,
  Stack, DialogActions, Button,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { getAuditLogs } from '../../services/adminService';

const ENTITIES = ['', 'Product', 'Order', 'User', 'Coupon', 'Settings', 'Review'];
const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'];

const actionColor = { CREATE: 'success', UPDATE: 'info', DELETE: 'error', STATUS_CHANGE: 'warning' };

const AuditLogPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [filters, setFilters] = useState({ entity: '', action: '', from: '', to: '' });
  const [diff, setDiff] = useState(null); // { changes, action, entity, entityId, user }

  const fetchLogs = useCallback(() => {
    setLoading(true);
    getAuditLogs({
      ...filters,
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
    })
      .then((res) => {
        setRows(res.data.data?.rows || res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [paginationModel, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  const columns = [
    {
      field: 'createdAt', headerName: 'Timestamp', width: 170,
      renderCell: ({ value }) => new Date(value).toLocaleString(),
    },
    {
      field: 'user', headerName: 'Admin', flex: 1,
      renderCell: ({ row }) =>
        row.User ? `${row.User.firstName} ${row.User.lastName}` : '—',
    },
    {
      field: 'action', headerName: 'Action', width: 130,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" color={actionColor[value] || 'default'} />
      ),
    },
    { field: 'entity', headerName: 'Entity', width: 120 },
    { field: 'entityId', headerName: 'Entity ID', width: 190 },
    { field: 'ipAddress', headerName: 'IP', width: 130 },
    {
      field: 'changes', headerName: 'Diff', width: 80, sortable: false,
      renderCell: ({ row }) => row.changes ? (
        <Tooltip title="View diff">
          <IconButton size="small" onClick={() => setDiff(row)}>
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null,
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Audit Log</Typography>

      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" gap={1}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Entity</InputLabel>
          <Select value={filters.entity} label="Entity" onChange={(e) => setFilter('entity', e.target.value)}>
            {ENTITIES.map((e) => <MenuItem key={e} value={e}>{e || 'All'}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Action</InputLabel>
          <Select value={filters.action} label="Action" onChange={(e) => setFilter('action', e.target.value)}>
            {ACTIONS.map((a) => <MenuItem key={a} value={a}>{a || 'All'}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="From" type="date" InputLabelProps={{ shrink: true }}
          value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        <TextField size="small" label="To" type="date" InputLabelProps={{ shrink: true }}
          value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
      </Stack>

      <Box sx={{ height: 600, bgcolor: 'white', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
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

      {/* Diff Modal */}
      <Dialog open={Boolean(diff)} onClose={() => setDiff(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {diff?.action} — {diff?.entity} ({diff?.entityId})
        </DialogTitle>
        <DialogContent dividers>
          <Box component="pre"
            sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
            {JSON.stringify(diff?.changes, null, 2)}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiff(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditLogPage;
