import { Box, Chip, Divider, Typography } from '@mui/material';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import AppliedDiscountsSummary from '../AppliedDiscountsSummary';
import { getTaxRows } from './orderDetailUtils';

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

export default TotalsPanel;
