import { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const OrderHeatmap = ({ data = [] }) => {
  const theme = useTheme();

  const { grid, maxVal } = useMemo(() => {
    const g = {};
    let max = 0;
    data.forEach((r) => {
      const key = `${r.day}-${r.hour}`;
      g[key] = r.orders;
      if (r.orders > max) max = r.orders;
    });
    return { grid: g, maxVal: max };
  }, [data]);

  if (!data.length) return null;

  const getColor = (value) => {
    if (!value) return theme.palette.grey[100];
    const alpha = Math.max(0.15, value / maxVal);
    return `rgba(${theme.palette.primary.main.replace(/[^\d,]/g, '')}, ${alpha})`;
  };

  const getTextColor = (value) => {
    if (!value) return theme.palette.text.disabled;
    return value / maxVal > 0.5 ? '#fff' : theme.palette.text.primary;
  };

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'inline-grid', gridTemplateColumns: `48px repeat(24, 36px)`, gap: '2px', minWidth: 'fit-content' }}>
        {/* Header */}
        <Box />
        {HOURS.map((h) => (
          <Box key={h} sx={{ fontSize: 10, textAlign: 'center', color: 'text.secondary', p: 0.25 }}>
            {h.toString().padStart(2, '0')}
          </Box>
        ))}

        {/* Rows */}
        {DAY_LABELS.map((day, dayIdx) => (
          <>
            <Box key={`day-${dayIdx}`} sx={{ fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', pr: 0.5 }}>
              {day}
            </Box>
            {HOURS.map((hour) => {
              const val = grid[`${dayIdx}-${hour}`] || 0;
              return (
                <Tooltip key={`${dayIdx}-${hour}`} title={`${DAY_LABELS[dayIdx]} ${hour}:00 — ${val} orders`} arrow>
                  <Box
                    sx={{
                      bgcolor: getColor(val),
                      color: getTextColor(val),
                      borderRadius: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      height: 28,
                      cursor: 'default',
                    }}
                  >
                    {val || ''}
                  </Box>
                </Tooltip>
              );
            })}
          </>
        ))}
      </Box>
    </Box>
  );
};

export default OrderHeatmap;
