import { Paper, Stack, Typography } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SectionLabel from './SectionLabel';
import { sxCard } from './styles';

const ShippingAddressCard = ({ address }) => (
  <Paper elevation={0} sx={sxCard}>
    <SectionLabel icon={LocalShippingIcon}>Shipping address</SectionLabel>
    {address ? (
      <Stack spacing={0.4}>
        {[
          { text: address.fullName, primary: true },
          { text: address.addressLine1 },
          { text: address.addressLine2 },
          { text: [address.city, address.state, address.postalCode].filter(Boolean).join(', ') },
          { text: address.country },
          { text: address.phone },
        ]
          .filter(l => l.text)
          .map(({ text, primary }, i) => (
            <Typography
              key={i}
              variant="body2"
              color={primary ? 'text.primary' : 'text.secondary'}
              sx={{ fontWeight: primary ? 700 : 400 }}
            >
              {text}
            </Typography>
          ))}
      </Stack>
    ) : (
      <Typography variant="body2" color="text.secondary">
        No shipping address snapshot available.
      </Typography>
    )}
  </Paper>
);

export default ShippingAddressCard;
