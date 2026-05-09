import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import { getAdminReviews, updateReviewStatus, deleteReview } from '../../services/adminService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

const SummaryCard = ({ label, value, tone = 'default', onClick, active }) => (
  <Paper
    elevation={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick(e);
      }
    }}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    aria-pressed={onClick ? active : undefined}
    sx={{
      p: 2,
      minWidth: 150,
      flex: '1 1 0',
      borderRadius: 3,
      border: active ? '2px solid' : '1px solid',
      borderColor: active ? 'primary.main' : 'divider',
      bgcolor: active ? 'primary.light' : 'background.paper',
      color: active ? 'primary.contrastText' : 'inherit',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s',
      '&:hover': onClick ? {
        borderColor: 'primary.main',
        bgcolor: active ? 'primary.light' : 'action.hover',
      } : {},
    }}
  >
    <Typography variant="body2" color={active ? 'inherit' : 'text.secondary'} sx={{ mb: 0.5, opacity: active ? 0.9 : 1 }}>
      {label}
    </Typography>
    <Typography variant="h6" fontWeight={700} color={active ? 'inherit' : tone === 'error' ? 'error.main' : tone === 'success' ? 'success.main' : tone === 'warning' ? 'warning.main' : 'text.primary'}>
      {value}
    </Typography>
  </Paper>
);

const useDebounceValue = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const ReviewsPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [viewReview, setViewReview] = useState(null);
  const { notify, confirm } = useNotification();
  const { hasPermission } = useAuth();
  const canModerateReviews = hasPermission(PERMISSIONS.REVIEWS_MODERATE);
  const canDeleteReviews = hasPermission(PERMISSIONS.REVIEWS_DELETE);

  const debouncedSearchQuery = useDebounceValue(searchQuery, 300);

  const fetchReviews = useCallback(() => {
    setLoading(true);
    getAdminReviews({
      status: statusFilter,
      search: debouncedSearchQuery,
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
    })
      .then((res) => {
        const data = res.data.data;
        setRows(data.rows || []);
        setTotal(res.data.meta?.total || 0);
        if (data.counts) {
          setCounts(data.counts);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [paginationModel, statusFilter, debouncedSearchQuery]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleStatus = async (id, status) => {
    if (!canModerateReviews) {
      notify('You do not have permission to moderate reviews.', 'error');
      return;
    }

    if (!(await confirm(`Confirm ${status}`, `Are you sure you want to mark this review as ${status}?`, 'info'))) return;

    try {
      await updateReviewStatus(id, status);
      notify(`Review status updated to ${status} successfully.`, 'success');
      fetchReviews();
    } catch {
      notify('Failed to update review.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!canDeleteReviews) {
      notify('You do not have permission to delete reviews.', 'error');
      return;
    }

    if (!(await confirm('Delete Review', 'Delete this review?', 'danger'))) return;
    try {
      await deleteReview(id);
      fetchReviews();
    } catch {
      notify('Failed to delete.', 'error');
    }
  };

  const columns = [
    {
      field: 'Product',
      headerName: 'Product',
      flex: 1,
      renderCell: ({ row }) => row.Product?.name || <Typography variant="body2" color="text.secondary">Deleted Product</Typography>,
    },
    {
      field: 'User',
      headerName: 'Reviewer',
      width: 160,
      renderCell: ({ row }) => (row.User ? `${row.User.firstName} ${row.User.lastName}` : '—'),
    },
    { field: 'rating', headerName: '★', width: 60 },
    { field: 'title', headerName: 'Title', flex: 1 },
    {
      field: 'isVerifiedPurchase',
      headerName: 'Verified',
      width: 90,
      renderCell: ({ value }) => (value ? <Chip label="Yes" size="small" color="success" /> : <Typography variant="caption" color="text.secondary">—</Typography>),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: ({ value }) => (
        <Chip
          label={value}
          size="small"
          color={value === 'approved' ? 'success' : value === 'rejected' ? 'error' : 'warning'}
        />
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Date',
      width: 170,
      renderCell: ({ value }) => new Date(value).toLocaleString(),
    },
    {
      field: 'actions',
      headerName: '',
      width: 160,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5} alignItems="center" height="100%">
          <Tooltip title="View Details">
            <IconButton size="small" color="primary" onClick={() => setViewReview(row)}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canModerateReviews && (
            <>
              <Tooltip title="Approve">
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleStatus(row.id, 'approved')}
                  disabled={row.status === 'approved'}
                >
                  <CheckCircleIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reject">
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => handleStatus(row.id, 'rejected')}
                  disabled={row.status === 'rejected'}
                >
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {canDeleteReviews && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1 }} />
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Reviews
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
        <SummaryCard 
          label="Total Reviews" 
          value={counts.total} 
          active={statusFilter === ''}
          onClick={() => setStatusFilter('')}
        />
        <SummaryCard 
          label="Pending Approval" 
          value={counts.pending} 
          tone="warning"
          active={statusFilter === 'pending'}
          onClick={() => setStatusFilter('pending')}
        />
        <SummaryCard 
          label="Approved" 
          value={counts.approved} 
          tone="success"
          active={statusFilter === 'approved'}
          onClick={() => setStatusFilter('approved')}
        />
        <SummaryCard 
          label="Rejected" 
          value={counts.rejected} 
          tone="error"
          active={statusFilter === 'rejected'}
          onClick={() => setStatusFilter('rejected')}
        />
      </Stack>

      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                label="Status Filter"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="pending">Pending Only</MenuItem>
                <MenuItem value="approved">Approved Only</MenuItem>
                <MenuItem value="rejected">Rejected Only</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              placeholder="Search product or reviewer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
          </Box>
          <Button 
            variant="text" 
            size="small" 
            onClick={() => {
              setStatusFilter('');
              setSearchQuery('');
            }}
            sx={{ display: (statusFilter || searchQuery) ? 'inline-flex' : 'none' }}
          >
            Clear Filter
          </Button>
        </Stack>
      </Paper>

      <Box
        sx={{
          minHeight: 580,
          height: { xs: 580, md: 'calc(100vh - 300px)' },
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

      {/* Review Details Dialog */}
      <Dialog open={!!viewReview} onClose={() => setViewReview(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Review Details</DialogTitle>
        <DialogContent dividers>
          {viewReview && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Product</Typography>
              <Typography variant="body1" gutterBottom>{viewReview.Product?.name || 'Deleted Product'}</Typography>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>Reviewer</Typography>
              <Typography variant="body1" gutterBottom>{viewReview.User ? `${viewReview.User.firstName} ${viewReview.User.lastName}` : 'Unknown'}</Typography>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>Rating</Typography>
              <Typography variant="body1" gutterBottom>{viewReview.rating} / 5</Typography>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>Title</Typography>
              <Typography variant="body1" gutterBottom fontWeight="bold">{viewReview.title}</Typography>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>Body</Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewReview.body}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewReview(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReviewsPage;
