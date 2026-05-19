import { memo } from 'react';
import { Box, Typography } from '@mui/material';

const SectionLabel = memo(({ icon: Icon, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
    {Icon && <Icon sx={{ fontSize: 15, color: 'text.disabled' }} />}
    <Typography
      sx={{
        fontWeight: 700,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: 'text.disabled',
        fontSize: '0.67rem',
      }}
    >
      {children}
    </Typography>
  </Box>
));

export default SectionLabel;
