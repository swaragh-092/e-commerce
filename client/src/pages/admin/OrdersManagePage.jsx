import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';
import { getAllOrders } from '../../services/adminService';

const STATUS_OPTIONS = [
  '',
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

const statusColor = {
  pending_payment: 'warning',
  paid: 'info',
  processing: 'info',
  shipped: 'primary',
  delivered: 'success',
  cancelled: 'error',
  refunded: 'default',
};

const OrdersManagePage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const fetchOrders = () => {
    setLoading(true);
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
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [paginationModel, status, search]);

  const columns = [
    { field: 'orderNumber', headerName: 'Order #', width: 160 },
    {
      field: 'customer',
      headerName: 'Customer',
      flex: 1,
      renderCell: ({ row }) => (row.User ? `${row.User.firstName} ${row.User.lastName}` : '—'),
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 110,
      renderCell: ({ value }) => `$${parseFloat(value || 0).toFixed(2)}`,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" color={statusColor[value] || 'default'} />
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Date',
      width: 150,
      renderCell: ({ value }) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      renderCell: ({ row }) => (
        <Tooltip title="View Detail">
          <IconButton size="small" onClick={() => navigate(`/admin/orders/${row.id}`)}>
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Orders
      </Typography>

      <Stack direction="row" spacing={2} mb={2}>
        <TextField
          size="small"
          placeholder="Search order # or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {s || 'All'}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

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
        />
      </Box>
    </Box>
  );
};

export default OrdersManagePage;
