import React, { useState, useEffect, useCallback, useMemo } from 'react';
import StaffAssignment from '../../components/admin/StaffAssignment';
import {
  Box,
  Typography,
  useMediaQuery,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Stack,
  Alert,
  Link,
  Tooltip,
  InputAdornment,
  TablePagination,
} from '@mui/material';
import ResponsiveDataGrid from '../../components/admin/ResponsiveDataGrid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import ReplyIcon from '@mui/icons-material/Reply';
import SearchIcon from '@mui/icons-material/Search';
import api from '../../services/api';
import PageSEO from '../../components/common/PageSEO';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { getVariantOptionLabel } from '../../utils/variantOptions';
import useAdminListQuery from '../../hooks/useAdminListQuery';
import useAdminListSearch from '../../hooks/useAdminListSearch';

const STATUS_LABELS = { pending: 'Pending', responded: 'Responded', closed: 'Closed (legacy)', closed_converted: 'Closed – Converted', closed_lost: 'Closed – Lost' };
const ADMIN_PREFIX = import.meta.env.VITE_ADMIN_ROUTE_PREFIX || 'admin';
const ENQUIRIES_URL = `/${ADMIN_PREFIX}/enquiries`;
const HISTORY_PAGE_SIZE = 5;

const getSubmitterType = (enquiry) => {
  if (enquiry.submittedByUserId || enquiry.submittedWhileSignedIn === true) return 'Signed-in customer';
  return enquiry.submittedWhileSignedIn === false ? 'Guest' : 'Unknown';
};

const getSubject = (enquiry) => enquiry.product?.name || (enquiry.cartItems?.length ? 'Cart enquiry' : 'General enquiry');

const CustomerEnquiryHistory = ({ accountId, currentId, onOpen, disableOpen }) => {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get(ENQUIRIES_URL, {
      params: { submittedByUserId: accountId, excludeId: currentId, page: page + 1, limit: HISTORY_PAGE_SIZE },
      signal: controller.signal,
    }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setResult({ rows: data.data || [], total: data.meta?.total || 0 });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setResult({ error: getApiErrorMessage(error, 'Could not load past enquiries.') });
    });
    return () => controller.abort();
  }, [accountId, currentId, page, attempt]);

  return (
    <Box component="section" aria-labelledby="customer-enquiry-history-title" sx={{ mb: 2 }}>
      <Typography id="customer-enquiry-history-title" component="h3" variant="subtitle2" gutterBottom>
        Past enquiries
      </Typography>
      {!result ? <Typography variant="body2" role="status">Loading past enquiries…</Typography> : null}
      {result?.error ? <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Retry</Button>
      }>{result.error}</Alert> : null}
      {result?.rows?.length === 0 ? <Typography variant="body2" color="text.secondary">No other enquiries for this account.</Typography> : null}
      {result?.rows?.length ? (
        <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {result.rows.map((enquiry) => (
            <Stack component="li" key={enquiry.id} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="body2">{getSubject(enquiry)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(enquiry.createdAt || enquiry.created_at).toLocaleDateString()} · {STATUS_LABELS[enquiry.status] || enquiry.status}
                </Typography>
              </Box>
              <Button size="small" disabled={disableOpen} onClick={() => onOpen(enquiry)} aria-label={`View enquiry for ${getSubject(enquiry)}`}>
                View
              </Button>
            </Stack>
          ))}
        </Stack>
      ) : null}
      {result && !result.error && (result.total > HISTORY_PAGE_SIZE || page > 0) ? (
        <TablePagination
          component="div"
          count={result.total}
          page={Math.min(page, Math.max(0, Math.ceil(result.total / HISTORY_PAGE_SIZE) - 1))}
          rowsPerPage={HISTORY_PAGE_SIZE}
          rowsPerPageOptions={[]}
          onPageChange={(_, nextPage) => { setResult(null); setPage(nextPage); }}
        />
      ) : null}
    </Box>
  );
};

