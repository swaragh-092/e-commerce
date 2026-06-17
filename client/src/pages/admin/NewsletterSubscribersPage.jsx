import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, Container, IconButton, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, CircularProgress, TablePagination,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

const normalizeSubscriber = (sub = {}) => ({
  ...sub,
  subscribedAt: sub.subscribedAt || sub.subscribed_at || null,
  createdAt: sub.createdAt || sub.created_at || null,
});

const NewsletterSubscribersPage = () => {
  const [subscribers, setSubscribers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const { notify } = useNotification();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/newsletter', { params: { limit: rowsPerPage, offset: page * rowsPerPage } });
      const list = res.data?.data?.subscribers || [];
      setSubscribers(list.map(normalizeSubscriber));
      setTotal(res.data?.data?.total || 0);
    } catch {
      notify('Failed to load subscribers', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, notify]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => {
    const header = 'Email,Status,Source,Subscribed At\n';
    const rows = subscribers.map((s) =>
      `${s.email},${s.status},${s.source || ''},${s.subscribedAt || ''}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeCount = subscribers.filter((s) => s.status === 'active').length;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Newsletter Subscribers</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} total • {activeCount} active on this page
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={fetchData} disabled={loading}><RefreshIcon /></IconButton>
          <Button startIcon={<FileDownloadIcon />} variant="outlined" onClick={handleExport} disabled={!subscribers.length}>
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
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
                      color={sub.status === 'active' ? 'success' : 'default'}
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
      </TableContainer>
    </Container>
  );
};

export default NewsletterSubscribersPage;
