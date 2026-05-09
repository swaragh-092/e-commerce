import { Box, Typography } from '@mui/material';

const MetaCard = ({ label, value, sub }) => (
  <Box sx={{ flex: 1, minWidth: 0 }}>
    <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {value}
    </Typography>
    {sub && (
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
        {sub}
      </Typography>
    )}
  </Box>
);

export default MetaCard;
