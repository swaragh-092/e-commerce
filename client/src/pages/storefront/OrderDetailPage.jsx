import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Stack,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import PrintIcon from '@mui/icons-material/Print';
import PageSEO from '../../components/common/PageSEO';
import DeliverySummaryCard from '../../components/orders/order-detail/DeliverySummaryCard';
import OrderMetaStrip from '../../components/orders/order-detail/OrderMetaStrip';
import OrderNotesCard from '../../components/orders/order-detail/OrderNotesCard';
import PaymentSummaryCard from '../../components/orders/order-detail/PaymentSummaryCard';
import ProductTrackingSection from '../../components/orders/order-detail/ProductTrackingSection';
import ShippingAddressCard from '../../components/orders/order-detail/ShippingAddressCard';
import TotalsNotesCard from '../../components/orders/order-detail/TotalsNotesCard';
import { buildProductTrackingItems } from '../../components/orders/order-detail/orderDetailUtils';
import { useNotification } from '../../context/NotificationContext';
import { useCurrency, useFeature } from '../../hooks/useSettings';

import { useOrderStatusTransitions } from '../../hooks/useOrderStatusTransitions';
import { userService } from '../../services/userService';

import { orderService } from '../../services/orderService';
import { getCustomerOrderDisplayStatus, getCustomerOrderStatusLabel } from '../../utils/orderHelpers';

import {
  getOrderStatusColor,
  getPaymentStatusLabel,
} from '../../utils/orderWorkflow';
import { PAYMENT_SETTLED_STATUSES, RETRYABLE_PAYMENT_STATUSES } from '../../utils/constants';


