import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import {
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from '../../../utils/orderWorkflow';
import SectionLabel from './SectionLabel';
import { sxCard } from './styles';

const PaymentSummaryCard = ({
  order,
  payment,
  isCod,
  paymentSettled,
  isPendingOnlinePayment,
  canRetryPayment,
  onRetryPayment,
  formatPrice,
}) => {
  const codCollectedAmount = Number(
    payment?.metadata?.codCollectedAmount
    || (isCod && payment?.status !== 'paid_cod' && Number(payment?.amount || 0) < Number(order.total || 0)
      ? payment?.amount
      : 0)
  );
  const codDisplayAmount = isCod && codCollectedAmount > 0
    ? codCollectedAmount
    : Number(payment?.amount || order.total || 0);
  const codDueAmount = Math.max(Number(order.total || 0) - codCollectedAmount, 0);

  return (
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
        {
          label: payment?.status === 'refunded'
            ? 'Refunded'
            : isCod && !paymentSettled && codCollectedAmount > 0
              ? 'Collected'
              : isCod && !paymentSettled
                ? 'Due on delivery'
                : isPendingOnlinePayment
                  ? 'Amount due'
                  : isCod
                    ? 'Collected'
                    : 'Charged',
          value: formatPrice(isCod ? codDisplayAmount : (payment?.amount || order.total || 0)),
          bold: true,
        },
        ...(isCod && codCollectedAmount > 0 && !paymentSettled ? [{
          label: 'Balance due',
          value: formatPrice(codDueAmount),
          bold: true,
        }] : []),
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
        {canRetryPayment && (
          <Button
            variant="contained"
            fullWidth
            onClick={onRetryPayment}
            sx={{ mt: 0.5, fontWeight: 700 }}
          >
            Retry payment
          </Button>
        )}
      </Stack>
    </Paper>
  );
};

export default PaymentSummaryCard;
