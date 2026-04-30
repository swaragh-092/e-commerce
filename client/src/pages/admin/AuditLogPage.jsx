import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack,
  DialogActions,
  Button,
  Avatar,
  Paper,
  Grid,
  alpha,
  useTheme,
  Divider,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import PersonIcon from '@mui/icons-material/PersonOutline';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { getAuditLogs } from '../../services/adminService';

const ENTITIES = ['', 'Product', 'Order', 'User', 'Coupon', 'Settings', 'Review', 'Category', 'Brand', 'Shipping', 'Payment'];
const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'LOGOUT'];

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
  const [diff, setDiff] = useState(null);

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

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

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
      field: 'action',
      headerName: 'Action',
      width: 150,
      renderCell: ({ value }) => (
        <Chip
          label={value}
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.65rem',
            letterSpacing: '0.05em',
            bgcolor: alpha(actionColor[value] || '#757575', 0.1),
            color: actionColor[value] || '#757575',
            border: `1px solid ${alpha(actionColor[value] || '#757575', 0.2)}`,
            borderRadius: '6px',
            textTransform: 'uppercase',
          }}
        />
      ),
    },
    {
      field: 'entity',
      headerName: 'Resource',
      width: 140,
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
      headerName: 'Access Info',
      width: 180,
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
      width: 90,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: ({ row }) =>
        row.changes ? (
          <Tooltip title="Examine Changes">
            <IconButton
              size="small"
              onClick={() => setDiff(row)}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) },
              }}
            >
              <InfoIcon fontSize="small" color="primary" />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.disabled">
            None
          </Typography>
        ),
    },
  ];

  return (
    <Box sx={{ p: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em', mb: 0.5 }}>
            Audit Infrastructure
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Comprehensive history of administrative operations and system mutations.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => fetchLogs()}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Refresh Logs
          </Button>
        </Stack>
      </Stack>

      {/* KPI Section */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 100%)`,
            }}
          >
            <Typography variant="caption" fontWeight={700} color="primary" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Total Operations
            </Typography>
            <Typography variant="h3" fontWeight={800} mt={1}>
              {total.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.05)} 0%, transparent 100%)`,
            }}
          >
            <Typography variant="caption" fontWeight={700} color="success.main" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Logins (this page)
            </Typography>
            <Typography variant="h3" fontWeight={800} mt={1}>
              {rows.filter(r => r.action === 'LOGIN').length}+
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.05)} 0%, transparent 100%)`,
            }}
          >
            <Typography variant="caption" fontWeight={700} color="error.main" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Deletions (this page)
            </Typography>
            <Typography variant="h3" fontWeight={800} mt={1}>
              {rows.filter(r => r.action === 'DELETE').length}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)',
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by Entity ID or Actor..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.disabled' }} fontSize="small" />,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
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
          <Grid item xs={6} md={2}>
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
          <Grid item xs={6} md={2.5}>
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
          <Grid item xs={6} md={2.5}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<FilterListIcon />}
              onClick={() => fetchLogs()}
              sx={{ borderRadius: 2, height: 40, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
            >
              Apply Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Grid */}
      <Box
        sx={{
          height: 650,
          bgcolor: 'background.paper',
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: `0 4px 24px ${alpha(theme.palette.common.black, 0.05)}`,
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
          rowHeight={64}
        />
      </Box>

      {/* Diff Modal */}
      <Dialog 
        open={Boolean(diff)} 
        onClose={() => setDiff(null)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, boxShadow: theme.shadows[20] }
        }}
      >
        <DialogTitle component="div" sx={{ p: 3, pb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Change Inspection
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {diff?.action} — {diff?.entity} (ID: {diff?.entityId})
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
        <DialogContent sx={{ p: 0 }}>
          <Box
            sx={{
              p: 3,
              bgcolor: '#0d1117', // Dark GitHub-like theme for code
              color: '#c9d1d9',
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: 13,
              lineHeight: 1.6,
              overflow: 'auto',
              maxHeight: '60vh',
            }}
          >
            <Box component="pre" sx={{ m: 0 }}>
              {JSON.stringify(diff?.changes, (key, value) => {
                const sensitiveKeys = ['password', 'token', 'secret', 'apikey', 'key', 'credential', 'privatekey', 'authorization'];
                if (key && sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
                  return '********';
                }
                return value;
              }, 2)}
            </Box>
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto', ml: 1 }}>
            IP: {diff?.ipAddress || 'Internal'} • {diff?.createdAt ? new Date(diff.createdAt).toLocaleString() : '—'}
          </Typography>
          <Button 
            onClick={() => setDiff(null)} 
            variant="contained" 
            sx={{ borderRadius: 2, px: 4, fontWeight: 700, boxShadow: 'none' }}
          >
            Dismiss
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditLogPage;
