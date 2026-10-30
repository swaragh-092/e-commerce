import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  DialogTitle,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Button,
  Avatar,
  Paper,
  Grid,
  alpha,
  useTheme,
  Divider,
  Drawer,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import PersonIcon from '@mui/icons-material/PersonOutline';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { getAuditLogs } from '../../services/adminService';

const ENTITIES = ['', 'Product', 'Order', 'User', 'Address', 'Payment', 'Category', 'Coupon', 'Review', 'Setting', 'Page', 'Brand', 'Media', 'Menu', 'MenuItem', 'Fulfillment', 'Shipment', 'OrderReturn', 'Return', 'Replacement', 'OrderRefund', 'BlogPost', 'BlogCategory', 'SEO_OVERRIDE', 'Role', 'Theme', 'InventoryAlertConfig', 'InventoryAlert', 'Enquiry', 'DesignDraft'];
const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'LOGOUT', 'REFRESH', 'PASSWORD_RESET', 'EMAIL_VERIFIED', 'VERIFICATION_RESENT'];

const humanize = (value = '') => String(value).toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const actionColor = {
  CREATE: '#2e7d32',
  UPDATE: '#0288d1',
  DELETE: '#d32f2f',
  STATUS_CHANGE: '#ed6c02',
  LOGIN: '#9c27b0',
  LOGOUT: '#757575',
};

