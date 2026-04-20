import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../../hooks/useSettings';
import { getAllOrders } from '../../services/adminService';
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_SUMMARY_GROUPS,
  countOrdersByStatuses,
  getOrderStatusColor,
  getOrderStatusLabel,
} from '../../utils/orderWorkflow';

const SummaryCard = ({ label, value, tone = 'default' }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      minWidth: 170,
      flex: '1 1 0',
      borderRadius: 3,
      border: '1px solid',
      borderColor: tone === 'warning' ? 'warning.light' : tone === 'error' ? 'error.light' : 'divider',
      bgcolor: 'background.paper',
    }}
  >
    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="h6" fontWeight={700}>
      {value}
    </Typography>
  </Paper>
);

const OrdersManagePage = () => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchOrders = () => {
    setLoading(true);
    setError('');
    getAllOrders({
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      ...(status && { status }),
      ...(search && { search }),
    })
      .then((res) => {
        const data = res.data;
        setOrders(data.data?.rows || data.data || []);
        setTotal(data.meta?.total || 0);
      })
      .catch((fetchError) => {
        console.error(fetchError);
        setError(getApiErrorMessage(fetchError, 'Failed to load orders.'));
        setOrders([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [paginationModel, status, search]);

  const summary = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const groups = ORDER_STATUS_SUMMARY_GROUPS.map((group) => ({
      ...group,
      count: countOrdersByStatuses(orders, group.statuses || []),
    }));

    return { revenue, groups };
  }, [orders]);

  const columns = useMemo(
    () => [
      { field: 'orderNumber', headerName: 'Order #', minWidth: 170, flex: 0.8 },
      {
        field: 'customer',
        headerName: 'Customer',
        flex: 1.2,
        minWidth: 220,
        sortable: false,
        renderCell: ({ row }) => {
          const customerName = [row.User?.firstName, row.User?.lastName].filter(Boolean).join(' ')
            || row.shippingAddressSnapshot?.fullName
            || 'Guest / unavailable';
          const customerEmail = row.User?.email || 'No email available';

          return (
            <Box sx={{ py: 1 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {customerName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {customerEmail}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 130,
        renderCell: ({ value }) => formatPrice(value || 0),
      },
      {
        field: 'payment',
        headerName: 'Payment',
        width: 180,
        sortable: false,
        renderCell: ({ row }) => {
          const paymentStatus = row.Payment?.status || 'pending';
          const provider = row.Payment?.provider || 'Not captured';

          return (
            <Stack spacing={0.5} sx={{ py: 1 }}>
              <Chip
                label={getOrderStatusLabel(paymentStatus)}
                size="small"
                variant="outlined"
                color={paymentStatus === 'completed' ? 'success' : paymentStatus === 'failed' ? 'error' : 'default'}
              />
              <Typography variant="caption" color="text.secondary" noWrap>
                {provider}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 150,
        renderCell: ({ value }) => (
          <Chip label={getOrderStatusLabel(value)} size="small" color={getOrderStatusColor(value)} />
        ),
      },
      {
        field: 'createdAt',
        headerName: 'Placed',
        width: 180,
        renderCell: ({ value }) => new Date(value).toLocaleString(),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 90,
        sortable: false,
        renderCell: ({ row }) => (
          <IconButton size="small" onClick={() => navigate(`/admin/orders/${row.id}`)}>
            <VisibilityIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [formatPrice, navigate]
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Orders
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
        <SummaryCard label="Orders in current view" value={total} />
        {summary.groups.map((group) => (
          <SummaryCard key={group.key} label={group.label} value={group.count} tone={group.tone} />
        ))}
        <SummaryCard label="Visible revenue" value={formatPrice(summary.revenue)} />
      </Stack>

      <Paper
        elevation={0}
        sx={{ p: 2, mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              placeholder="Search order #, name, or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{ minWidth: 240 }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {ORDER_STATUS_OPTIONS.map((statusOption) => (
                  <MenuItem key={statusOption} value={statusOption}>
                    {getOrderStatusLabel(statusOption)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Button
            variant="text"
            onClick={() => {
              setSearchInput('');
              setStatus('');
              setPaginationModel((current) => ({ ...current, page: 0 }));
            }}
            disabled={!searchInput && !status}
          >
            Clear filters
          </Button>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Search by order number, customer name, or email. Use status filtering to quickly find orders that need action.
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          height: 580,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <DataGrid
          rows={orders}
          columns={columns}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 20, 50]}
          disableRowSelectionOnClick
          // getRowHeight={() => 'auto'}
          onRowClick={(params) => navigate(`/admin/orders/${params.id}`)}
          sx={{
            '& .MuiDataGrid-row': {
              cursor: 'pointer',
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default OrdersManagePage;
