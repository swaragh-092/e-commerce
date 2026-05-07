import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import {
  getOrderStatusColor,
  getOrderStatusLabel,
} from '../../../utils/orderWorkflow';
import SectionLabel from './SectionLabel';
import { formatCompactDateTime } from './orderDetailUtils';
import { sxCard } from './styles';

const DeliverySummaryCard = ({
  order,
  trackingProgress,
  deliveredProducts,
  productCount,
  dispatchedShipments,
  shipmentCount,
}) => (
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
          label={getOrderStatusLabel(order.status)}
          color={getOrderStatusColor(order.status)}
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

export default DeliverySummaryCard;
