import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';
import PageSEO from '../../components/common/PageSEO';
import AppliedDiscountsSummary from '../../components/orders/AppliedDiscountsSummary';
import { useCurrency, useFeature } from '../../hooks/useSettings';
import { userService } from '../../services/userService';
import {
  getOrderProgressSteps,
  getOrderStatusColor,
  getOrderStatusLabel,
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from '../../utils/orderWorkflow';
import { useOrderStatusTransitions } from '../../hooks/useOrderStatusTransitions';
import { useNotification } from '../../context/NotificationContext';

// ─── Shared card style (MUI theme tokens only) ────────────────────────────────
const sxCard = {
  p: 2.5,
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
};

// ─── Section label ────────────────────────────────────────────────────────────
const SectionLabel = ({ icon: Icon, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
    {Icon && <Icon sx={{ fontSize: 15, color: 'text.disabled' }} />}
    <Typography
      sx={{
        fontWeight: 700,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: 'text.disabled',
        fontSize: '0.67rem',
      }}
    >
      {children}
    </Typography>
  </Box>
);

// ─── Meta stat card ───────────────────────────────────────────────────────────
const MetaCard = ({ label, value, sub }) => (
  <Box sx={{ flex: 1, minWidth: 0 }}>
    <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {value}
    </Typography>
    {sub && (
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
        {sub}
      </Typography>
    )}
  </Box>
);

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

// ─── Timeline entry ───────────────────────────────────────────────────────────
const TimelineEntry = ({ label, sub, done, active, terminal, last }) => (
  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: '2px' }}>
      {done || terminal ? (
        <CheckCircleOutlineIcon sx={{ fontSize: 15, color: terminal ? 'text.secondary' : 'success.main' }} />
      ) : active ? (
        <Box sx={{
          width: 13, height: 13, borderRadius: '50%',
          border: '2px solid',
          borderColor: 'primary.main',
          bgcolor: 'primary.main',
          opacity: 0.35,
          mt: '1px',
        }} />
      ) : (
        <RadioButtonUncheckedIcon sx={{ fontSize: 15, color: 'action.disabled' }} />
      )}
      {!last && (
        <Box sx={{
          width: '1px',
          flex: 1,
          bgcolor: done ? 'success.main' : 'divider',
          opacity: done ? 0.35 : 1,
          mt: 0.5,
          minHeight: 20,
        }} />
      )}
    </Box>
    <Box sx={{ pb: last ? 0 : 2 }}>
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: active || done || terminal ? 'text.primary' : 'text.disabled' }}>
        {label}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
          {sub}
        </Typography>
      )}
    </Box>
  </Box>
);