const AuditLogPage = () => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [filters, setFilters] = useState({ entity: '', action: '', from: '', to: '', search: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [diff, setDiff] = useState(null);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    getAuditLogs({
      ...appliedFilters,
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
    })
      .then((res) => {
        setRows(res.data.data?.rows || res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [paginationModel, appliedFilters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
  const applyFilters = () => {
    setPaginationModel((model) => ({ ...model, page: 0 }));
    setAppliedFilters({ ...filters });
  };
  const clearFilters = () => {
    const empty = { entity: '', action: '', from: '', to: '', search: '' };
    setFilters(empty);
    setAppliedFilters(empty);
    setPaginationModel((model) => ({ ...model, page: 0 }));
  };
  const setDatePreset = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    const format = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setFilters((current) => ({ ...current, from: format(from), to: format(to) }));
  };

  const columns = [
    {
      field: 'createdAt',
      headerName: 'Timestamp',
      width: 200,
      renderCell: ({ value }) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(value).toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </Typography>
      ),
    },
    {
      field: 'user',
      headerName: 'Actor',
      flex: 1.5,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {row.User?.firstName?.[0] || <PersonIcon fontSize="small" />}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {row.User ? `${row.User.firstName} ${row.User.lastName}` : 'System'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {row.User?.email || 'automated-task'}
            </Typography>
          </Box>
        </Stack>
      ),
    },
    {
      field: 'activity',
      headerName: 'Activity',
      minWidth: 220,
      flex: 1.2,
      renderCell: ({ row }) => <Stack direction="row" spacing={1} alignItems="center"><Chip label={humanize(row.action)} size="small" sx={{ fontWeight: 700, bgcolor: alpha(actionColor[row.action] || '#757575', 0.1), color: actionColor[row.action] || '#757575', border: `1px solid ${alpha(actionColor[row.action] || '#757575', 0.2)}`, borderRadius: 1.5 }} /><Typography variant="body2" color="text.secondary">{humanize(row.entity || 'system')}</Typography></Stack>,
    },
    {
      field: 'entity',
      headerName: 'Resource',
      width: 160,
      renderCell: ({ value, row }) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            #{String(row.entityId ?? '').slice(-8) || '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'ipAddress',
      headerName: 'IP address',
      width: 150,
      renderCell: ({ value }) => (
        <Tooltip title={value || 'No IP recorded'}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
            {value || '—'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'changes',
      headerName: 'Details',
      width: 125,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: ({ row }) =>
        <Button size="small" startIcon={<InfoIcon fontSize="small" />} onClick={() => setDiff(row)} aria-label={`View details for ${humanize(row.action)} ${humanize(row.entity)}`} sx={{ textTransform: 'none', minWidth: 0 }}>View details</Button>,
    },
  ];

  return (
    <Box sx={{ p: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} mb={2.5} gap={2}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight={700} sx={{ mb: 0.5 }}>
            Audit Log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track administrative changes and account activity.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>{total.toLocaleString()} events</Typography>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => fetchLogs()}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Paper
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Search activity"
              placeholder="Actor, email, resource ID"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.disabled' }} fontSize="small" />,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Resource</InputLabel>
              <Select
                value={filters.entity}
                label="Resource"
                onChange={(e) => setFilter('entity', e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                {ENTITIES.map((e) => (
                  <MenuItem key={e} value={e}>
                    {e || 'All Resources'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Action</InputLabel>
              <Select
                value={filters.action}
                label="Action"
                onChange={(e) => setFilter('action', e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                {ACTIONS.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a || 'All Actions'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={filters.from}
                onChange={(e) => setFilter('from', e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={filters.to}
                onChange={(e) => setFilter('to', e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Stack>
          </Grid>
          <Grid item xs={12} md={2}>
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="contained" startIcon={<FilterListIcon />} onClick={applyFilters} sx={{ borderRadius: 2, height: 40, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}>Apply</Button>
              <Button onClick={clearFilters} sx={{ minWidth: 'auto', height: 40, textTransform: 'none' }}>Clear</Button>
            </Stack>
          </Grid>
          <Grid item xs={12}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">Quick range:</Typography>
              <Button size="small" onClick={() => setDatePreset(1)}>Today</Button>
              <Button size="small" onClick={() => setDatePreset(7)}>7 days</Button>
              <Button size="small" onClick={() => setDatePreset(30)}>30 days</Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Activity table */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          '& .MuiDataGrid-root': {
            border: 'none',
          },
          '& .MuiDataGrid-cell': {
            borderColor: alpha(theme.palette.divider, 0.5),
          },
          '& .MuiDataGrid-columnHeaders': {
            bgcolor: alpha(theme.palette.background.default, 0.5),
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: `1px solid ${theme.palette.divider}`,
          },
          '& .MuiDataGrid-row:hover': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
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
          autoHeight
          disableRowSelectionOnClick
          rowHeight={72}
          pageSizeOptions={[10, 20, 50]}
          localeText={{ noRowsLabel: 'No activity found. Try adjusting or clearing your filters.' }}
        />
      </Box>

      <Drawer anchor="right" open={Boolean(diff)} onClose={() => setDiff(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 0 } }}>
        <DialogTitle component="div" sx={{ p: 3, pb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Event details
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {humanize(diff?.action)} {diff?.entity && `· ${humanize(diff.entity)}`}
              </Typography>
            </Box>
            <Chip 
              label={diff?.action} 
              size="small" 
              sx={{ bgcolor: alpha(actionColor[diff?.action] || '#757575', 0.1), color: actionColor[diff?.action] || '#757575', fontWeight: 700 }} 
            />
          </Stack>
        </DialogTitle>
        <Divider />
        <Box sx={{ px: 3, pb: 2 }}>
          <Stack spacing={1.25}>
            <Typography variant="body2"><b>Actor:</b> {diff?.User ? `${diff.User.firstName || ''} ${diff.User.lastName || ''}`.trim() : 'System'}{diff?.User?.email ? ` · ${diff.User.email}` : ''}</Typography>
            <Typography variant="body2"><b>When:</b> {diff?.createdAt ? new Date(diff.createdAt).toLocaleString() : '—'}</Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}><b>Resource ID:</b> {diff?.entityId || '—'}</Typography>
            <Typography variant="body2"><b>IP address:</b> {diff?.ipAddress || 'Not recorded'}</Typography>
          </Stack>
        </Box>
        <Divider />
        <Box sx={{ p: 3, overflow: 'auto', flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Change data</Typography>
          {diff?.changes ? <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: theme.palette.mode === 'dark' ? '#0d1117' : 'grey.50',
              color: 'text.primary',
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.6,
              overflow: 'auto',
              maxHeight: '55vh',
            }}
          >
            <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {JSON.stringify(diff?.changes, (key, value) => {
                const sensitiveKeys = ['password', 'token', 'secret', 'apikey', 'key', 'credential', 'privatekey', 'authorization'];
                if (key && sensitiveKeys.some(s => key.toLowerCase().includes(s))) return '********';
                return value;
              }, 2)}
            </Box>
          </Box> : <Typography variant="body2" color="text.secondary">No change details were recorded for this event.</Typography>}
        </Box>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={() => setDiff(null)} variant="contained" sx={{ textTransform: 'none' }}>Close</Button>
        </Box>
      </Drawer>
    </Box>
  );
};

export default AuditLogPage;