const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { confirm } = useNotification();
  const ordersEnabled = useFeature('orders');

  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [putBackDialog, setPutBackDialog] = useState(null);
  const [putBackReason, setPutBackReason] = useState('');

  useEffect(() => {
    if (!ordersEnabled) {
      navigate('/');
    }
  }, [ordersEnabled, navigate]);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
      try {
        const [orderData, trackingData] = await Promise.all([
          orderService.getMyOrderById(id),
          orderService.getMyOrderTracking(id).catch(() => null),
        ]);
        setOrder(orderData || null);
        setTracking(trackingData || null);
      } catch (fetchError) {
        setError(fetchError?.response?.data?.error?.message || 'Failed to load order details.');
        setOrder(null);
        setTracking(null);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const orderItems = useMemo(
    () => (order?.items || order?.OrderItems || []).filter(Boolean),
    [order]
  );
  const payment = order?.Payment || null;
  const address = order?.shippingAddressSnapshot;
  const appliedDiscounts = Array.isArray(order?.appliedDiscounts) ? order.appliedDiscounts : [];
  const isCod = (order?.paymentMethod || payment?.provider) === 'cod';
  const paymentSettled = PAYMENT_SETTLED_STATUSES.includes(payment?.status);
  const { isCancelable } = useOrderStatusTransitions(order?.status);
  const isPendingOnlinePayment = order?.status === 'pending_payment' && order?.paymentMethod !== 'cod';
  const canRetryPayment = isPendingOnlinePayment && RETRYABLE_PAYMENT_STATUSES.includes(payment?.status);
  const canCancel = isCancelable && !isPendingOnlinePayment;
  const pendingPaymentExpiresAt = isPendingOnlinePayment && order?.createdAt
    ? new Date(new Date(order.createdAt).getTime() + 15 * 60 * 1000)
    : null;
  const pendingPaymentExpired = pendingPaymentExpiresAt ? pendingPaymentExpiresAt.getTime() <= Date.now() : false;
  const trackingProgress = tracking?.progress;
  const productTrackingItems = useMemo(
    () => buildProductTrackingItems({
      orderItems,
      fulfillments: order?.fulfillments || [],
      order: order || {},
      payment,
    }),
    [orderItems, order, payment]
  );
  const requestedPutBackQty = useMemo(() => {
    const requests = order?.returns || order?.Returns || [];
    return requests
      .filter((request) => !['return_rejected', 'replacement_rejected'].includes(request.status))
      .flatMap((request) => request.items || [])
      .reduce((map, item) => {
        const orderItemId = item.orderItemId || item.orderItem?.id;
        if (!orderItemId) return map;
        map[orderItemId] = (map[orderItemId] || 0) + Number(item.quantity || 0);
        return map;
      }, {});
  }, [order?.returns, order?.Returns]);
  const returnableProducts = productTrackingItems
    .map((product) => ({
      ...product,
      returnableQuantity: Math.max(Number(product.deliveredQuantity || 0) - Number(requestedPutBackQty[product.item.id] || 0), 0),
    }))
    .filter((product) => product.returnableQuantity > 0 && payment?.status !== 'refunded');
  const putBackRequests = order?.returns || order?.Returns || [];
  const deliveredProducts = productTrackingItems.filter((product) => product.status === 'delivered').length;
  const shipmentRecords = order?.fulfillments || [];
  const dispatchedShipments = shipmentRecords.filter((fulfillment) => fulfillment.status !== 'pending').length;
  const customerDisplayStatus = getCustomerOrderDisplayStatus(order || {});
  const expectedDeliveryDate = useMemo(() => {
    const dates = shipmentRecords
      .flatMap((fulfillment) => fulfillment.shipments || [])
      .map((shipment) => shipment.expectedDeliveryDate)
      .filter(Boolean)
      .sort();
    return dates[dates.length - 1] || '';
  }, [shipmentRecords]);

  const handleCancel = async () => {
    const confirmed = await confirm(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      'error'
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await orderService.cancelOrder(id);
      setOrder((current) => (current ? { ...current, status: 'cancelled' } : current));
      setTracking((current) => (current ? { ...current, orderStatus: 'cancelled' } : current));
    } catch (cancelError) {
      setError(cancelError?.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryPayment = () => {
    navigate(`/payment/${order.id}`);
  };

  const handleCreatePutBackRequest = async () => {
    if (!putBackDialog) return;
    setActionLoading(true);
    try {
      const payload = {
        reason: putBackReason,
        items: [{
          orderItemId: putBackDialog.product.item.id,
          quantity: putBackDialog.product.returnableQuantity,
          reason: putBackReason,
        }],
      };
      if (putBackDialog.type === 'replacement') {
        await orderService.createReplacementRequest(id, payload);
      } else {
        await orderService.createReturnRequest(id, payload);
      }
      const orderData = await orderService.getMyOrderById(id);
      setOrder(orderData || null);
      setPutBackDialog(null);
      setPutBackReason('');
    } catch (putBackError) {
      setError(putBackError?.response?.data?.error?.message || 'Failed to create request.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!order) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Order not found.'}</Alert>
        <Button variant="outlined" onClick={() => navigate('/orders')}>
          Back to orders
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <PageSEO title={`Order ${order.orderNumber}`} type="noindex" />

      <Paper
        elevation={0}
        square
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: { xs: 2, md: 4 },
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
        }}
      >
        <Button
          size="small"
          onClick={() => navigate('/orders')}
          sx={{ fontWeight: 600, fontSize: '0.78rem', color: 'text.secondary', minWidth: 0, px: 1 }}
        >
          ‹ Orders
        </Button>
        <Typography sx={{ color: 'text.disabled', fontSize: '1rem', lineHeight: 1 }}>/</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>Orders</Typography>
        <Typography sx={{ color: 'text.disabled', fontSize: '1rem', lineHeight: 1 }}>/</Typography>
        <Typography sx={{ color: 'text.primary', fontSize: '0.78rem', fontWeight: 700 }}>
          {order.orderNumber}
        </Typography>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          {canRetryPayment && (
            <Button
              size="small"
              variant="contained"
              startIcon={<CreditCardOutlinedIcon sx={{ fontSize: '14px !important' }} />}
              onClick={handleRetryPayment}
              sx={{ fontSize: '0.78rem', fontWeight: 700 }}
            >
              Retry payment
            </Button>
          )}
          {!isPendingOnlinePayment && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PrintIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => window.open(`/account/orders/${id}/invoice`, '_blank')}
              sx={{ fontSize: '0.78rem', fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}
            >
              Invoice
            </Button>
          )}
          {canCancel && (
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={handleCancel}
              disabled={actionLoading}
              sx={{ fontSize: '0.78rem', fontWeight: 600 }}
            >
              {actionLoading ? 'Cancelling…' : 'Cancel order'}
            </Button>
          )}
        </Box>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 3, px: { xs: 2, md: 3 } }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5 }}>
            {error}
          </Alert>
        )}

        {isPendingOnlinePayment && (
          <Alert
            severity={pendingPaymentExpired ? 'warning' : 'info'}
            action={
              canRetryPayment ? (
                <Button color="inherit" size="small" onClick={handleRetryPayment}>
                  Retry payment
                </Button>
              ) : (
                <Button color="inherit" size="small" onClick={() => navigate('/checkout')}>
                  Return to checkout
                </Button>
              )
            }
            sx={{ mb: 2.5 }}
          >
            {pendingPaymentExpired
              ? 'This payment reservation may have expired. Retry payment now, or return to checkout if the reservation has already closed.'
              : `Payment is still pending. Complete payment for this same order before ${pendingPaymentExpiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`}
          </Alert>
        )}

        <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'text.primary', mb: 0.5, letterSpacing: '-0.02em' }}>
              {order.orderNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isPendingOnlinePayment ? 'Payment started' : 'Placed'} on {new Date(order.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} UTC
            </Typography>
          </Box>
          <Chip
            label={getCustomerOrderStatusLabel(customerDisplayStatus)}
            color={getOrderStatusColor(customerDisplayStatus)}
            size="small"
            sx={{ fontWeight: 700, fontSize: '0.75rem' }}
          />
        </Box>

        <OrderMetaStrip
          order={order}
          orderItems={orderItems}
          trackingProgress={trackingProgress}
          paymentLabel={getPaymentStatusLabel(payment?.status)}
          formatPrice={formatPrice}
        />

        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={8}>
            <ProductTrackingSection
              products={productTrackingItems}
              deliveredProducts={deliveredProducts}
              formatPrice={formatPrice}
            />
            {returnableProducts.length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  mt: 2.5,
                  p: { xs: 2, sm: 2.5 },
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary', mb: 1.5 }}>
                  Return or replacement
                </Typography>
                <Stack spacing={1.5}>
                  {returnableProducts.map((product) => (
                    <Box
                      key={product.item.id}
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>{product.item.snapshotName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {product.returnableQuantity} delivered unit available
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" onClick={() => setPutBackDialog({ type: 'return', product })}>
                          Return
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => setPutBackDialog({ type: 'replacement', product })}>
                          Replace
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}
            {putBackRequests.length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  mt: 2.5,
                  p: { xs: 2, sm: 2.5 },
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary', mb: 1.5 }}>
                  Requests
                </Typography>
                <Stack spacing={1}>
                  {putBackRequests.map((request) => (
                    <Box key={request.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>
                          {request.type === 'replacement' ? 'Replacement' : 'Return'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.reason || 'No reason provided'}
                        </Typography>
                      </Box>
                      <Chip size="small" label={String(request.status || '').replace(/_/g, ' ')} />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}
            <TotalsNotesCard
              activeTab={activeTab}
              onTabChange={setActiveTab}
              order={order}
              appliedDiscounts={appliedDiscounts}
              formatPrice={formatPrice}
            />
          </Grid>

          <Grid item xs={12} lg={4}>
            <Stack spacing={2.5}>
              <ShippingAddressCard address={address} />
              <DeliverySummaryCard
                order={order}
                displayStatus={customerDisplayStatus}
                trackingProgress={trackingProgress}
                deliveredProducts={deliveredProducts}
                productCount={productTrackingItems.length}
                dispatchedShipments={dispatchedShipments}
                shipmentCount={shipmentRecords.length}
                expectedDeliveryDate={expectedDeliveryDate}
              />
              <PaymentSummaryCard
                order={order}
                payment={payment}
                isCod={isCod}
                paymentSettled={paymentSettled}
                isPendingOnlinePayment={isPendingOnlinePayment}
                canRetryPayment={canRetryPayment}
                onRetryPayment={handleRetryPayment}
                formatPrice={formatPrice}
              />
              {order.notes && <OrderNotesCard notes={order.notes} />}
            </Stack>
          </Grid>
        </Grid>
      </Container>
      <Dialog open={Boolean(putBackDialog)} onClose={() => !actionLoading && setPutBackDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {putBackDialog?.type === 'replacement' ? 'Request Replacement' : 'Request Return'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 800 }}>{putBackDialog?.product?.item?.snapshotName}</Typography>
              <Typography variant="body2" color="text.secondary">
                Quantity: {putBackDialog?.product?.returnableQuantity || 0}
              </Typography>
            </Box>
            <TextField
              label="Reason"
              value={putBackReason}
              onChange={(event) => setPutBackReason(event.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPutBackDialog(null)} disabled={actionLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleCreatePutBackRequest} disabled={actionLoading || !putBackReason.trim()}>
            {actionLoading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderDetailPage;
