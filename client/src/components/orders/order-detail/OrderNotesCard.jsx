import { Paper, Typography } from '@mui/material';
import SectionLabel from './SectionLabel';
import { sxCard } from './styles';

const OrderNotesCard = ({ notes }) => (
  <Paper elevation={0} sx={sxCard}>
    <SectionLabel>Order notes</SectionLabel>
    <Typography variant="body2" color="text.secondary">{notes}</Typography>
  </Paper>
);

export default OrderNotesCard;