// ─── Totals tab panel ─────────────────────────────────────────────────────────
const TotalsPanel = ({ order, appliedDiscounts, formatPrice }) => {
  const taxRows = getTaxRows(order);

  return (
  <Box>
    {appliedDiscounts.length > 0 && (
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          <Box sx={{
            px: 1.5, py: 0.5, borderRadius: 2,
            bgcolor: 'success.main',
            display: 'flex', alignItems: 'center', gap: 0.75,
          }}>
            <LocalOfferOutlinedIcon sx={{ fontSize: 13, color: 'success.contrastText' }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'success.contrastText' }}>
              {appliedDiscounts.length} promotions applied
            </Typography>
          </Box>
          {appliedDiscounts.map((d) => (
            <Chip
              key={d.code}
              label={d.code}
              size="small"
              color="secondary"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }}
            />
          ))}
          {appliedDiscounts[0]?.savings && (
            <Typography sx={{ ml: 'auto', fontSize: '0.8rem', fontWeight: 700, color: 'success.main' }}>
              -{formatPrice(appliedDiscounts.reduce((s, d) => s + (d.savings || 0), 0))} total
            </Typography>
          )}
        </Box>
        <AppliedDiscountsSummary discounts={appliedDiscounts} formatPrice={formatPrice} showEmpty={false} />
      </Box>
    )}

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {[
        { label: 'Subtotal', value: order.subtotal },
        {
          label: `Discount${appliedDiscounts[0]?.code ? ` — ${appliedDiscounts[0].code}` : ''}`,
          value: order.discountAmount,
          color: 'success.main',
          prefix: '-',
        },
        {
          label: 'Loyalty reward',
          value: appliedDiscounts.find(d => d.type === 'loyalty')?.savings,
          color: 'success.main',
          prefix: '-',
        },
        { label: 'Shipping', value: order.shippingCost },
      ]
        .filter(r => Number(r.value || 0) > 0)
        .map(({ label, value, color, prefix }) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: color || 'text.primary' }}>
              {prefix}{formatPrice(value || 0)}
            </Typography>
          </Box>
        ))}

      {taxRows.map(({ label, value }) => (
        <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatPrice(value || 0)}
          </Typography>
        </Box>
      ))}

      {order.taxBreakdown?.isInclusive && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
          Prices include applicable tax.
        </Typography>
      )}

      <Divider sx={{ my: 1 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: 'text.primary' }}>Total</Typography>
        <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: 'primary.main' }}>
          {formatPrice(order.total || 0)}
        </Typography>
      </Box>
    </Box>
  </Box>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const { confirm } = useNotification();
  const ordersEnabled = useFeature('orders');

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
          userService.getMyOrderById(id),
          userService.getMyOrderTracking(id).catch(() => null),
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

  const handleCancel = async () => {
    const confirmed = await confirm(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      'error'
    );
    if (!confirmed) return;
    setActionLoading(true);
    try {
      await userService.cancelOrder(id);
      setOrder((current) => (current ? { ...current, status: 'cancelled' } : current));
      setTracking((current) => (current ? { ...current, orderStatus: 'cancelled' } : current));
    } catch (cancelError) {
      setError(cancelError?.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setActionLoading(false);
    }
  };

  const orderItems = useMemo(
    () => (order?.items || order?.OrderItems || []).filter(Boolean),
    [order]
  );
  const appliedDiscounts = Array.isArray(order?.appliedDiscounts) ? order.appliedDiscounts : [];
  const address = order?.shippingAddressSnapshot;
  const payment = order?.Payment || null;
  const { isCancelable } = useOrderStatusTransitions(order?.status);
  const canCancel = isCancelable;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
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

  const dispatchedCount = (order.fulfillments || []).filter(f => f.status !== 'pending').length;

  const trackingProgress = tracking?.progress;
  const timelineEntries = tracking?.timeline?.map((entry) => ({
    label: entry.label,
    sub: entry.occurredAt ? new Date(entry.occurredAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : undefined,
    done: entry.status === 'completed',
    active: entry.status === 'active',
    terminal: entry.status === 'terminal',
  })) || getOrderProgressSteps(order, trackingProgress).map((entry) => ({
    label: entry.label,
    sub: entry.occurredAt ? new Date(entry.occurredAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : undefined,
    done: entry.status === 'completed',
    active: entry.status === 'active',
    terminal: entry.status === 'terminal',
  }));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <PageSEO title={`Order ${order.orderNumber}`} type="noindex" />

      {/* ── Sticky top bar ───────────────────────────────────────────────── */}
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
        {/* Breadcrumb */}
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

        {/* Actions */}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PrintIcon sx={{ fontSize: '14px !important' }} />}
            onClick={() => window.open(`/account/orders/${id}/invoice`, '_blank')}
            sx={{ fontSize: '0.78rem', fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}
          >
            Invoice
          </Button>
          {/* <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: '14px !important' }} />}
            sx={{ fontSize: '0.78rem', fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}
          >
            Export
          </Button> */}
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
          {/* <Box
            sx={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 2, border: '1px solid', borderColor: 'divider',
              cursor: 'pointer', color: 'text.secondary',
              '&:hover': { color: 'text.primary', borderColor: 'text.secondary' },
            }}
          >
            <MoreHorizIcon sx={{ fontSize: 18 }} />
          </Box> */}
        </Box>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 3, px: { xs: 2, md: 3 } }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5 }}>
            {error}
          </Alert>
        )}

        {/* ── Order header ─────────────────────────────────────────────── */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'text.primary', mb: 0.5, letterSpacing: '-0.02em' }}>
              {order.orderNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Placed on {new Date(order.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} UTC
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={getOrderStatusLabel(order.status)}
              color={getOrderStatusColor(order.status)}
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.75rem' }}
            />
           
          </Box>
        </Box>

        {/* ── Meta strip ───────────────────────────────────────────────── */}
        <Paper
          elevation={0}
          sx={{
            ...sxCard,
            mb: 3,
            display: 'flex',
            flexWrap: 'wrap',
            '& > *:not(:last-child)': {
              borderRight: { xs: 'none', sm: '1px solid' },
              borderColor: { sm: 'divider' },
              pr: { xs: 0, sm: 3 },
              mr: { xs: 0, sm: 3 },
            },
          }}
        >
          <MetaCard
            label="Customer"
            value={order.customerName || order.shippingAddressSnapshot?.fullName || '—'}
            sub={order.customerEmail}
          />
          <MetaCard
            label="Items ordered"
            value={`${orderItems.length} item${orderItems.length !== 1 ? 's' : ''}`}
            sub={trackingProgress ? `${trackingProgress.fulfilledQuantity}/${trackingProgress.totalQuantity} units fulfilled` : undefined}
          />
          <MetaCard
            label="Payment"
            value={order.paymentMethod || payment?.provider || '—'}
            sub={getPaymentStatusLabel(payment?.status)}
          />
          <MetaCard
            label="Order total"
            value={formatPrice(order.total || 0)}
          />
        </Paper>

        {/* ── Main grid ────────────────────────────────────────────────── */}
        <Grid container spacing={2.5}>

          {/* Left column */}
          <Grid item xs={12} lg={8}>

            {/* Order Items */}
            <Paper elevation={0} sx={{ ...sxCard, mb: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <SectionLabel icon={ReceiptLongIcon}>Order items</SectionLabel>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
                  {orderItems.length} of {orderItems.length} in cart
                </Typography>
              </Box>

              <Stack divider={<Divider />} spacing={0}>
                {orderItems.map((item) => {
                  const shippedQty = (item.fulfillmentItems || []).reduce((s, fi) => s + fi.quantity, 0);
                  const isPending = shippedQty < item.quantity;
                  return (
                    <Box key={item.id} sx={{ display: 'flex', gap: 2, py: 2, alignItems: 'flex-start' }}>
                      {/* Thumbnail placeholder */}
                      <Box sx={{
                        width: 44, height: 44, borderRadius: 2, flexShrink: 0,
                        border: '1px solid', borderColor: 'divider',
                        bgcolor: 'action.hover',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <ReceiptLongIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: 'text.primary', mb: 0.25 }}>
                          {item.snapshotName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          SKU: {item.snapshotSku || '—'}
                        </Typography>
                        {item.variantInfo && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {Object.entries(item.variantInfo)
                              .filter(([key]) => ![
                                'id', 'productId', 'variantId', 'orderId', 'sku', 'price', 
                                'isActive', 'stockQty', 'createdAt', 'updatedAt', 'deletedAt', 
                                'sortOrder', 'version', 'isDefault'
                              ].includes(key))
                              .map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                          <Typography variant="caption" color="text.secondary">
                            Qty {item.quantity}
                          </Typography>
                          {shippedQty > 0 && (
                            <Chip
                              size="small"
                              color="success"
                              variant="outlined"
                              label={`Qty ${shippedQty} · Shipped`}
                              sx={{ height: 20, fontSize: '0.67rem', fontWeight: 700 }}
                            />
                          )}
                          {isPending && shippedQty === 0 && (
                            <Chip
                              size="small"
                              color="warning"
                              variant="outlined"
                              label={`Qty ${item.quantity} · Pending`}
                              sx={{ height: 20, fontSize: '0.67rem', fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      </Box>

                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                          {formatPrice(item.snapshotPrice || 0)} each
                        </Typography>
                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: 'text.primary' }}>
                          {formatPrice(item.total || 0)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Paper>

            {/* Shipments */}
            {order.fulfillments && order.fulfillments.length > 0 && (
              <Paper elevation={0} sx={{ ...sxCard, mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <SectionLabel icon={LocalShippingIcon}>Shipments</SectionLabel>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
                    {dispatchedCount} of {order.fulfillments.length} dispatched
                  </Typography>
                </Box>

                <Stack spacing={1.5}>
                  {order.fulfillments.map((f, index) => {
                    const isTransit = f.status === 'in_transit' || f.status === 'shipped';
                    const isPending = f.status === 'pending' || f.status === 'awaiting_dispatch';
                    const chipColor = isTransit ? 'success' : isPending ? 'warning' : 'primary';
                    const chipLabel = isTransit ? 'In transit' : isPending ? 'Awaiting dispatch' : f.status;
                    return (
                      <Box
                        key={f.id}
                        sx={{
                          p: 2, borderRadius: 2,
                          bgcolor: 'action.hover',
                          border: '1px solid', borderColor: 'divider',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'text.primary' }}>
                              Shipment #{index + 1}
                            </Typography>
                            <Chip
                              size="small"
                              color={chipColor}
                              label={chipLabel}
                              sx={{ height: 20, fontSize: '0.67rem', fontWeight: 700 }}
                            />
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'text.primary' }}>
                              {f.courier || 'Standard Courier'}
                            </Typography>
                            {f.trackingUrl ? (
                              <Typography
                                component="a"
                                href={f.trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: 'primary.main',
                                  textDecoration: 'none',
                                  '&:hover': { textDecoration: 'underline' },
                                }}
                              >
                                {f.trackingNumber || 'Track Package'}
                              </Typography>
                            ) : (
                              <Typography
                                sx={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: f.trackingNumber ? 'primary.main' : 'text.secondary',
                                }}
                              >
                                {f.trackingNumber || 'Tracking pending'}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        <Divider sx={{ mb: 1.5 }} />

                        <Stack spacing={0.75}>
                          {f.items?.map(fi => (
                            <Box key={fi.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                {fi.orderItem?.snapshotName}
                              </Typography>
                              <Chip
                                size="small"
                                color={isTransit ? 'success' : 'warning'}
                                variant="outlined"
                                label={`× ${fi.quantity} · ${isTransit ? 'Shipped' : 'Pending'}`}
                                sx={{ height: 20, fontSize: '0.67rem', fontWeight: 700 }}
                              />
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Paper>
            )}

            {/* Totals / Activity / Notes tabs */}
            <Paper elevation={0} sx={sxCard}>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                sx={{
                  mb: 2.5,
                  minHeight: 36,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '& .MuiTabs-indicator': { height: 2, borderRadius: 1 },
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    textTransform: 'none',
                    minHeight: 36,
                    px: 2,
                    py: 0,
                    color: 'text.secondary',
                    '&.Mui-selected': { color: 'text.primary' },
                  },
                }}
              >
                <Tab label="Totals & discounts" />
                {/* <Tab label="Activity log" /> */}
                <Tab label="Notes" />
              </Tabs>

              {activeTab === 0 && (
                <TotalsPanel order={order} appliedDiscounts={appliedDiscounts} formatPrice={formatPrice} />
              )}
              {/* {activeTab === 1 && (
                <Typography variant="body2" color="text.secondary">No activity logged.</Typography>
              )} */}
              {activeTab === 1 && (
                order.notes
                  ? <Typography variant="body2" color="text.secondary">{order.notes}</Typography>
                  : <Typography variant="body2" color="text.secondary">No notes on this order.</Typography>
              )}
            </Paper>
          </Grid>

          {/* Right column */}
          <Grid item xs={12} lg={4}>
            <Stack spacing={2.5}>


              {/* Shipping address */}
              <Paper elevation={0} sx={sxCard}>
                <SectionLabel icon={LocalShippingIcon}>Shipping address</SectionLabel>
                {address ? (
                  <Stack spacing={0.4}>
                    {[
                      { text: address.fullName, primary: true },
                      { text: address.addressLine1 },
                      { text: address.addressLine2 },
                      { text: [address.city, address.state, address.postalCode].filter(Boolean).join(', ') },
                      { text: address.country },
                      { text: address.phone },
                    ]
                      .filter(l => l.text)
                      .map(({ text, primary }, i) => (
                        <Typography
                          key={i}
                          variant="body2"
                          color={primary ? 'text.primary' : 'text.secondary'}
                          sx={{ fontWeight: primary ? 700 : 400 }}
                        >
                          {text}
                        </Typography>
                      ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No shipping address snapshot available.
                  </Typography>
                )}
              </Paper>

              {/* Fulfillment timeline */}
              <Paper elevation={0} sx={sxCard}>
                <SectionLabel icon={TimelineIcon}>Fulfillment timeline</SectionLabel>
                {trackingProgress && (
                  <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="body2" fontWeight={700}>
                      {trackingProgress.percent}% fulfilled
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {trackingProgress.fulfilledQuantity} shipped, {trackingProgress.remainingQuantity} remaining
                    </Typography>
                  </Box>
                )}
                <Box>
                  {timelineEntries.map((entry, i) => (
                    <TimelineEntry
                      key={i}
                      label={entry.label}
                      sub={entry.sub}
                      done={entry.done}
                      active={entry.active}
                      terminal={entry.terminal}
                      last={i === timelineEntries.length - 1}
                    />
                  ))}
                </Box>
              </Paper>

              {/* Payment */}
              <Paper elevation={0} sx={sxCard}>
                <SectionLabel icon={CreditCardOutlinedIcon}>Payment</SectionLabel>
                <Stack spacing={1.25}>
	                  {[
	                    { label: 'Method', value: order.paymentMethod || 'Visa •••• 4291' },
	                    {
	                      label: 'Status',
	                      custom: (
	                        <Chip
	                          size="small"
	                          color={getPaymentStatusColor(payment?.status)}
	                          label={getPaymentStatusLabel(payment?.status)}
	                          sx={{ height: 20, fontSize: '0.67rem', fontWeight: 700 }}
	                        />
	                      ),
	                    },
	                    { label: 'Transaction ID', value: payment?.transactionId || '—', mono: true },
	                    { label: payment?.status === 'refunded' ? 'Refunded' : 'Charged', value: formatPrice(payment?.amount || order.total || 0), bold: true },
	                  ].map(({ label, value, custom, mono, bold }) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      {custom || (
                        <Typography
                          variant="body2"
                          color={bold ? 'text.primary' : 'text.secondary'}
                          sx={{
                            fontWeight: bold ? 800 : 500,
                            fontFamily: mono ? 'monospace' : 'inherit',
                            maxWidth: 150,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {value}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Paper>

              {/* Order notes (if any) */}
              {order.notes && (
                <Paper elevation={0} sx={sxCard}>
                  <SectionLabel>Order notes</SectionLabel>
                  <Typography variant="body2" color="text.secondary">{order.notes}</Typography>
                </Paper>
              )}

            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default OrderDetailPage;
