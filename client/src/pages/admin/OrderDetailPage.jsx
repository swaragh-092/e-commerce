import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import PrintIcon from '@mui/icons-material/Print';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PaymentIcon from '@mui/icons-material/Payment';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SendIcon from '@mui/icons-material/Send';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import { useCurrency } from '../../hooks/useSettings';
import { PAYMENT_SETTLED_STATUSES } from '../../utils/constants';
import { getOrderById, updateOrderStatus, refundOrder, createFulfillment, updateFulfillmentStatus, updateShipment, confirmCodPayment, getShippingProviders, addOrderNote } from '../../services/adminService';
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
  getShipmentStatusLabel,
  getShipmentStatusColor,
  getPaymentStatusLabel,
  getPaymentStatusColor,
} from '../../utils/orderWorkflow';
import { useOrderStatusTransitions } from '../../hooks/useOrderStatusTransitions';

// ─── Order History helpers ──────────────────────────────────────────────────

const EVENT_META = {
  order_placed:    { icon: ShoppingCartIcon,        color: '#6366f1', label: 'Order Placed' },
  status_changed:  { icon: SwapHorizIcon,           color: '#0ea5e9', label: 'Status Changed' },
  admin_note:      { icon: NoteAddIcon,             color: '#f59e0b', label: 'Admin Note' },
  payment:         { icon: PaymentIcon,             color: '#10b981', label: 'Payment' },
  shipment:        { icon: LocalShippingIcon,       color: '#8b5cf6', label: 'Shipment' },
  return:          { icon: SwapHorizIcon,           color: '#ef4444', label: 'Return' },
  refund:          { icon: PaymentIcon,             color: '#f97316', label: 'Refund' },
};

const getEventMeta = (eventType = '') => {
  const key = Object.keys(EVENT_META).find((k) => eventType.startsWith(k));
  return EVENT_META[key] || { icon: HistoryIcon, color: '#6b7280', label: eventType };
};

const ACTOR_META = {
  system:   { icon: SmartToyIcon,              label: 'System',  bg: '#1e293b', fg: '#94a3b8' },
  admin:    { icon: AdminPanelSettingsIcon,    label: 'Admin',   bg: '#1e3a5f', fg: '#60a5fa' },
  customer: { icon: PersonIcon,               label: 'Customer',bg: '#1a2e1a', fg: '#4ade80' },
};

const getActorMeta = (actorType = 'system') => ACTOR_META[actorType] || ACTOR_META.system;

