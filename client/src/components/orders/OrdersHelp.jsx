import { Box, Button, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { safeOrdersLink } from '../../utils/ordersDesign';

export default function OrdersHelp({ settings = {} }) {
  if (settings.showSupportInfo !== true) return null;
  return <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
    <Typography variant="subtitle2">{settings.supportTitle || 'Need help with an order?'}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>{settings.supportMessage || 'Open your order details for updates, or contact our team.'}</Typography>
    <Button component={Link} to={safeOrdersLink(settings.supportLink, '/account')} size="small">
      {settings.supportLinkLabel || 'My account'}
    </Button>
  </Box>;
}