const EnquiriesPage = () => {
  const compact = useMediaQuery('(max-width: 1200px)');
  const narrow = useMediaQuery('(max-width: 760px)');
  const phone = useMediaQuery('(max-width: 600px)');
  const { notify } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();
  const linkedEnquiry = new URLSearchParams(location.search).get('enquiry');
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const { params, updateQuery, paginationModel, setPaginationModel } = useAdminListQuery(20);
  const statusFilter = params.get('status') || '';
  const search = params.get('search') || '';
  const { searchInput, setSearchInput, applySearch } = useAdminListSearch(search, updateQuery, 300);
  const [replyMode, setReplyMode] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyFeedback, setReplyFeedback] = useState(null);
  const [copiedField, setCopiedField] = useState('');
  const sortBy = params.get('sortBy') || 'createdAt';
  const sortDir = params.get('sortDir') === 'asc' ? 'asc' : 'desc';
  const sortModel = useMemo(() => [{ field: sortBy, sort: sortDir }], [sortBy, sortDir]);

  useEffect(() => {
    if (!linkedEnquiry) return;
    const controller = new AbortController();
    api.get(ENQUIRIES_URL, { params: { id: linkedEnquiry }, signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (data.data?.length) {
        setSelectedEnquiry(data.data[0]);
        setReplyFeedback(null);
      } else notify('This enquiry is no longer available.', 'warning');
    }).catch(error => {
      if (!controller.signal.aborted) notify(getApiErrorMessage(error, 'Failed to open enquiry'), 'error');
    });
    return () => controller.abort();
  }, [linkedEnquiry, notify]);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const activeSort = sortModel[0] || {};
      const { data } = await api.get(ENQUIRIES_URL, {
        params: {
          page: paginationModel.page + 1,
          limit: paginationModel.pageSize,
          status: statusFilter || undefined,
          search: search || undefined,
          sortBy: activeSort.field || 'createdAt',
          sortDir: activeSort.sort || 'desc',
        },
      });
      setRows(data.data || []);
      setRowCount(data.meta?.total || 0);
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to load enquiries'), 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, paginationModel, sortModel, notify]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const handleStatusChange = async (id, newStatus) => {
    if (statusLoading) return;
    setStatusLoading(true);
    try {
      await api.patch(`/${ADMIN_PREFIX}/enquiries/${id}/status`, { status: newStatus });
      setRows((prev) =>
        prev.map((eq) => (eq.id === id ? { ...eq, status: newStatus } : eq))
      );
      if (selectedEnquiry && selectedEnquiry.id === id) {
        setSelectedEnquiry((prev) => prev?.id === id ? { ...prev, status: newStatus } : prev);
      }
      notify('Enquiry status updated successfully', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to update status'), 'error');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedEnquiry) return;
    setReplyLoading(true);
    try {
      const { data } = await api.post(`/${ADMIN_PREFIX}/enquiries/${selectedEnquiry.id}/reply`, {
        replyMessage: replyMessage.trim(),
      });
      if (!data?.data?.enquiry) throw new Error('The reply response was incomplete. Refresh the enquiry before trying again.');
      const updated = { ...selectedEnquiry, ...data.data.enquiry };
      setRows((prev) => prev.map((eq) => eq.id === updated.id ? { ...eq, ...updated } : eq));
      setSelectedEnquiry(updated);
      setReplyFeedback({ type: 'success', message: 'Reply sent.' });
      setReplyMode(false);
      setReplyMessage('');
    } catch (err) {
      setReplyFeedback({ type: 'error', message: getApiErrorMessage(err, 'Failed to send reply. Please try again.') });
    } finally {
      setReplyLoading(false);
    }
  };

  const closeDialog = () => {
    if (linkedEnquiry) navigate(location.pathname, { replace: true });
    setSelectedEnquiry(null);
    setReplyMode(false);
    setReplyMessage('');
    setReplyFeedback(null);
    setCopiedField('');
  };

  const openEnquiry = (enquiry) => {
    setSelectedEnquiry(enquiry);
    setReplyMode(false);
    setReplyMessage('');
    setReplyFeedback(null);
    setCopiedField('');
  };

  const handleDialogClose = (event, reason) => {
    if (replyLoading && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
      return;
    }
    closeDialog();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'responded': return 'info';
      case 'closed_converted': return 'success';
      case 'closed_lost': return 'error';
      case 'closed': return 'default';
      default: return 'default';
    }
  };

  const columns = [
    {
      field: 'createdAt',
      headerName: 'Date',
      minWidth: 140,
      flex: 0.8,
      renderCell: ({ row }) => {
        const raw = row.created_at || row.createdAt;
        if (!raw) return '-';
        const date = new Date(raw);
        return Number.isNaN(date.getTime())
          ? '-'
          : date.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
      },
    },
    {
      field: 'name',
      headerName: 'Customer',
      minWidth: 160,
      flex: 1.2,
      renderCell: ({ row }) => (
        <Box py={0.5}>
          <Typography variant="body2" fontWeight={500}>{row.name}</Typography>
          <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.25}>{getSubmitterType(row)}</Typography>
          <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.25} noWrap>Reply email {row.email}</Typography>
          {row.phone ? <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.25}>{row.phone}</Typography> : null}
        </Box>
      ),
    },
    {
      field: 'subject',
      headerName: 'Subject',
      minWidth: 220,
      flex: 1,
      sortable: false,
      renderCell: ({ row }) => (
        row.product ? `Product: ${row.product.name}` : (row.cartItems ? 'Cart Items' : 'General')
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 190,
      renderCell: ({ value }) => <Chip label={STATUS_LABELS[value] || value} size="small" color={getStatusColor(value)} />,
    },
    {
      field: 'actions',
      headerName: phone ? '' : 'Actions',
      width: phone ? 56 : 100,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <IconButton
          size="small"
          color="primary"
          onClick={() => openEnquiry(row)}
          aria-label={`View enquiry from ${row.email}`}
        >
          <VisibilityIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 1, sm: 3 }, minWidth: 0 }}>
      <PageSEO title="Enquiries | Admin" type="noindex" />

      <Typography variant="h5" component="h1" fontWeight={700} mb={3}>
        Enquiries
      </Typography>

      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{ minWidth: { xs: 0, sm: 240 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => updateQuery({ status: e.target.value, page: null })}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="responded">Responded</MenuItem>
                <MenuItem value="closed_converted">Closed – Converted</MenuItem>
                <MenuItem value="closed_lost">Closed – Lost</MenuItem>
                <MenuItem value="closed">Closed (legacy)</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Button
            variant="text"
            size="small"
            onClick={() => applySearch('', { status: null, sortBy: null, sortDir: null })}
            sx={{ display: (searchInput || statusFilter || sortModel[0]?.field !== 'createdAt' || sortModel[0]?.sort !== 'desc') ? 'inline-flex' : 'none' }}
          >
            Clear Filter
          </Button>
        </Stack>
      </Paper>

      <Box
        sx={{
          minHeight: 620,
          height: { xs: 620, md: 'calc(100vh - 280px)' },
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          requiredColumns={['name', 'actions']}
          columnVisibilityModel={{ createdAt: !narrow, subject: !compact, status: !phone }}
          rowHeight={76}
          rowCount={rowCount}
          loading={loading}
          paginationMode="server"
          sortingMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          sortModel={sortModel}
          onSortModelChange={([sort]) => updateQuery({ sortBy: sort?.field, sortDir: sort?.sort, page: null })}
          pageSizeOptions={[10, 20, 50]}
          disableRowSelectionOnClick
        />
      </Box>

      {selectedEnquiry && (
        <Dialog
          open={Boolean(selectedEnquiry)}
          onClose={handleDialogClose}
          maxWidth="md"
          aria-labelledby="enquiry-details-title"
          fullWidth
          disableEscapeKeyDown={replyLoading}
        >
          <DialogTitle id="enquiry-details-title" sx={{ pr: 7 }}>
            {selectedEnquiry.product?.name ? `${selectedEnquiry.product.name} enquiry` : selectedEnquiry.cartItems?.length ? 'Cart enquiry' : 'Enquiry details'}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {new Date(selectedEnquiry.createdAt || selectedEnquiry.created_at).toLocaleString()}
              </Typography>
              <Chip size="small" label={STATUS_LABELS[selectedEnquiry.status] || selectedEnquiry.status} color={getStatusColor(selectedEnquiry.status)} />
            </Stack>
            <IconButton aria-label="Close enquiry" onClick={closeDialog} disabled={replyLoading} sx={{ position: 'absolute', top: 12, right: 12 }}><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <StaffAssignment key={selectedEnquiry.id} kind="enquiries" recordId={selectedEnquiry.id} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Customer Info</Typography>
              <Typography variant="body2"><strong>Name:</strong> {selectedEnquiry.name}</Typography>
              <Typography variant="body2"><strong>Submission type</strong> {getSubmitterType(selectedEnquiry)}</Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                <strong>Account email</strong> {selectedEnquiry.submitter?.email || 'Unavailable'}
              </Typography>
              {[['Reply email', selectedEnquiry.email, 'mailto:'], ['Phone', selectedEnquiry.phone, 'tel:']].map(([label, value, prefix]) => (
                <Stack key={label} direction="row" spacing={1} alignItems="center" sx={{ minHeight: 32 }}>
                  <Typography variant="body2" fontWeight={600}>{label}</Typography>
                  {value ? <>
                    <Link href={`${prefix}${prefix === 'tel:' ? value.replace(/[^+0-9]/g, '') : value}`} variant="body2" sx={{ overflowWrap: 'anywhere' }}>{value}</Link>
                    <Tooltip title={`Copy ${label.toLowerCase()}`}><IconButton size="small" aria-label={`Copy ${label.toLowerCase()}`} onClick={async () => {
                      try { await navigator.clipboard.writeText(value); setCopiedField(label); }
                      catch { notify(`Could not copy ${label.toLowerCase()}. Please copy it manually.`, 'error'); }
                    }}><ContentCopyIcon fontSize="inherit" /></IconButton></Tooltip>
                    {copiedField === label && <Typography variant="caption" role="status">Copied</Typography>}
                  </> : <Typography variant="body2" color="text.secondary">Not provided</Typography>}
                </Stack>
              ))}
            </Box>

            {selectedEnquiry.submittedByUserId ? (
              <CustomerEnquiryHistory
                key={`history-${selectedEnquiry.id}`}
                accountId={selectedEnquiry.submittedByUserId}
                currentId={selectedEnquiry.id}
                onOpen={openEnquiry}
                disableOpen={Boolean(replyMessage.trim()) || replyLoading || statusLoading}
              />
            ) : null}

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Subject</Typography>
              {selectedEnquiry.product ? (
                <Box>
                  <Link component={RouterLink} to={`/admin/products/${selectedEnquiry.product.id}/edit`} variant="body2">{selectedEnquiry.product.name}</Link>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>Quantity: {selectedEnquiry.quantity || 1}</Typography>
                  {selectedEnquiry.variant && <Typography variant="body2" color="text.secondary">
                    {getVariantOptionLabel(selectedEnquiry.variant) || selectedEnquiry.variant.sku || 'Selected variant'}
                    {(selectedEnquiry.variantId || selectedEnquiry.variant.id) && (
                      <Typography component="span" variant="caption" sx={{ display: 'block' }}>
                        Variant ID: {selectedEnquiry.variantId || selectedEnquiry.variant.id}
                      </Typography>
                    )}
                    {selectedEnquiry.variant.sku ? ` · SKU: ${selectedEnquiry.variant.sku}` : ''}
                  </Typography>}
                </Box>
              ) : selectedEnquiry.cartItems ? (
                <Box>
                  <Typography variant="body2" gutterBottom>Cart Items ({selectedEnquiry.cartItems.length} products):</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}>
                    {selectedEnquiry.cartItems.map((item, index) => (
                      <Typography component="li" key={item.id || index} variant="body2" sx={{ py: 0.5 }}>
                        {item.product?.id || item.productId ? <Link component={RouterLink} to={`/admin/products/${item.product?.id || item.productId}/edit`}>{item.product?.name || 'View product'}</Link> : <strong>{item.product?.name || 'Unknown Product'}</strong>}
                        {item.variant ? ` (${item.variant.optionLabel || item.variant.sku || 'Variant'})` : ''}
                        {(item.variantId || item.variant?.id) && (
                          <Typography component="span" variant="caption" sx={{ display: 'block' }}>
                            Variant ID: {item.variantId || item.variant.id}
                          </Typography>
                        )}
                        <Typography component="span" display="block" variant="body2">Quantity: {item.quantity}</Typography>
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2">General</Typography>
              )}
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Message</Typography>
              <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: 'action.hover', maxHeight: 200, overflowY: 'auto' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedEnquiry.message}</Typography>
              </Paper>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Replies</Typography>
              {selectedEnquiry.replies?.length ? selectedEnquiry.replies.map((reply) => (
                <Paper key={reply.id} variant="outlined" sx={{ p: 2, mt: 1 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5} sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{reply.senderName || 'Staff'}</Typography>
                    <Typography component="time" dateTime={reply.createdAt} variant="caption" color="text.secondary">{new Date(reply.createdAt).toLocaleString()}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{reply.message}</Typography>
                </Paper>
              )) : <Typography variant="body2" color="text.secondary">No saved replies yet.</Typography>}
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Change Status</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {['pending', 'responded', 'closed_converted', 'closed_lost'].map((status) => (
                  <Button
                    key={status}
                    size="small"
                    variant={selectedEnquiry.status === status ? 'contained' : 'outlined'}
                    color={getStatusColor(status)}
                    disabled={statusLoading || replyLoading || selectedEnquiry.status === status}
                    onClick={() => handleStatusChange(selectedEnquiry.id, status)}
                  >
                    {STATUS_LABELS[status]}
                  </Button>
                ))}
              </Box>
            </Box>

            {replyMode && (
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>Draft Reply</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Reply message"
                  autoFocus
                  placeholder="Type your reply here. It will be sent via email to the customer."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  disabled={replyLoading}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
            {replyFeedback && <Alert severity={replyFeedback.type} role="status" sx={{ mr: 'auto' }}>{replyFeedback.message}</Alert>}
            <Button onClick={closeDialog} disabled={replyLoading}>Close</Button>
            {!replyMode ? (
              <Button disabled={statusLoading} onClick={() => { setReplyMode(true); setReplyFeedback(null); }} variant="contained" startIcon={<ReplyIcon />}>
                Reply via Email
              </Button>
            ) : (
              <Button
                onClick={handleReply}
                variant="contained"
                disabled={statusLoading || replyLoading || !replyMessage.trim()}
              >
                {replyLoading ? <CircularProgress size={24} color="inherit" /> : 'Send Reply'}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default EnquiriesPage;
