import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Chip, Container, FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Paper, Select, Stack, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, CircularProgress, TablePagination,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import NewsletterCampaigns from '../../components/admin/NewsletterCampaigns';

const normalizeSubscriber = (sub = {}) => ({
  ...sub,
  subscribedAt: sub.subscribedAt || sub.subscribed_at || null,
  createdAt: sub.createdAt || sub.created_at || null,
});

// Quote every cell and neutralize spreadsheet formula injection (=, +, -, @).
const csvCell = (value) => {
  const raw = value == null ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

const CSV_EXPORT_MAX_ROWS = 5000;
const CSV_PAGE_SIZE = 500;

const NewsletterSubscribersPage = () => {
  const { hasPermission } = useAuth();
  const canReadSubscribers = hasPermission(PERMISSIONS.NEWSLETTER_SUBSCRIBERS_READ);
  const canReadCampaigns = hasPermission(PERMISSIONS.NEWSLETTER_READ);
  const subscriberAccess = useRef(canReadSubscribers);
  subscriberAccess.current = canReadSubscribers;
  const [subscribers, setSubscribers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [exporting, setExporting] = useState(false);
  const { notify } = useNotification();

  const fetchData = useCallback(async () => {
    if (!canReadSubscribers) { setSubscribers([]); setTotal(0); setLoading(false); return; }
    setLoading(true);
    try {
      const params = { limit: rowsPerPage, offset: page * rowsPerPage };
      if (search) params.search = search;
      if (status !== 'all') params.status = status;
      const res = await api.get('/newsletter', { params });
      if (!subscriberAccess.current) return;
      const list = res.data?.data?.subscribers || [];
      setSubscribers(list.map(normalizeSubscriber));
      setTotal(res.data?.data?.total || 0);
    } catch {
      notify('Failed to load subscribers', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, notify, canReadSubscribers, search, status]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleExport = async () => {
    if (!subscriberAccess.current || exporting) return;
    setExporting(true);
    try {
      // Fetch every page (server clamps limit at 500) up to a safety cap so
      // the export is not silently limited to the visible table page.
      let offset = 0;
      let total = Number.POSITIVE_INFINITY;
      let all = [];
      while (offset < total && all.length < CSV_EXPORT_MAX_ROWS) {
        const params = { limit: CSV_PAGE_SIZE, offset };
        if (search) params.search = search;
        if (status !== 'all') params.status = status;
        const res = await api.get('/newsletter', { params });
        const batch = res.data?.data?.subscribers || [];
        total = res.data?.data?.total || 0;
        all = all.concat(batch.map(normalizeSubscriber));
        if (!batch.length) break;
        offset += batch.length;
      }
      if (all.length >= CSV_EXPORT_MAX_ROWS) {
        notify(`Export capped at ${CSV_EXPORT_MAX_ROWS} rows. Narrow the list or request a server-side export for larger sets.`, 'warning');
      }
      const header = 'Email,Status,Source,Subscribed At\n';
      const rows = all.map((s) =>
        [s.email, s.status, s.source || '', s.subscribedAt || ''].map(csvCell).join(',')
      ).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      notify('Failed to export subscribers', 'error');
    } finally {
      setExporting(false);
    }
  };

  const activeCount = subscribers.filter((s) => s.status === 'active').length;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight={800}>Newsletter Subscribers</Typography>
          <Typography variant="body2" color="text.secondary">
            {canReadSubscribers ? `${total} total • ${activeCount} active on this page` : 'Newsletter campaigns'}
          </Typography>
        </Box>
        {canReadSubscribers && <Stack direction="row" spacing={1}>
          <IconButton onClick={fetchData} disabled={loading}><RefreshIcon /></IconButton>
          <Button startIcon={<FileDownloadIcon />} variant="outlined" onClick={handleExport} disabled={exporting || !subscribers.length}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </Stack>}
      </Stack>

      {canReadCampaigns && <NewsletterCampaigns />}

      {canReadSubscribers && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="Search subscribers"
          placeholder="Email or source"
          value={searchInput}
          onChange={(event) => { setSearchInput(event.target.value); setPage(0); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 190 } }}>
          <InputLabel id="subscriber-status-filter-label">Status</InputLabel>
          <Select
            labelId="subscriber-status-filter-label"
            label="Status"
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(0); }}
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="unsubscribed">Unsubscribed</MenuItem>
          </Select>
        </FormControl>
      </Stack>}

      {canReadSubscribers && <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Source</strong></TableCell>
              <TableCell><strong>Subscribed</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
            ) : subscribers.length === 0 ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>No subscribers yet.</TableCell></TableRow>
            ) : (
              subscribers.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>{sub.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={sub.status}
                      size="small"
                      color={sub.status === 'active' ? 'success' : sub.status === 'pending' ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{sub.source || '—'}</TableCell>
                  <TableCell>{sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </TableContainer>}
    </Container>
  );
};

export default NewsletterSubscribersPage;
