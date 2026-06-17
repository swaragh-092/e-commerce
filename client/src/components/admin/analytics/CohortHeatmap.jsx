import { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatCohortLabel = (dateStr) => {
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const CohortHeatmap = ({ data = [] }) => {
  const theme = useTheme();

  const { months, matrix } = useMemo(() => {
    if (!data.length) return { months: [], matrix: [] };

    // Find max number of months
    let maxMonths = 0;
    data.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k.startsWith('month')) {
          const idx = parseInt(k.replace('month', ''), 10);
          if (idx > maxMonths) maxMonths = idx;
        }
      });
    });

    const monthCols = Array.from({ length: maxMonths + 1 }, (_, i) => `month${i}`);
    return { months: monthCols, matrix: data };
  }, [data]);

  if (!data.length) return null;

  const getColor = (value) => {
    if (value === undefined || value === null) return theme.palette.grey[100];
    const alpha = Math.min(value / 100, 1);
    if (alpha > 0.6) return theme.palette.success.dark;
    if (alpha > 0.4) return theme.palette.success.main;
    if (alpha > 0.2) return theme.palette.success.light;
    if (alpha > 0) return theme.palette.success.light + '80';
    return theme.palette.grey[100];
  };

  const getTextColor = (value) => {
    if (value === undefined || value === null) return theme.palette.text.disabled;
    return value > 50 ? '#fff' : theme.palette.text.primary;
  };

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'inline-grid', gridTemplateColumns: `120px repeat(${months.length}, 52px)`, gap: '2px', minWidth: 'fit-content' }}>
        {/* Header row */}
        <Box sx={{ p: 0.5, fontWeight: 600, fontSize: 11, color: 'text.secondary' }}>Cohort</Box>
        <Box sx={{ p: 0.5, fontWeight: 600, fontSize: 11, color: 'text.secondary', textAlign: 'center' }}>Size</Box>
        {months.map((m, i) => (
          <Box key={m} sx={{ p: 0.5, fontWeight: 600, fontSize: 11, color: 'text.secondary', textAlign: 'center' }}>M{i}</Box>
        ))}

        {/* Data rows */}
        {matrix.map((row) => (
          <>
            <Box key={`label-${row.cohort}`} sx={{ p: 0.5, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center' }}>
              {formatCohortLabel(row.cohort)}
            </Box>
            <Box key={`size-${row.cohort}`} sx={{ p: 0.5, fontSize: 12, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
              {row.size}
            </Box>
            {months.map((m) => {
              const val = row[m];
              return (
                <Tooltip key={`${row.cohort}-${m}`} title={val != null ? `${val}% retained` : 'No data'} arrow>
                  <Box
                    sx={{
                      p: 0.5,
                      fontSize: 11,
                      textAlign: 'center',
                      bgcolor: getColor(val),
                      color: getTextColor(val),
                      borderRadius: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 28,
                      cursor: 'default',
                    }}
                  >
                    {val != null ? `${val}` : '—'}
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

export default CohortHeatmap;
