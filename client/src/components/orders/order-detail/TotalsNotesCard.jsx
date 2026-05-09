import { Paper, Tab, Tabs, Typography } from '@mui/material';
import TotalsPanel from './TotalsPanel';
import { sxCard } from './styles';

const TotalsNotesCard = ({
  activeTab,
  onTabChange,
  order,
  appliedDiscounts,
  formatPrice,
}) => (
  <Paper elevation={0} sx={sxCard}>
    <Tabs
      value={activeTab}
      onChange={(_, v) => onTabChange(v)}
      sx={{
        mb: 2.5,
        minHeight: 36,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '& .MuiTabs-indicator': { height: 2, borderRadius: 1 },
        '& .MuiTab-root': {
          fontWeight: 600,
          fontSize: '0.8rem',
          textTransform: 'none',
          minHeight: 36,
          px: 2,
          py: 0,
          color: 'text.secondary',
          '&.Mui-selected': { color: 'text.primary' },
        },
      }}
    >
      <Tab label="Totals & discounts" />
      <Tab label="Notes" />
    </Tabs>

    {activeTab === 0 && (
      <TotalsPanel order={order} appliedDiscounts={appliedDiscounts} formatPrice={formatPrice} />
    )}
    {activeTab === 1 && (
      order.notes
        ? <Typography variant="body2" color="text.secondary">{order.notes}</Typography>
        : <Typography variant="body2" color="text.secondary">No notes on this order.</Typography>
    )}
  </Paper>
);

export default TotalsNotesCard;
