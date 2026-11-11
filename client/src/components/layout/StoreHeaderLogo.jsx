import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

const normalizeMaxWidth = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return `${value}px`;
  if (typeof value === 'string' && /^\d+(?:\.\d+)?(?:px|rem|em|%)?$/.test(value.trim())) {
    const width = value.trim();
    return /^\d+(?:\.\d+)?$/.test(width) ? `${width}px` : width;
  }
  return '140px';
};

const StoreHeaderLogo = ({ src, name, maxWidth, showName = true }) => {
  const [failed, setFailed] = useState(false);
  const resolvedMaxWidth = normalizeMaxWidth(maxWidth);

  useEffect(() => setFailed(false), [src]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, maxWidth: { xs: showName && src && !failed ? '50vw' : '42vw', sm: '100%' } }}>
      {src && !failed && (
        <Box
          component="img"
          src={src}
          alt={showName ? '' : name}
          onError={() => setFailed(true)}
          sx={(theme) => ({
            maxWidth: { xs: `min(${resolvedMaxWidth}, ${showName ? '24vw' : '32vw'})`, sm: resolvedMaxWidth },
            maxHeight: 36,
            objectFit: 'contain',
            flexShrink: 1,
            [theme.breakpoints.up('md')]: { flexShrink: 0 },
            minWidth: 0,
          })}
        />
      )}
      {(showName || !src || failed) && (
        <Typography variant="h6" fontWeight={700} color="inherit" noWrap sx={{ maxWidth: { xs: `min(180px, ${src && !failed ? '26vw' : '42vw'})`, sm: 180 }, minWidth: 0 }}>
          {name}
        </Typography>
      )}
    </Box>
  );
};

export default StoreHeaderLogo;
