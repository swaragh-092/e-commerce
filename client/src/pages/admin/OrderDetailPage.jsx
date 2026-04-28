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
  Typography,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import PrintIcon from '@mui/icons-material/Print';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { useCurrency } from '../../hooks/useSettings';
import { getOrderById, updateOrderStatus, refundOrder, createFulfillment, updateFulfillmentStatus, confirmCodPayment } from '../../services/adminService';
import { useNotification } from '../../context/NotificationContext';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import AppliedDiscountsSummary from '../../components/orders/AppliedDiscountsSummary';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
  getOrderProgressSteps,
  getOrderStatusColor,
  getOrderStatusLabel,
  getPaymentStatusLabel,
  getPaymentStatusColor,
  isOrderRefundableStatus,
  isOrderFulfillableStatus,
} from '../../utils/orderWorkflow';
import { useOrderStatusTransitions } from '../../hooks/useOrderStatusTransitions';

const DetailCard = ({ title, children, sx = {} }) => (
  <Paper
    elevation={0}
    sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', ...sx }}
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

const ProgressEntry = ({ label, status, occurredAt, last }) => {
  const done = status === 'completed';
  const active = status === 'active';
  const terminal = status === 'terminal';

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.25 }}>
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '2px solid',
            borderColor: done ? 'success.main' : active ? 'primary.main' : terminal ? 'text.secondary' : 'divider',
            bgcolor: done ? 'success.main' : active ? 'primary.main' : terminal ? 'text.secondary' : 'background.paper',
          }}
        />
        {!last && (
          <Box sx={{ width: 1, minHeight: 28, mt: 0.5, bgcolor: done ? 'success.light' : 'divider' }} />
        )}
      </Box>
      <Box sx={{ pb: last ? 0 : 1.5 }}>
        <Typography variant="body2" fontWeight={done || active || terminal ? 700 : 500} color={done || active || terminal ? 'text.primary' : 'text.secondary'}>
          {label}
        </Typography>
        {occurredAt && (
          <Typography variant="caption" color="text.secondary">
            {new Date(occurredAt).toLocaleString()}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

const getTaxRows = (order = {}) => {
  const breakdown = order.taxBreakdown || {};
  const rows = [
    { label: 'CGST', value: breakdown.cgst },
    { label: 'SGST', value: breakdown.sgst },
    { label: 'IGST', value: breakdown.igst },
    { label: 'Tax', value: breakdown.flatTax },
  ].filter((row) => Number(row.value || 0) > 0);

  if (rows.length > 0) return rows;
  return Number(order.tax || 0) > 0 ? [{ label: 'Tax', value: order.tax }] : [];
};

const getFulfillmentProgress = (items = []) => {
  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const shipped = items.reduce((sum, item) => (
    sum + (item.fulfillmentItems || []).reduce((itemSum, fulfillmentItem) => itemSum + Number(fulfillmentItem.quantity || 0), 0)
  ), 0);
  return {
    total,
    shipped,
    remaining: Math.max(total - shipped, 0),
  };
};

const FULFILLMENT_STATUS_LABELS = {
  pending: 'Pending',
  shipped: 'Shipped',
  delivered: 'Delivered',
  returned: 'Returned',
};

const FULFILLMENT_STATUS_TRANSITIONS = {
  pending: ['shipped', 'delivered'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  returned: [],
};

const getFulfillmentStatusOptions = (currentStatus) => [
  currentStatus,
  ...(FULFILLMENT_STATUS_TRANSITIONS[currentStatus] || []),
].filter(Boolean);

const FulfillmentDialog = ({ open, onClose, orderItems, onSave, loading }) => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courier, setCourier] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState({});

  useEffect(() => {
    if (open) {
      const initialItems = {};
      orderItems.forEach(oi => {
        const shipped = (oi.fulfillmentItems || []).reduce((sum, fi) => sum + fi.quantity, 0);
        const remaining = oi.quantity - shipped;
        if (remaining > 0) {
          initialItems[oi.id] = remaining;
        }
      });
      setItems(initialItems);
      setTrackingNumber('');
      setCourier('');
      setNotes('');
      setStatus('pending');
    }
  }, [open, orderItems]);

  const handleQtyChange = (id, val, max) => {
    const qty = Math.min(max, Math.max(0, parseInt(val) || 0));
    setItems(prev => ({ ...prev, [id]: qty }));
  };

  const handleSubmit = () => {
    const shipmentItems = Object.entries(items)
      .filter(([, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

    if (shipmentItems.length === 0) return;
    onSave({ trackingNumber, courier, notes, status, items: shipmentItems });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create Shipment</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mb: 3 }}>
          <TextField
            label="Carrier / Courier"
            fullWidth
            size="small"
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            placeholder="e.g. FedEx, BlueDart"
          />
          <TextField
            label="Tracking Number"
            fullWidth
            size="small"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
          <TextField
            select
            label="Shipment Status"
            fullWidth
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="shipped">Shipped</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
          </TextField>
          <TextField
            label="Notes"
            fullWidth
            size="small"
            multiline
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Stack>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Items to Ship</Typography>
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell align="right">Remaining</TableCell>
                <TableCell align="right" width={100}>Ship Qty</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orderItems.map((oi) => {
                const shipped = (oi.fulfillmentItems || []).reduce((sum, fi) => sum + fi.quantity, 0);
                const remaining = oi.quantity - shipped;
                if (remaining <= 0) return null;

                return (
                  <TableRow key={oi.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{oi.snapshotName}</Typography>
                      <Typography variant="caption" color="text.secondary">{oi.snapshotSku || oi.variant?.sku}</Typography>
                    </TableCell>
                    <TableCell align="right">{remaining}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        value={items[oi.id] || 0}
                        onChange={(e) => handleQtyChange(oi.id, e.target.value, remaining)}
                        inputProps={{ min: 0, max: remaining, style: { textAlign: 'right' } }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading || Object.values(items).every(v => v === 0)}
        >
          {loading ? 'Creating...' : 'Create Shipment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { hasPermission } = useAuth();
  const { notify } = useNotification();
  const canUpdateOrderStatus = hasPermission(PERMISSIONS.ORDERS_UPDATE_STATUS);
  const canRefundOrders = hasPermission(PERMISSIONS.ORDERS_REFUND);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [updating, setUpdating] = useState(false);
  const [fulfillmentDialogOpen, setFulfillmentDialogOpen] = useState(false);
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await getOrderById(id);
      setOrder(res.data.data);
      setNewStatus(res.data.data.status);
    } catch (fetchError) {
      console.error(fetchError);
      setOrder(null);
      setNewStatus('');
      setError(getApiErrorMessage(fetchError, 'Failed to load order details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchOrder();
  }, [id]);

  const orderItems = useMemo(() => (order?.items || order?.OrderItems || []).filter(Boolean), [order]);
  const taxRows = useMemo(() => getTaxRows(order || {}), [order]);
  const fulfillmentProgress = useMemo(() => getFulfillmentProgress(orderItems), [orderItems]);
  const appliedDiscounts = useMemo(
    () => (Array.isArray(order?.appliedDiscounts) ? order.appliedDiscounts : []),
    [order]
  );
  const address = order?.shippingAddressSnapshot;
  const payment = order?.Payment || null;

  const { allowedNextStatuses, isRefundable, isFulfillable } = useOrderStatusTransitions(order?.status);

  const availableStatuses = useMemo(() => {
    if (!order?.status) return [];
    return [order.status, ...allowedNextStatuses].filter((statusOption) => statusOption !== 'refunded');
  }, [order?.status, allowedNextStatuses]);

  const progressSteps = useMemo(
    () => getOrderProgressSteps({ ...(order || {}), Payment: payment }, fulfillmentProgress),
    [fulfillmentProgress, order, payment]
  );
  const hasStatusTransitions = availableStatuses.length > 1;

  const customerName = useMemo(() => {
    const fullName = [order?.User?.firstName, order?.User?.lastName].filter(Boolean).join(' ');
    return fullName || address?.fullName || 'Customer unavailable';
  }, [address?.fullName, order?.User?.firstName, order?.User?.lastName]);

  const hasSettledPayment = ['completed', 'cod_collected'].includes(payment?.status);
  const canRefund = canRefundOrders && isRefundable && hasSettledPayment;
  const canFulfill = canUpdateOrderStatus && isFulfillable;
  const canConfirmCod = canUpdateOrderStatus && order?.paymentMethod === 'cod' && ['pending', 'cod_pending'].includes(payment?.status || 'pending') && ['pending_cod', 'processing'].includes(order?.status);

  const handleStatusUpdate = async () => {
    if (!canUpdateOrderStatus) {
      notify('You do not have permission to update order status.', 'error');
      return;
    }

    setUpdating(true);
    try {
      const response = await updateOrderStatus(id, newStatus);
      setOrder(response.data.data);
      notify('Order status updated successfully.', 'success');
    } catch (updateError) {
      notify(getApiErrorMessage(updateError, 'Failed to update status.'), 'error');
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
      notify(getApiErrorMessage(refundError, 'Failed to refund order.'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmCodPayment = async () => {
    setUpdating(true);
    try {
      await confirmCodPayment(id);
      await fetchOrder();
      notify('COD payment marked as collected.', 'success');
    } catch (codError) {
      notify(getApiErrorMessage(codError, 'Failed to confirm COD payment.'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateFulfillment = async (data) => {
    setFulfillmentLoading(true);
    try {
      await createFulfillment(id, data);
      notify('Shipment created successfully.', 'success');
      setFulfillmentDialogOpen(false);
      fetchOrder(); // Refresh to catch updated status and fulfills
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to create shipment.'), 'error');
    } finally {
      setFulfillmentLoading(false);
    }
  };

  const handleFulfillmentStatusUpdate = async (fulfillmentId, status) => {
    const fulfillment = order?.fulfillments?.find((item) => item.id === fulfillmentId);
    if (!fulfillment || fulfillment.status === status) return;

    const allowedStatuses = getFulfillmentStatusOptions(fulfillment.status);
    if (!allowedStatuses.includes(status)) {
      notify(`Cannot change shipment status from ${FULFILLMENT_STATUS_LABELS[fulfillment.status] || fulfillment.status} to ${FULFILLMENT_STATUS_LABELS[status] || status}.`, 'error');
      return;
    }

    try {
      const response = await updateFulfillmentStatus(id, fulfillmentId, status);
      setOrder(response.data.data);
      notify('Shipment status updated successfully.', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to update shipment status.'), 'error');
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

        <Stack direction="row" spacing={1}>
          <Button 
            variant="outlined" 
            startIcon={<PrintIcon />}
            onClick={() => window.open(`/admin/orders/${id}/invoice`, '_blank')}
          >
            Print Invoice
          </Button>
          {canRefund && (
            <Button variant="outlined" color="error" onClick={handleRefund} disabled={updating}>
              {updating ? 'Processing…' : 'Issue Refund'}
            </Button>
          )}
          {canConfirmCod && (
            <Button variant="outlined" onClick={handleConfirmCodPayment} disabled={updating}>
              {updating ? 'Saving…' : 'Mark COD Collected'}
            </Button>
          )}
          {canFulfill && (
             <Button 
               variant="contained" 
               color="primary" 
               startIcon={<LocalShippingIcon />}
               onClick={() => setFulfillmentDialogOpen(true)}
             >
               Create Shipment
             </Button>
          )}
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
        <MetricCard label="Order total" value={formatPrice(order.total || 0)} accent="primary.main" />
        <MetricCard label="Items" value={orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} />
        <MetricCard label="Fulfilled" value={`${fulfillmentProgress.shipped}/${fulfillmentProgress.total}`} />
        <MetricCard label="Customer" value={customerName} />
        <MetricCard
          label="Payment"
          value={getPaymentStatusLabel(payment?.status)}
          accent={['completed', 'cod_collected'].includes(payment?.status) ? 'success.main' : payment?.status === 'refunded' ? 'text.secondary' : 'text.primary'}
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
                        .filter(([key]) => ![
                          'id', 'productId', 'variantId', 'orderId', 'sku', 'price', 
                          'isActive', 'stockQty', 'createdAt', 'updatedAt', 'deletedAt', 
                          'sortOrder', 'version', 'isDefault'
                        ].includes(key))
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

                {taxRows.map(({ label, value }) => (
                  <Box
                    key={label}
                    sx={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="body2">
                      {formatPrice(value || 0)}
                    </Typography>
                  </Box>
                ))}

                {order.taxBreakdown?.isInclusive && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
                    Prices include applicable tax.
                  </Typography>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 4, mt: 1 }}>
                  <Typography fontWeight={700}>Total</Typography>
                  <Typography fontWeight={700}>{formatPrice(order.total || 0)}</Typography>
                </Box>
              </Box>
            </Box>
          </DetailCard>

          <Box sx={{ mt: 3, display: 'flex', gap: 2, alignItems: 'stretch' }}>
            <DetailCard title="Payment Details" sx={{ flex: 1 }}>
              <Stack spacing={1.25}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    size="small"
                    label={getPaymentStatusLabel(payment?.status)}
                    color={getPaymentStatusColor(payment?.status)}
                    sx={{ mt: 0.5 }}
                  />
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

            <DetailCard title="Shipping Address" sx={{ flex: 1 }}>
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
          </Box>

          {order.fulfillments && order.fulfillments.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <DetailCard title="Shipments / Sub-Orders">
                <Stack spacing={2}>
                  {order.fulfillments.map((f, index) => {
                    const statusOptions = getFulfillmentStatusOptions(f.status);
                    const isTerminalShipment = statusOptions.length <= 1;

                    return (
                    <Paper
                      key={f.id}
                      elevation={0}
                      sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'grey.50' }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Shipment #{index + 1}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">Status:</Typography>
                            <FormControl size="small" variant="standard" sx={{ minWidth: 100 }}>
                              <Select
                                value={f.status}
                                onChange={(e) => handleFulfillmentStatusUpdate(f.id, e.target.value)}
                                disabled={!canUpdateOrderStatus || isTerminalShipment}
                                sx={{ 
                                  fontSize: '0.75rem', 
                                  fontWeight: 600,
                                  color: 'primary.main',
                                  '&:before, &:after': { display: 'none' }
                                }}
                              >
                                {statusOptions.map((statusOption) => (
                                  <MenuItem key={statusOption} value={statusOption} sx={{ fontSize: '0.75rem' }}>
                                    {FULFILLMENT_STATUS_LABELS[statusOption] || statusOption}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="body2" fontWeight={600}>{f.courier || 'Standard Courier'}</Typography>
                          <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>{f.trackingNumber || 'No tracking'}</Typography>
                        </Box>
                      </Box>
                      <Divider sx={{ mb: 2 }} />
                      <Stack spacing={1.25} sx={{ mb: f.notes ? 2 : 0 }}>
                        {f.items?.map(item => (
                          <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.primary">{item.orderItem?.snapshotName}</Typography>
                            <Typography variant="body2" fontWeight={700} color="text.secondary">Qty: {item.quantity}</Typography>
                          </Box>
                        ))}
                      </Stack>
                      {f.notes && (
                        <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Notes:</Typography>
                          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{f.notes}</Typography>
                        </Box>
                      )}
                    </Paper>
                    );
                  })}
                </Stack>
              </DetailCard>
            </Box>
          )}
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

            
            {canUpdateOrderStatus && hasStatusTransitions && (
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
            

            <DetailCard title="Order Progress">
              {progressSteps.map((step, index) => (
                <ProgressEntry
                  key={step.key}
                  label={step.label}
                  status={step.status}
                  occurredAt={step.occurredAt}
                  last={index === progressSteps.length - 1}
                />
              ))}
            </DetailCard>

            
          </Stack>
        </Grid>
      </Grid>

      <FulfillmentDialog
        open={fulfillmentDialogOpen}
        onClose={() => setFulfillmentDialogOpen(false)}
        orderItems={orderItems}
        onSave={handleCreateFulfillment}
        loading={fulfillmentLoading}
      />
    </Box>
  );
};

export default OrderDetailPage;