const HistoryEventRow = ({ event, isLast }) => {
  const meta = getEventMeta(event.eventType);
  const actorMeta = getActorMeta(event.actorType);
  const Icon = meta.icon;
  const ActorIcon = actorMeta.icon;

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      {/* Left: icon column with connecting line */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, pt: 0.25 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            bgcolor: `${meta.color}18`,
            border: `2px solid ${meta.color}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 16, color: meta.color }} />
        </Box>
        {!isLast && (
          <Box sx={{ width: '2px', flexGrow: 1, minHeight: 24, mt: 0.5, bgcolor: 'divider' }} />
        )}
      </Box>

      {/* Right: content */}
      <Box sx={{ pb: isLast ? 0 : 2.5, flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
          <Typography variant="body2" fontWeight={700} sx={{ color: meta.color }}>
            {meta.label}
          </Typography>
          <Tooltip title={`Actor type: ${event.actorType || 'system'}`}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.4,
                px: 0.75,
                py: 0.2,
                borderRadius: 1,
                bgcolor: actorMeta.bg,
                border: `1px solid ${actorMeta.fg}33`,
                cursor: 'default',
              }}
            >
              <ActorIcon sx={{ fontSize: 11, color: actorMeta.fg }} />
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: actorMeta.fg, fontWeight: 600, lineHeight: 1 }}>
                {event.actor ? `${event.actor.firstName || ''} ${event.actor.lastName || ''}`.trim() || actorMeta.label : actorMeta.label}
              </Typography>
            </Box>
          </Tooltip>
          <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>
            {new Date(event.createdAt).toLocaleString()}
          </Typography>
        </Box>
        <Typography
          variant="body2"
          color={event.eventType === 'admin_note' ? 'text.primary' : 'text.secondary'}
          sx={{
            ...(event.eventType === 'admin_note' && {
              p: 1.25,
              bgcolor: 'action.hover',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              fontStyle: 'italic',
            }),
          }}
        >
          {event.description}
        </Typography>
      </Box>
    </Box>
  );
};

const OrderHistorySection = ({ history = [], onAddNote, addingNote, inDialog = false }) => {
  const [note, setNote] = useState('');
  const textRef = useRef(null);

  const sorted = useMemo(
    () => [...history].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [history]
  );

  const handleSubmit = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    const ok = await onAddNote(trimmed);
    if (ok) {
      setNote('');
      textRef.current?.blur();
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: inDialog ? 0 : 3,
        border: inDialog ? 0 : '1px solid',
        borderColor: 'divider',
        mt: inDialog ? 0 : 3,
      }}
    >
      {!inDialog && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <HistoryIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="h6" fontWeight={700}>
            Order History
          </Typography>
          <Chip
            label={history.length}
            size="small"
            sx={{ ml: 0.5, height: 20, fontSize: '0.7rem', bgcolor: 'action.selected' }}
          />
        </Box>
      )}

      {/* Add note input */}
      <Box sx={{ mb: 3 }}>
        <Stack spacing={1} alignItems="flex-end">
          <TextField
            inputRef={textRef}
            fullWidth
            multiline
            minRows={2}
            maxRows={5}
            size="small"
            placeholder="Add an internal note... (Ctrl+Enter to submit)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKey}
            disabled={addingNote}
          />
          <Button
            size="small"
            variant="contained"
            onClick={handleSubmit}
            disabled={addingNote || !note.trim()}
            startIcon={addingNote ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
            sx={{ minWidth: 112 }}
          >
            {addingNote ? 'Saving...' : 'Add Note'}
          </Button>
        </Stack>
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      {/* Timeline */}
      {sorted.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No history events recorded yet.
        </Typography>
      ) : (
        <Stack spacing={0}>
          {sorted.map((event, idx) => (
            <HistoryEventRow key={event.id} event={event} isLast={idx === sorted.length - 1} />
          ))}
        </Stack>
      )}
    </Paper>
  );
};

// ─── Page components ─────────────────────────────────────────────────────────

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
          <Box sx={{ width: '2px', minHeight: 28, mt: 0.5, bgcolor: done ? 'success.light' : 'divider' }} />
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

const getFulfillmentProgress = (items = [], fulfillments = []) => {
  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const deliveredByItem = fulfillments
    .filter((fulfillment) => fulfillment.status === 'delivered')
    .flatMap((fulfillment) => fulfillment.items || [])
    .reduce((map, item) => {
      const orderItemId = item.orderItemId || item.orderItem?.id;
      if (!orderItemId) return map;
      map[orderItemId] = (map[orderItemId] || 0) + Number(item.quantity || 0);
      return map;
    }, {});
  const shipped = items.reduce((sum, item) => sum + Number(deliveredByItem[item.id] || 0), 0);
  return {
    total,
    shipped,
    remaining: Math.max(total - shipped, 0),
  };
};

const getDispatchedQuantity = (item = {}) => {
  const shipmentQty = (item.shipmentItems || []).reduce((sum, shipmentItem) => sum + Number(shipmentItem.quantity || 0), 0);
  const fulfillmentQty = (item.fulfillmentItems || []).reduce((sum, fulfillmentItem) => sum + Number(fulfillmentItem.quantity || 0), 0);
  return Math.max(shipmentQty, fulfillmentQty);
};

const FULFILLMENT_STATUS_LABELS = {
  created: 'Created',
  packed: 'Packed',
  shipped: 'Shipped',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  delivery_failed: 'Delivery Failed',
  rto_initiated: 'RTO Initiated',
  rto_in_transit: 'RTO In Transit',
  rto: 'RTO',
};

const FULFILLMENT_STATUS_TRANSITIONS = {
  created: ['packed'],
  packed: ['shipped'],
  shipped: ['in_transit', 'out_for_delivery'],
  in_transit: ['out_for_delivery'],
  out_for_delivery: ['delivered', 'delivery_failed'],
  delivery_failed: ['out_for_delivery', 'rto_initiated'],
  rto_initiated: ['rto_in_transit'],
  rto_in_transit: ['rto'],
  delivered: [],
  rto: [],
};

const getFulfillmentStatusOptions = (currentStatus) => [
  currentStatus === 'pending' ? 'created' : currentStatus,
  ...(FULFILLMENT_STATUS_TRANSITIONS[currentStatus === 'pending' ? 'created' : currentStatus] || []),
].filter(Boolean);

const FulfillmentDialog = ({ open, onClose, orderItems, onSave, loading }) => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courier, setCourier] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState({});
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState('manual');

  useEffect(() => {
    if (open) {
      const initialItems = {};
      orderItems.forEach(oi => {
        const shipped = getDispatchedQuantity(oi);
        const remaining = oi.quantity - shipped;
        if (remaining > 0) {
          initialItems[oi.id] = remaining;
        }
      });
      setItems(initialItems);
      setTrackingNumber('');
      setCourier('');
      setExpectedDeliveryDate('');
      setNotes('');
      setStatus('created');
      setProviderId('manual');

      getShippingProviders()
        .then(res => {
            const active = res.data.data.filter(p => p.enabled);
            setProviders(active);
        })
        .catch(err => console.error(err));
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
    const finalProviderId = providerId === 'manual' ? null : providerId;
    onSave({
      trackingNumber,
      courier,
      expectedDeliveryDate: expectedDeliveryDate || null,
      notes,
      status,
      providerId: finalProviderId,
      items: shipmentItems,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle component="div">Create Shipment</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mb: 3 }}>
          <TextField
            select
            label="Shipping Provider"
            fullWidth
            size="small"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            <MenuItem value="manual">Manual / Own Delivery</MenuItem>
            {providers.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name} ({p.code})</MenuItem>
            ))}
          </TextField>
          {providerId === 'manual' && (
            <TextField
              label="Carrier / Courier"
              fullWidth
              size="small"
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="e.g. FedEx, BlueDart"
            />
          )}
          <TextField
            label="Tracking Number"
            fullWidth
            size="small"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
          <TextField
            label="Expected Delivery Date"
            type="date"
            fullWidth
            size="small"
            value={expectedDeliveryDate}
            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Shipment Status"
            fullWidth
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <MenuItem value="created">Created</MenuItem>
            <MenuItem value="packed">Packed</MenuItem>
            <MenuItem value="shipped">Shipped</MenuItem>
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
                const shipped = getDispatchedQuantity(oi);
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

const formatDeliveryDate = (value) => {
  if (!value) return 'Not set';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { dateStyle: 'medium' });
};

const ShipmentExpectedDeliveryControl = ({ orderId, shipment, canUpdate, onSaved, notify }) => {
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const history = Array.isArray(shipment?.expectedDeliveryHistory) ? shipment.expectedDeliveryHistory : [];

  const handleSave = async () => {
    if (!date || !shipment?.id) return;
    setSaving(true);
    try {
      const response = await updateShipment(orderId, shipment.id, { expectedDeliveryDate: date });
      onSaved(response.data.data);
      setDate('');
      notify('Expected delivery date added.', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to update expected delivery date.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 180px' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Current expected delivery
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {formatDeliveryDate(shipment?.expectedDeliveryDate)}
          </Typography>
        </Box>
        {canUpdate && (
          <>
            <TextField
              label="Add new expected date"
              type="date"
              size="small"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 190 }}
            />
            <Button size="small" variant="outlined" onClick={handleSave} disabled={saving || !date}>
              {saving ? 'Saving...' : 'Add Date'}
            </Button>
          </>
        )}
      </Box>
      {history.length > 0 && (
        <Stack spacing={0.75} sx={{ mt: 1.5 }}>
          {[...history].reverse().map((entry, idx) => (
            <Box key={`${entry.date}-${entry.at}-${idx}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {entry.at ? new Date(entry.at).toLocaleString() : 'Time pending'}
              </Typography>
              <Typography variant="caption" fontWeight={700}>
                {formatDeliveryDate(entry.date)}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
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
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

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
  const fulfillmentProgress = useMemo(
    () => getFulfillmentProgress(orderItems, order?.fulfillments || []),
    [orderItems, order?.fulfillments]
  );
  const appliedDiscounts = useMemo(
    () => (Array.isArray(order?.appliedDiscounts) ? order.appliedDiscounts : []),
    [order]
  );
  const address = order?.shippingAddressSnapshot;
  const payment = order?.Payment || null;

  const { allowedNextStatuses, isRefundable, isFulfillable } = useOrderStatusTransitions(order?.status);

  const progressSteps = useMemo(
    () => getOrderProgressSteps({ ...(order || {}), Payment: payment }, fulfillmentProgress),
    [fulfillmentProgress, order, payment]
  );

  const customerName = useMemo(() => {
    const fullName = [order?.User?.firstName, order?.User?.lastName].filter(Boolean).join(' ');
    return fullName || address?.fullName || 'Customer unavailable';
  }, [address?.fullName, order?.User?.firstName, order?.User?.lastName]);

  const hasSettledPayment = PAYMENT_SETTLED_STATUSES.includes(payment?.status);
  // TODO: Remove shipmentStatus fallback once all orders are backfilled to orderShippingStatus
  const orderShippingStatus = order?.orderShippingStatus ?? order?.shipmentStatus ?? 'not_shipped';
  const hasTerminalShipping = ['delivered', 'rto'].includes(orderShippingStatus);
  const canCloseOrder = hasSettledPayment && hasTerminalShipping;
  const availableStatuses = useMemo(() => {
    if (!order?.status) return [];
    return [order.status, ...allowedNextStatuses].filter((statusOption) => {
      if (statusOption === 'refunded') return false;
      if (statusOption === 'closed' && !canCloseOrder) return false;
      return true;
    });
  }, [order?.status, allowedNextStatuses, canCloseOrder]);
  const hasStatusTransitions = availableStatuses.length > 1;
  const canRefund = canRefundOrders && isRefundable && hasSettledPayment;
  const canFulfill = canUpdateOrderStatus && isFulfillable;
  const canConfirmCod = canUpdateOrderStatus
    && order?.paymentMethod === 'cod'
    && ['pending_cod', 'pending'].includes(payment?.status || 'pending_cod')
    && orderShippingStatus === 'delivered';

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

  const handleAddNote = async (note) => {
    setAddingNote(true);
    try {
      const res = await addOrderNote(id, note);
      const newEvent = res.data.data;
      // Optimistically append into the local order state so the UI updates
      // immediately without needing a full re-fetch.
      setOrder((prev) => ({
        ...prev,
        history: [newEvent, ...(prev?.history || [])],
      }));
      notify('Note added to order history.', 'success');
      return true;
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to add note.'), 'error');
      return false;
    } finally {
      setAddingNote(false);
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
    const currentStatus = fulfillment?.status === 'pending' ? 'created' : fulfillment?.status;
    if (!fulfillment || currentStatus === status) return;

    const allowedStatuses = getFulfillmentStatusOptions(currentStatus);
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
            <Chip
              label={getShipmentStatusLabel(orderShippingStatus)}
              color={getShipmentStatusColor(orderShippingStatus)}
              variant="outlined"
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Placed on {new Date(order.createdAt).toLocaleString()} • Last updated {new Date(order.updatedAt).toLocaleString()}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Order history">
            <IconButton
              aria-label="Open order history"
              onClick={() => setHistoryDialogOpen(true)}
              sx={{
                width: 40,
                height: 40,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Badge badgeContent={order?.history?.length || 0} color="primary" max={99}>
                <HistoryIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>
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
            <Button variant="contained" color="success" onClick={handleConfirmCodPayment} disabled={updating}>
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

      {order.status === 'closed' && !hasSettledPayment && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          This order was previously marked closed before payment and shipping were complete. It will be reopened automatically when refreshed.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
        <MetricCard label="Order total" value={formatPrice(order.total || 0)} accent="primary.main" />
        <MetricCard label="Items" value={orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} />
        <MetricCard label="Delivered" value={`${fulfillmentProgress.shipped}/${fulfillmentProgress.total}`} />
        <MetricCard label="Customer" value={customerName} />
        <MetricCard
          label="Payment"
          value={getPaymentStatusLabel(payment?.status)}
          accent={hasSettledPayment ? 'success.main' : payment?.status === 'refunded' ? 'text.secondary' : 'text.primary'}
        />
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8} >
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
                    const normalizedShipmentStatus = f.status === 'pending' ? 'created' : f.status;
                    const statusOptions = getFulfillmentStatusOptions(normalizedShipmentStatus);
                    const isTerminalShipment = statusOptions.length <= 1;
                    const shipment = f.shipments?.[0];

                    return (
                    <Paper
                      key={f.id}
                      elevation={0}
                      sx={{
                        p: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Shipment #{index + 1}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">Status:</Typography>
                            <FormControl size="small" variant="standard" sx={{ minWidth: 100 }}>
                              <Select
                                value={normalizedShipmentStatus}
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
                                    {FULFILLMENT_STATUS_LABELS[statusOption] || getShipmentStatusLabel(statusOption)}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="body2" fontWeight={600}>{f.courier || 'Standard Courier'}</Typography>
                          <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>{f.trackingNumber || 'No tracking'}</Typography>
                          {f.shipments && f.shipments.length > 0 && f.shipments[0].trackingUrl && (
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                              <a href={f.shipments[0].trackingUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                                Track Package
                              </a>
                            </Typography>
                          )}
                          {f.shipments && f.shipments.length > 0 && f.shipments[0].labelUrl && (
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                              <a href={f.shipments[0].labelUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                                Download Label
                              </a>
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      {shipment && (
                        <ShipmentExpectedDeliveryControl
                          orderId={id}
                          shipment={shipment}
                          canUpdate={canUpdateOrderStatus}
                          onSaved={setOrder}
                          notify={notify}
                        />
                      )}

                      {f.shipments && f.shipments.length > 0 && Array.isArray(f.shipments[0].statusHistory) && f.shipments[0].statusHistory.length > 0 && (
                        <Box
                          sx={{
                            mt: 2,
                            mb: 3,
                            p: 2,
                            bgcolor: 'action.hover',
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Tracking Timeline</Typography>
                          <Stack spacing={1.5}>
                            {[...f.shipments[0].statusHistory].reverse().map((event, idx) => (
                              <Box key={idx} sx={{ display: 'flex', gap: 2 }}>
                                <Box sx={{ minWidth: 120 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    {new Date(event.timestamp || event.at || event.createdAt).toLocaleString()}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>{event.status}</Typography>
                                  {event.location && <Typography variant="caption" color="text.secondary">{event.location}</Typography>}
                                  {event.message && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{event.message}</Typography>}
                                </Box>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      )}

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
                        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
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
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    component={order.User?.id ? 'button' : 'p'}
                    onClick={order.User?.id ? () => navigate(`/admin/customers/${order.User.id}`) : undefined}
                    sx={{
                      p: 0,
                      border: 0,
                      bgcolor: 'transparent',
                      color: order.User?.id ? 'primary.main' : 'text.primary',
                      cursor: order.User?.id ? 'pointer' : 'default',
                      textAlign: 'left',
                      '&:hover': order.User?.id ? { textDecoration: 'underline' } : undefined,
                    }}
                  >
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

      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            pr: 1,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <HistoryIcon fontSize="small" />
            <Typography variant="h6" fontWeight={700}>
              Order History
            </Typography>
            <Chip label={order?.history?.length || 0} size="small" />
          </Stack>
          <IconButton aria-label="Close order history" onClick={() => setHistoryDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <OrderHistorySection
            history={order?.history || []}
            onAddNote={handleAddNote}
            addingNote={addingNote}
            inDialog
          />
        </DialogContent>
      </Dialog>

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
