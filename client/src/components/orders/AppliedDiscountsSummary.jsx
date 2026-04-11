import { Alert, Box, Chip, Stack, Typography } from '@mui/material';

const AppliedDiscountsSummary = ({ discounts = [], formatPrice, compact = false, showEmpty = false }) => {
  const appliedDiscounts = Array.isArray(discounts) ? discounts.filter(Boolean) : [];

  if (appliedDiscounts.length === 0) {
    if (!showEmpty) return null;
    return (
      <Typography variant={compact ? 'caption' : 'body2'} color="text.secondary">
        No promotions were applied to this order.
      </Typography>
    );
  }

  const totalSavings = appliedDiscounts.reduce(
    (sum, discount) => sum + Number(discount?.totalDiscount || 0),
    0
  );

  if (compact) {
    return (
      <Box>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 0.75 }}>
          {appliedDiscounts.map((discount) => (
            <Chip
              key={`${discount.code}-${discount.couponId || 'discount'}`}
              size="small"
              color={discount.applicationMode === 'auto' ? 'info' : 'success'}
              variant="outlined"
              label={`${discount.code}${discount.applicationMode === 'auto' ? ' · auto' : ''} · -${formatPrice(discount.totalDiscount || 0)}`}
            />
          ))}
        </Stack>
        <Typography variant="caption" color="success.main">
          Total promo savings: {formatPrice(totalSavings)}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Alert severity="success" sx={{ mb: 2 }}>
        {appliedDiscounts.length === 1
          ? '1 promotion applied to this order.'
          : `${appliedDiscounts.length} promotions applied to this order.`}
      </Alert>
      <Stack spacing={1}>
        {appliedDiscounts.map((discount) => (
          <Box
            key={`${discount.code}-${discount.couponId || 'discount'}`}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              alignItems: 'flex-start',
            }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                <Typography variant="body2" fontWeight={600}>
                  {discount.name || discount.code}
                </Typography>
                <Chip label={discount.code} size="small" variant="outlined" />
                {discount.applicationMode === 'auto' && (
                  <Chip label="Auto applied" size="small" color="info" />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {discount.shippingDiscount > 0 && discount.orderDiscount > 0
                  ? 'Order + shipping promotion'
                  : discount.shippingDiscount > 0
                    ? 'Shipping promotion'
                    : 'Order promotion'}
              </Typography>
            </Box>
            <Box textAlign="right">
              {Number(discount.orderDiscount || 0) > 0 && (
                <Typography variant="body2" color="success.main">
                  -{formatPrice(discount.orderDiscount || 0)} order
                </Typography>
              )}
              {Number(discount.shippingDiscount || 0) > 0 && (
                <Typography variant="body2" color="success.main">
                  -{formatPrice(discount.shippingDiscount || 0)} shipping
                </Typography>
              )}
              <Typography variant="caption" color="success.main">
                Total: -{formatPrice(discount.totalDiscount || 0)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default AppliedDiscountsSummary;
