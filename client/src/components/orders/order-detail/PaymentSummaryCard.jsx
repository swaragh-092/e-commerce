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
}) => (
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
            : isCod && !paymentSettled
              ? 'Due on delivery'
              : isPendingOnlinePayment
                ? 'Amount due'
                : isCod
                  ? 'Collected'
                  : 'Charged',
          value: formatPrice(payment?.amount || order.total || 0),
          bold: true,
        },
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

export default PaymentSummaryCard;
