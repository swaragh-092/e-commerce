import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import {
  getOrderStatusColor,
} from '../../../utils/orderWorkflow';
import { getCustomerOrderDisplayStatus, getCustomerOrderStatusLabel } from '../../../utils/orderHelpers';
import SectionLabel from './SectionLabel';
import { formatCompactDateTime, formatDateOnly } from './orderDetailUtils';
import { sxCard } from './styles';

const DeliverySummaryCard = ({
  order,
  displayStatus,
  trackingProgress,
  deliveredProducts,
  productCount,
  dispatchedShipments,
  shipmentCount,
  expectedDeliveryDate,
}) => {
  const customerStatus = displayStatus || getCustomerOrderDisplayStatus(order);
  return (
  <Paper elevation={0} sx={sxCard}>
    <SectionLabel icon={TimelineIcon}>Delivery summary</SectionLabel>
    {trackingProgress && (
      <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
        <Typography variant="body2" fontWeight={700}>
          {trackingProgress.percent}% delivered
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {trackingProgress.fulfilledQuantity} delivered, {trackingProgress.remainingQuantity} remaining
        </Typography>
      </Box>
    )}
    <Stack spacing={1.25}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">Order status</Typography>
        <Chip
          size="small"
          label={getCustomerOrderStatusLabel(customerStatus)}
          color={getOrderStatusColor(customerStatus)}
          sx={{ height: 20, fontSize: '0.67rem', fontWeight: 700 }}
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">Products delivered</Typography>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>
          {deliveredProducts}/{productCount}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">Shipments</Typography>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>
          {dispatchedShipments}/{shipmentCount}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">Expected delivery</Typography>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>
          {expectedDeliveryDate ? formatDateOnly(expectedDeliveryDate) : '—'}
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">Last updated</Typography>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>
          {formatCompactDateTime(order.updatedAt) || '—'}
        </Typography>
      </Box>
    </Stack>
  </Paper>
  );
};

export default DeliverySummaryCard;
