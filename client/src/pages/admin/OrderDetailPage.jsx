import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrency } from '../../hooks/useSettings';
import { getOrderById, updateOrderStatus, refundOrder } from '../../services/adminService';
import { useNotification } from '../../context/NotificationContext';
import AppliedDiscountsSummary from '../../components/orders/AppliedDiscountsSummary';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import {
  ORDER_STATUS_STEPPER,
  getAllowedOrderStatuses,
  getOrderStatusColor,
  getOrderStatusLabel,
  isOrderRefundableStatus,
} from '../../utils/orderWorkflow';

const DetailCard = ({ title, children }) => (
  <Paper
    elevation={0}
    sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
  >
    <Typography variant="h6" fontWeight={700} mb={2}>
      {title}
    </Typography>
    {children}
  </Paper>
);

const MetricCard = ({ label, value, accent = 'text.primary' }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      borderRadius: 3,
      border: '1px solid',
      borderColor: 'divider',
      minWidth: 160,
      flex: '1 1 0',
    }}
  >
    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="h6" fontWeight={700} color={accent}>
      {value}
    </Typography>
  </Paper>
);

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { hasPermission } = useAuth();
  const notify = useNotification();
  const canUpdateOrderStatus = hasPermission(PERMISSIONS.ORDERS_UPDATE_STATUS);
  const canRefundOrders = hasPermission(PERMISSIONS.ORDERS_REFUND);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');

    getOrderById(id)
      .then((res) => {
        setOrder(res.data.data);
        setNewStatus(res.data.data.status);
      })
      .catch((fetchError) => {
        console.error(fetchError);
        setError(fetchError.response?.data?.error?.message || 'Failed to load order details.');
        setOrder(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const orderItems = useMemo(() => (order?.items || order?.OrderItems || []).filter(Boolean), [order]);
  const appliedDiscounts = useMemo(
    () => (Array.isArray(order?.appliedDiscounts) ? order.appliedDiscounts : []),
    [order]
  );
  const address = order?.shippingAddressSnapshot;
  const payment = order?.Payment || null;

  const availableStatuses = useMemo(() => {
    return getAllowedOrderStatuses(order?.status);
  }, [order?.status]);

  const currentStep = useMemo(() => {
    const stepIndex = ORDER_STATUS_STEPPER.indexOf(order?.status);
    return stepIndex >= 0 ? stepIndex : 0;
  }, [order?.status]);

  const customerName = useMemo(() => {
    const fullName = [order?.User?.firstName, order?.User?.lastName].filter(Boolean).join(' ');
    return fullName || address?.fullName || 'Customer unavailable';
  }, [address?.fullName, order?.User?.firstName, order?.User?.lastName]);

  const canRefund = canRefundOrders && isOrderRefundableStatus(order?.status);

  const handleStatusUpdate = async () => {
    if (!canUpdateOrderStatus) {
      notify('You do not have permission to update order status.', 'error');
      return;
    }

    setUpdating(true);
    try {
      const response = await updateOrderStatus(id, newStatus);
      setOrder(response.data.data);
      notify('Order status updated.', 'success');
    } catch (updateError) {
      notify(updateError.response?.data?.error?.message || 'Failed to update status.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleRefund = async () => {
    if (!canRefundOrders) {
      notify('You do not have permission to refund orders.', 'error');
      return;
    }

    if (!window.confirm('Issue a full refund for this order?')) return;

    setUpdating(true);
    try {
      const response = await refundOrder(id);
      setOrder(response.data.data);
      setNewStatus('refunded');
      notify('Refund recorded successfully.', 'success');
    } catch (refundError) {
      notify(refundError.response?.data?.error?.message || 'Failed to refund order.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!order) {
    return <Alert severity="error">{error || 'Order not found.'}</Alert>;
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Button variant="outlined" size="small" sx={{ mb: 1.5 }} onClick={() => navigate('/admin/orders')}>
            ← Back
          </Button>
          <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="h5" fontWeight={700}>
              {order.orderNumber}
            </Typography>
            <Chip label={getOrderStatusLabel(order.status)} color={getOrderStatusColor(order.status)} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Placed on {new Date(order.createdAt).toLocaleString()} • Last updated {new Date(order.updatedAt).toLocaleString()}
          </Typography>
        </Box>

        {canRefund && (
          <Button variant="outlined" color="error" onClick={handleRefund} disabled={updating}>
            {updating ? 'Processing…' : 'Issue Refund'}
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
        <MetricCard label="Order total" value={formatPrice(order.total || 0)} accent="primary.main" />
        <MetricCard label="Items" value={orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} />
        <MetricCard label="Customer" value={customerName} />
        <MetricCard
          label="Payment"
          value={payment ? getOrderStatusLabel(payment.status) : 'Not captured'}
          accent={payment?.status === 'completed' ? 'success.main' : 'text.primary'}
        />
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <DetailCard title="Items">
            {orderItems.map((item) => (
              <Box
                key={item.id}
                sx={{
                  display: 'flex',
                  gap: 2,
                  mb: 2,
                  pb: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {item.snapshotImage && (
                  <Box
                    component="img"
                    src={item.snapshotImage}
                    alt={item.snapshotName}
                    sx={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 1 }}
                  />
                )}
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {item.snapshotName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    SKU: {item.snapshotSku || item.variant?.sku || '—'}
                  </Typography>
                  {item.variantInfo && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {Object.entries(item.variantInfo)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ')}
                    </Typography>
                  )}
                  <Typography variant="caption" display="block" color="text.secondary">
                    Qty: {item.quantity}
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="body2">
                    {formatPrice(item.snapshotPrice || 0)} × {item.quantity}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatPrice(item.total || 0)}
                  </Typography>
                </Box>
              </Box>
            ))}

            {orderItems.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No item snapshots are available for this order.
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: appliedDiscounts.length > 0 ? 2 : 0 }}>
              <AppliedDiscountsSummary discounts={appliedDiscounts} formatPrice={formatPrice} showEmpty />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box>
                {[
                  ['Subtotal', order.subtotal],
                  ['Tax', order.tax],
                  ['Shipping', order.shippingCost],
                  ['Discount', order.discountAmount],
                ].map(
                  ([label, value]) =>
                    Number(value || 0) > 0 && (
                      <Box
                        key={label}
                        sx={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography variant="body2" color={label === 'Discount' ? 'success.main' : 'text.primary'}>
                          {label === 'Discount' ? '-' : ''}
                          {formatPrice(value || 0)}
                        </Typography>
                      </Box>
                    )
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 4, mt: 1 }}>
                  <Typography fontWeight={700}>Total</Typography>
                  <Typography fontWeight={700}>{formatPrice(order.total || 0)}</Typography>
                </Box>
              </Box>
            </Box>
          </DetailCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <DetailCard title="Order Overview">
              <Stack spacing={1.25}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Customer
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {customerName}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body2">{order.User?.email || 'No email available'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Order ID
                  </Typography>
                  <Typography variant="body2">{order.id}</Typography>
                </Box>
                {order.notes && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Order notes
                    </Typography>
                    <Typography variant="body2">{order.notes}</Typography>
                  </Box>
                )}
              </Stack>
            </DetailCard>

            <DetailCard title="Payment Details">
              <Stack spacing={1.25}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {payment ? getOrderStatusLabel(payment.status) : 'Not captured'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Provider
                  </Typography>
                  <Typography variant="body2">{payment?.provider || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Transaction
                  </Typography>
                  <Typography variant="body2">{payment?.transactionId || 'Pending / unavailable'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="body2">
                    {payment ? formatPrice(payment.amount || 0) : formatPrice(order.total || 0)}
                  </Typography>
                </Box>
              </Stack>
            </DetailCard>

            <DetailCard title="Shipping Address">
              {address ? (
                <Stack spacing={0.5}>
                  <Typography variant="body2">{address.fullName}</Typography>
                  <Typography variant="body2">{address.addressLine1}</Typography>
                  {address.addressLine2 && <Typography variant="body2">{address.addressLine2}</Typography>}
                  <Typography variant="body2">
                    {address.city}, {address.state} {address.postalCode}
                  </Typography>
                  <Typography variant="body2">{address.country}</Typography>
                  {address.phone && <Typography variant="body2">{address.phone}</Typography>}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No shipping snapshot was saved for this order.
                </Typography>
              )}
            </DetailCard>

            <DetailCard title="Order Progress">
              <Stepper activeStep={currentStep} orientation="vertical">
                {ORDER_STATUS_STEPPER.map((status) => (
                  <Step key={status} completed={ORDER_STATUS_STEPPER.indexOf(status) <= currentStep}>
                    <StepLabel>{getOrderStatusLabel(status)}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </DetailCard>

            {canUpdateOrderStatus && (
              <DetailCard title="Update Status">
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Status</InputLabel>
                  <Select value={newStatus} label="Status" onChange={(e) => setNewStatus(e.target.value)}>
                    {availableStatuses.map((status) => (
                      <MenuItem key={status} value={status}>
                        {getOrderStatusLabel(status)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Only valid next statuses are shown to avoid accidental regressions.
                </Typography>

                <Button
                  variant="contained"
                  fullWidth
                  disabled={updating || newStatus === order.status}
                  onClick={handleStatusUpdate}
                >
                  {updating ? 'Saving…' : 'Save Status'}
                </Button>
              </DetailCard>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default OrderDetailPage;
