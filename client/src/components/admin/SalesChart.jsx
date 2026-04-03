import { useState, useEffect } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, Skeleton } from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getSalesChart } from '../../services/adminService';
import { useTheme } from '@mui/material/styles';

const fmt = (d) => {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const SalesChart = () => {
  const theme = useTheme();
  const [period, setPeriod] = useState('monthly');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSalesChart(period)
      .then((res) => {
        if (!cancelled) setData(res.data.data || []);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const chartData = data.map((r) => ({
    date: fmt(r.date),
    Revenue: r.revenue,
    Orders: r.orderCount,
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Sales Overview
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={period}
          onChange={(_, v) => v && setPeriod(v)}
        >
          <ToggleButton value="daily">Daily</ToggleButton>
          <ToggleButton value="weekly">Weekly</ToggleButton>
          <ToggleButton value="monthly">Monthly</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 2 }} />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(val, name) =>
                name === 'Revenue' ? [`$${val.toFixed(2)}`, name] : [val, name]
              }
            />
            <Area
              type="monotone"
              dataKey="Revenue"
              stroke={theme.palette.primary.main}
              fill="url(#colorRev)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
};

export default SalesChart;
