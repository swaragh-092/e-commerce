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
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';

import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { useCurrency } from '../../hooks/useSettings';
import { confirmCodPayment, getAllOrders, refundOrder, updateOrderStatus } from '../../services/adminService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_SUMMARY_GROUPS,
  countOrdersByStatuses,
  getAllowedOrderStatuses,
  getOrderStatusColor,
  getOrderStatusLabel,
  isOrderRefundableStatus,
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
  const [searchParams] = useSearchParams();
  const { formatPrice } = useCurrency();
  const { notify, confirm } = useNotification();
  const { hasPermission } = useAuth();
  const canUpdateStatus = hasPermission(PERMISSIONS.ORDERS_UPDATE_STATUS);
  const canRefundOrders = hasPermission(PERMISSIONS.ORDERS_REFUND);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  // Initialise status from URL query param so dashboard card links pre-apply the filter
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
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
        const message = getApiErrorMessage(fetchError, 'Failed to load orders.');
        setError(message);
        notify(message, 'error');
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

  const handleQuickStatusUpdate = async (order, nextStatus) => {
    if (!order || nextStatus === order.status) return;

    const confirmed = await confirm(
      'Update Order Status',
      `Change ${order.orderNumber} from ${getOrderStatusLabel(order.status)} to ${getOrderStatusLabel(nextStatus)}?`,
      'primary'
    );
    if (!confirmed) return;

    setActionLoadingId(`${order.id}:status`);
    try {
      await updateOrderStatus(order.id, nextStatus);
      notify('Order status updated.', 'success');
      fetchOrders();
    } catch (updateError) {
      notify(getApiErrorMessage(updateError, 'Failed to update order status.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmCodPayment = async (order) => {
    const confirmed = await confirm(
      'Mark COD Collected',
      `Confirm cash collection for ${order.orderNumber}?`,
      'primary'
    );
    if (!confirmed) return;

    setActionLoadingId(`${order.id}:cod`);
    try {
      await confirmCodPayment(order.id);
      notify('COD payment marked as collected.', 'success');
      fetchOrders();
    } catch (codError) {
      notify(getApiErrorMessage(codError, 'Failed to confirm COD payment.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRefund = async (order) => {
    const confirmed = await confirm(
      'Issue Refund',
      `Issue a full refund for ${order.orderNumber}? This will mark the order and payment as refunded.`,
      'danger'
    );
    if (!confirmed) return;

    setActionLoadingId(`${order.id}:refund`);
    try {
      await refundOrder(order.id);
      notify('Refund recorded successfully.', 'success');
      fetchOrders();
    } catch (refundError) {
      notify(getApiErrorMessage(refundError, 'Failed to refund order.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

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
        width: 160,
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
        width: 170,
        renderCell: ({ row }) => {
          const statusOptions = getAllowedOrderStatuses(row.status).filter((statusOption) => statusOption !== 'refunded');
          const canChange = canUpdateStatus && statusOptions.length > 1;

          return canChange ? (
            <Select
              size="small"
              value={row.status}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => handleQuickStatusUpdate(row, event.target.value)}
              disabled={actionLoadingId === `${row.id}:status`}
              sx={{
                minWidth: 150,
                height: 32,
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: 2,
                '& .MuiSelect-select': { py: 0.5 },
              }}
            >
              {statusOptions.map((statusOption) => (
                <MenuItem key={statusOption} value={statusOption}>
                  {getOrderStatusLabel(statusOption)}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Chip label={getOrderStatusLabel(row.status)} size="small" color={getOrderStatusColor(row.status)} />
          );
        },
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
        width: 200,
        sortable: false,
        renderCell: ({ row }) => {
          const paymentStatus = row.Payment?.status;
          const hasSettledPayment = ['completed', 'cod_collected'].includes(paymentStatus);
          const canCollectCod = canUpdateStatus
            && row.paymentMethod === 'cod'
            && ['pending_cod', 'processing'].includes(row.status)
            && (paymentStatus || 'pending') === 'pending';
          const canRefund = canRefundOrders && isOrderRefundableStatus(row.status) && hasSettledPayment;

          return (
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              onClick={(event) => event.stopPropagation()}
              sx={{ width: '100%' }}
            >
              <Tooltip title="Open order">
                <IconButton size="small" onClick={() => navigate(`/admin/orders/${row.id}`)}>
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {canCollectCod && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PaymentsOutlinedIcon />}
                  disabled={actionLoadingId === `${row.id}:cod`}
                  onClick={() => handleConfirmCodPayment(row)}
                  sx={{ minWidth: 112, whiteSpace: 'nowrap' }}
                >
                  Collect COD
                </Button>
              )}
              {canRefund && (
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<UndoOutlinedIcon />}
                  disabled={actionLoadingId === `${row.id}:refund`}
                  onClick={() => handleRefund(row)}
                  sx={{ minWidth: 88, whiteSpace: 'nowrap' }}
                >
                  Refund
                </Button>
              )}
            </Stack>
          );
        },
      },
    ],
    [actionLoadingId, canRefundOrders, canUpdateStatus, formatPrice, navigate]
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
          rowHeight={72}
          columnHeaderHeight={48}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 20, 50]}
          disableRowSelectionOnClick
          // getRowHeight={() => 'auto'}
          onRowClick={(params) => navigate(`/admin/orders/${params.id}`)}
          sx={{
            border: 0,
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: 'background.paper',
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 700,
            },
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
              py: 1,
              outline: 'none !important',
            },
            '& .MuiDataGrid-row': {
              cursor: 'pointer',
            },
            '& .MuiDataGrid-row:hover': {
              bgcolor: 'action.hover',
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default OrdersManagePage;
