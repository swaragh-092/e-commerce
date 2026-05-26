import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import DownloadIcon from '@mui/icons-material/Download';

import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { useCurrency } from '../../hooks/useSettings';
import { confirmCodPayment, getAllOrders, updateOrderStatus } from '../../services/adminService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatDateTime } from '../../utils/dates';
import {
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_SUMMARY_GROUPS,
  countOrdersByStatuses,
  getAllowedOrderStatuses,
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

const ClickableSummaryCard = ({ label, value, tone = 'default', onClick, active }) => (
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
      minWidth: 170,
      flex: '1 1 0',
      borderRadius: 3,
      border: '1px solid',
      borderColor: active ? 'primary.main' : 'divider',
      bgcolor: active ? 'action.hover' : 'background.paper',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s',
      '&:hover': onClick ? {
        borderColor: 'primary.main',
        bgcolor: 'action.hover',
      } : {},
    }}
  >
    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="h6" fontWeight={700} color={tone === 'error' ? 'error.main' : tone === 'warning' ? 'warning.main' : 'text.primary'}>
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
  const [counts, setCounts] = useState({});
  const [pageRevenue, setPageRevenue] = useState(0);
  const [codCollectionOrder, setCodCollectionOrder] = useState(null);
  const [codCollectionAmount, setCodCollectionAmount] = useState('');
  const hasActiveFilters = Boolean(search || status);

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
        const responseData = res.data.data;
        setOrders(responseData.rows || []);
        setTotal(res.data.meta?.total || 0);
        if (responseData.counts) {
          setCounts(responseData.counts);
        }
        // Calculate revenue from visible rows for now, or update backend to return total revenue if needed
        const rev = (responseData.rows || []).reduce((sum, order) => sum + Number(order.total || 0), 0);
        setPageRevenue(rev);
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

  const summaryGroups = useMemo(() => {
    return ORDER_STATUS_SUMMARY_GROUPS.map((group) => {
      // Sum counts for all statuses in the group from the backend counts
      const count = (group.statuses || []).reduce((sum, s) => sum + (counts[s] || 0), 0);
      return { ...group, count };
    });
  }, [counts]);

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

  const openCodCollectionDialog = (order) => {
    const collectedAmount = Number(order.Payment?.metadata?.codCollectedAmount || 0);
    const pendingAmount = Math.max(Number(order.total || 0) - collectedAmount, 0);
    setCodCollectionOrder(order);
    setCodCollectionAmount(pendingAmount > 0 ? pendingAmount.toFixed(2) : '');
  };

  const closeCodCollectionDialog = () => {
    setCodCollectionOrder(null);
    setCodCollectionAmount('');
  };

  const handleConfirmCodPayment = async () => {
    if (!codCollectionOrder) return;

    const collectedAmount = Number(codCollectionOrder.Payment?.metadata?.codCollectedAmount || 0);
    const pendingAmount = Math.max(Number(codCollectionOrder.total || 0) - collectedAmount, 0);
    const amount = Number(codCollectionAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > pendingAmount) {
      notify(`Enter an amount between 0 and ${formatPrice(pendingAmount)}.`, 'error');
      return;
    }

    const confirmed = await confirm(
      'Mark COD Collected',
      `Confirm COD collection of ${formatPrice(amount)} for ${codCollectionOrder.orderNumber}?`,
      'primary'
    );
    if (!confirmed) return;

    setActionLoadingId(`${codCollectionOrder.id}:cod`);
    try {
      await confirmCodPayment(codCollectionOrder.id, { amount });
      closeCodCollectionDialog();
      notify('COD payment collection recorded.', 'success');
      fetchOrders();
    } catch (codError) {
      notify(getApiErrorMessage(codError, 'Failed to confirm COD payment.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Order #', 'Customer', 'Email', 'Total', 'Payment', 'Status', 'Date'];
    const csvRows = [headers.join(',')];
    orders.forEach((o) => {
      const name = o.User ? `${o.User.firstName || ''} ${o.User.lastName || ''}`.trim() : (o.customer_name || '');
      csvRows.push([
        `"${o.orderNumber || ''}"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${o.User?.email || ''}"`,
        o.total || 0,
        `"${o.Payment?.status || o.paymentMethod || ''}"`,
        `"${o.status || ''}"`,
        `"${o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''}"`,
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
              {/* <Typography variant="caption" color="text.secondary" noWrap>
                {customerEmail}
              </Typography> */}
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
              <Typography variant="caption" color="text.secondary" noWrap>
                {provider}
              </Typography>
              <Chip
                label={getOrderStatusLabel(paymentStatus)}
                size="small"
                variant="outlined"
                color={paymentStatus === 'completed' ? 'success' : paymentStatus === 'failed' ? 'error' : 'default'}
              />
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
        renderCell: ({ value }) => formatDateTime(value),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 200,
        sortable: false,
        renderCell: ({ row }) => {
          const paymentStatus = row.Payment?.status;
          const shippingStatus = row.orderShippingStatus || row.shipmentStatus || 'not_shipped';
          const codCollectedAmount = Number(
            row.Payment?.metadata?.codCollectedAmount
            || (row.paymentMethod === 'cod' && paymentStatus !== 'paid_cod' && Number(row.Payment?.amount || 0) < Number(row.total || 0)
              ? row.Payment?.amount
              : 0)
          );
          const codDueAmount = Math.max(Number(row.total || 0) - codCollectedAmount, 0);
          const canCollectCod = canUpdateStatus
            && row.paymentMethod === 'cod'
            && ['partially_delivered', 'delivered'].includes(shippingStatus)
            && ['pending_cod', 'pending', 'partially_refunded', 'refunded'].includes(paymentStatus || 'pending_cod')
            && codDueAmount > 0;

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
                  onClick={() => openCodCollectionDialog(row)}
                  sx={{ minWidth: 112, whiteSpace: 'nowrap' }}
                >
                  Collect COD
                </Button>
              )}
            </Stack>
          );
        },
      },
    ],
    [actionLoadingId, canUpdateStatus, navigate]
  );

  const EmptyOrdersOverlay = () => (
    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: '100%', minHeight: 240, px: 3, textAlign: 'center' }}>
      <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'action.hover', color: 'text.disabled', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ReceiptLongOutlinedIcon />
      </Box>
      <Box>
        <Typography variant="h6" fontWeight={700}>
          {hasActiveFilters ? 'No orders match these filters' : 'No orders yet'}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 360 }}>
          {hasActiveFilters
            ? 'Try clearing filters or changing your search to find more orders.'
            : 'Orders will appear here after customers complete checkout.'}
        </Typography>
      </Box>
      {hasActiveFilters ? (
        <Button
          variant="outlined"
          onClick={() => {
            setSearchInput('');
            setSearch('');
            setStatus('');
            setPaginationModel((current) => ({ ...current, page: 0 }));
          }}
        >
          Clear filters
        </Button>
      ) : (
        <Button variant="outlined" onClick={() => navigate('/products')}>
          View storefront
        </Button>
      )}
    </Stack>
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Orders
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
        <ClickableSummaryCard 
          label="Total Orders" 
          value={total} 
          active={status === ''}
          onClick={() => setStatus('')}
        />
        {summaryGroups.map((group) => (
          <ClickableSummaryCard 
            key={group.key} 
            label={group.label} 
            value={group.count} 
            tone={group.tone} 
            active={status && group.statuses && group.statuses.slice().sort().join(',') === status.split(',').sort().join(',')}
            onClick={() => setStatus(group.statuses?.join(',') || '')}
          />
        ))}
        <SummaryCard label="Page Revenue" value={formatPrice(pageRevenue)} />
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
          <Stack direction="row" spacing={1}>
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
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCSV} disabled={orders.length === 0}>
              Export CSV
            </Button>
          </Stack>
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
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflowX: 'auto',
          '& .MuiDataGrid-root': { minWidth: 700 },
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
          autoHeight
          slots={{ noRowsOverlay: EmptyOrdersOverlay }}
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
            '& .MuiDataGrid-overlayWrapper': {
              minHeight: 260,
            },
          }}
        />
      </Box>

      <Dialog
        open={Boolean(codCollectionOrder)}
        onClose={() => !actionLoadingId && closeCodCollectionDialog()}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Collect COD Payment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {codCollectionOrder?.orderNumber || 'Order'}
              </Typography>
              <Typography variant="subtitle1" fontWeight={800}>
                Pending balance:{' '}
                {formatPrice(
                  Math.max(
                    Number(codCollectionOrder?.total || 0)
                      - Number(codCollectionOrder?.Payment?.metadata?.codCollectedAmount || 0),
                    0
                  )
                )}
              </Typography>
            </Box>
            <TextField
              autoFocus
              label="Amount collected"
              type="number"
              value={codCollectionAmount}
              onChange={(event) => setCodCollectionAmount(event.target.value)}
              inputProps={{
                min: 0,
                max: Math.max(
                  Number(codCollectionOrder?.total || 0)
                    - Number(codCollectionOrder?.Payment?.metadata?.codCollectedAmount || 0),
                  0
                ),
                step: '0.01',
              }}
              helperText="Enter the amount received from the customer."
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCodCollectionDialog} disabled={Boolean(actionLoadingId)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleConfirmCodPayment} disabled={Boolean(actionLoadingId)}>
            {actionLoadingId ? 'Saving…' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrdersManagePage;
