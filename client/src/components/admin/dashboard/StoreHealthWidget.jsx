import { Alert, Box, LinearProgress, Paper, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { getPanelSx } from './dashboardUtils';

const StoreHealthWidget = ({ stats, allSettings, spacing }) => {
  const payments = allSettings?.payments || {};
  const features = allSettings?.features || {};
  const logo = allSettings?.logo || {};
  const enabledGateways = [
    payments.razorpayEnabled,
    payments.stripeEnabled,
    payments.payuEnabled,
    payments.cashfreeEnabled,
    payments.codEnabled,
  ].filter(Boolean).length;

  const checks = [
    { label: 'Payment method enabled', ok: enabledGateways > 0 },
    { label: 'Published products available', ok: Number(stats?.productCount || 0) > 0 },
    { label: 'Inventory healthy', ok: Number(stats?.lowStockCount || 0) === 0 },
    { label: 'Logo configured', ok: Boolean(logo.main) },
    { label: 'Guest checkout configured', ok: features.guestCheckout !== undefined },
  ];
  const healthy = checks.filter((check) => check.ok).length;
  const score = Math.round((healthy / checks.length) * 100);

  return (
    <Paper elevation={0} sx={getPanelSx(spacing)}>
      <Typography variant="h6" fontWeight={600} mb={1}>Store Health</Typography>
      <Typography variant="h4" fontWeight={900}>{score}%</Typography>
      <LinearProgress variant="determinate" value={score} color={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error'} sx={{ my: 2, height: 8, borderRadius: 999 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {checks.map((check) => (
          <Alert
            key={check.label}
            severity={check.ok ? 'success' : 'warning'}
            icon={check.ok ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
            sx={{ py: 0.25, borderRadius: 2 }}
          >
            <Typography variant="caption">{check.label}</Typography>
          </Alert>
        ))}
      </Box>
    </Paper>
  );
};

export default StoreHealthWidget;
