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
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { getNotificationLogs } from '../../services/adminService';

const CHANNELS = ['', 'email', 'sms', 'whatsapp'];
const STATUSES = ['', 'sent', 'failed', 'pending'];

const statusColor = {
  sent: 'success',
  failed: 'error',
  pending: 'warning',
};

const NotificationLogsPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [filters, setFilters] = useState({ channel: '', status: '', search: '' });
  const [content, setContent] = useState(null); // { id, templateName, channel, status, errorText, ... }

  const fetchLogs = useCallback(() => {
    setLoading(true);
    getNotificationLogs({
      ...filters,
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
    })
      .then((res) => {
        setRows(res.data.data?.logs || res.data.data || []);
        setTotal(res.data.data?.total || res.data.meta?.total || 0);
      })
      .catch((err) => {
          console.error(err);
          // fallbacks for errors
          setRows([]);
          setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [paginationModel, filters]);

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 300); // debounce search
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  const columns = [
    {
      field: 'createdAt',
      headerName: 'Timestamp',
      width: 170,
      renderCell: ({ value }) => new Date(value).toLocaleString(),
    },
    {
      field: 'templateName',
      headerName: 'Template',
      width: 150,
    },
    {
      field: 'channel',
      headerName: 'Channel',
      width: 100,
      renderCell: ({ value }) => (
        <Chip label={value?.toUpperCase()} size="small" color="primary" variant="outlined" />
      ),
    },
    {
      field: 'recipient',
      headerName: 'Recipient',
      flex: 1,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" color={statusColor[value] || 'default'} />
      ),
    },
    {
      field: 'errorText',
      headerName: 'Error Summary',
      flex: 1,
      renderCell: ({ value, row }) => (
        <Typography variant="body2" color="error" noWrap>
          {value || (row.status === 'failed' ? 'Unknown error' : '')}
        </Typography>
      ),
    },
    {
      field: 'content',
      headerName: 'Details',
      width: 80,
      sortable: false,
      renderCell: ({ row }) => (
          <Tooltip title="View content & details">
            <IconButton size="small" onClick={() => setContent(row)}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Notification Logs
      </Typography>

      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" gap={1}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Channel</InputLabel>
          <Select
            value={filters.channel}
            label="Channel"
            onChange={(e) => setFilter('channel', e.target.value)}
          >
            {CHANNELS.map((c) => (
              <MenuItem key={c} value={c}>
                {c ? c.toUpperCase() : 'All'}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filters.status}
            label="Status"
            onChange={(e) => setFilter('status', e.target.value)}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s ? s.toUpperCase() : 'All'}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Search Recipient"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          sx={{ minWidth: 250 }}
        />
      </Stack>

      <Box
        sx={{
          height: 600,
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

      {/* Detail Modal */}
      <Dialog open={Boolean(content)} onClose={() => setContent(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {content?.templateName} — {content?.channel?.toUpperCase()} ({content?.status})
        </DialogTitle>
        <DialogContent dividers>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Recipient
            </Typography>
            <Typography variant="body1" mb={2}>
              {content?.recipient}
            </Typography>
            {content?.status === 'failed' && (
              <>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Error details
                  </Typography>
                  <Typography variant="body2" mb={2} color="error" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {content?.errorText || 'N/A'}
                  </Typography>
              </>
            )}
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Rendered Content / Variables
            </Typography>
            <Box
            component="pre"
            sx={{
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                overflow: 'auto',
                fontSize: 13,
                maxHeight: 400,
            }}
            >
            {JSON.stringify(content?.data || { content: "No body saved. This might be variable data." }, null, 2)}
            </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContent(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotificationLogsPage;
