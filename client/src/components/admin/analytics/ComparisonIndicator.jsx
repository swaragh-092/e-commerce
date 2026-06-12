import { Box, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

const ComparisonIndicator = ({ change, format = 'number', size = 'small' }) => {
  if (change === null || change === undefined) return null;

  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;
  const color = isPositive ? 'success.main' : isNegative ? 'error.main' : 'text.secondary';
  const Icon = isPositive ? TrendingUpIcon : isNegative ? TrendingDownIcon : TrendingFlatIcon;
  const fontSize = size === 'small' ? 12 : 14;

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, ml: 0.5 }}>
      <Icon sx={{ fontSize, color }} />
      <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize }}>
        {isPositive ? '+' : ''}{change}%
      </Typography>
    </Box>
  );
};

export default ComparisonIndicator;
