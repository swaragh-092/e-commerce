import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, Alert, Button, Stack,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import { getAdminReviews, updateReviewStatus, deleteReview } from '../../services/adminService';

const ReviewsPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [statusFilter, setStatusFilter] = useState('pending');
  const [alert, setAlert] = useState(null);

  const fetchReviews = useCallback(() => {
    setLoading(true);
    getAdminReviews({ status: statusFilter, page: paginationModel.page + 1, limit: paginationModel.pageSize })
      .then((res) => {
        setRows(res.data.data?.rows || res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [paginationModel, statusFilter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleStatus = async (id, status) => {
    try {
      await updateReviewStatus(id, status);
      setAlert({ type: 'success', msg: `Review ${status}.` });
      fetchReviews();
    } catch {
      setAlert({ type: 'error', msg: 'Failed to update review.' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this review?')) return;
    deleteReview(id).then(fetchReviews).catch(() => setAlert({ type: 'error', msg: 'Failed to delete.' }));
  };

  const columns = [
    {
      field: 'Product', headerName: 'Product', flex: 1,
      renderCell: ({ row }) => row.Product?.name || row.productId,
    },
    {
      field: 'User', headerName: 'Reviewer', width: 160,
      renderCell: ({ row }) => row.User ? `${row.User.firstName} ${row.User.lastName}` : '—',
    },
    { field: 'rating', headerName: '★', width: 60 },
    { field: 'title', headerName: 'Title', flex: 1 },
    {
      field: 'isVerifiedPurchase', headerName: 'Verified', width: 90,
      renderCell: ({ value }) => value ? <Chip label="Yes" size="small" color="success" /> : null,
    },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" color={value === 'approved' ? 'success' : value === 'rejected' ? 'error' : 'warning'} />
      ),
    },
    {
      field: 'createdAt', headerName: 'Date', width: 120,
      renderCell: ({ value }) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'actions', headerName: '', width: 120, sortable: false,
      renderCell: ({ row }) => (
        <>
          <Tooltip title="Approve">
            <IconButton size="small" color="success" onClick={() => handleStatus(row.id, 'approved')} disabled={row.status === 'approved'}>
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reject">
            <IconButton size="small" color="warning" onClick={() => handleStatus(row.id, 'rejected')} disabled={row.status === 'rejected'}>
              <CancelIcon fontSize="small" />
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
      <Typography variant="h5" fontWeight={700} mb={3}>Reviews</Typography>

      <Stack direction="row" spacing={2} mb={2}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {alert && <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>{alert.msg}</Alert>}

      <Box sx={{ height: 580, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <DataGrid rows={rows} columns={columns} rowCount={total} loading={loading}
          paginationMode="server" paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel} disableRowSelectionOnClick />
      </Box>
    </Box>
  );
};

export default ReviewsPage;
