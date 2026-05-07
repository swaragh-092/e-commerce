import { Paper } from '@mui/material';
import MetaCard from './MetaCard';
import { sxCard } from './styles';

const OrderMetaStrip = ({ order, orderItems, trackingProgress, paymentLabel, formatPrice }) => (
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
      sub={trackingProgress ? `${trackingProgress.fulfilledQuantity}/${trackingProgress.totalQuantity} units delivered` : undefined}
    />
    <MetaCard
      label="Payment"
      value={order.paymentMethod || order.Payment?.provider || '—'}
      sub={paymentLabel}
    />
    <MetaCard
      label="Order total"
      value={formatPrice(order.total || 0)}
    />
  </Paper>
);

export default OrderMetaStrip;
