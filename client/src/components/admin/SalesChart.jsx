import { useState, useEffect } from 'react';
import { Box, Typography, Select, MenuItem, Skeleton, TextField, Button } from '@mui/material';
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
import { useCurrency } from '../../hooks/useSettings';

const fmt = (d) => {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const SalesChart = ({ defaultPeriod = 'monthly' }) => {
  const theme = useTheme();
  const { formatPrice } = useCurrency();
  const [period, setPeriod] = useState(defaultPeriod);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    // Sync the local period state if defaultPeriod prop changes unexpectedly
    setPeriod(defaultPeriod);
    if (defaultPeriod !== 'custom') {
      setStartDate('');
      setEndDate('');
    }
  }, [defaultPeriod]);

  useEffect(() => {
    let cancelled = false;
    if (period === 'custom' && (!startDate || !endDate)) return; // Don't fetch custom without both dates

    setLoading(true);
    getSalesChart({ period, startDate, endDate })
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
  }, [period, startDate, endDate, trigger]);

  const chartData = data.map((r) => ({
    date: fmt(r.date),
    Revenue: r.revenue,
    Orders: r.orderCount,
  }));

  const handleCustomApply = () => {
    if (startDate && endDate) {
      setTrigger((prev) => prev + 1);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Sales Overview
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {period === 'custom' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                type="date"
                size="small"
                label="Start"
                InputLabelProps={{ shrink: true }}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && new Date(e.target.value) > new Date(endDate)) {
                    setEndDate(e.target.value);
                  }
                }}
                inputProps={{ max: endDate || undefined }}
              />
              <TextField
                type="date"
                size="small"
                label="End"
                InputLabelProps={{ shrink: true }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                inputProps={{ min: startDate || undefined }}
              />
              <Button variant="contained" size="small" onClick={handleCustomApply} disabled={!startDate || !endDate}>
                Apply
              </Button>
            </Box>
          )}
          <Select
            size="small"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              if (e.target.value !== 'custom') {
                setStartDate('');
                setEndDate('');
              }
            }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="daily">Daily (90 days)</MenuItem>
            <MenuItem value="weekly">Weekly (52 wks)</MenuItem>
            <MenuItem value="monthly">Monthly (12 mo)</MenuItem>
            <MenuItem value="quarterly">Quarterly</MenuItem>
            <MenuItem value="yearly">Yearly</MenuItem>
            <MenuItem value="mtd">Month to Date</MenuItem>
            <MenuItem value="ytd">Year to Date</MenuItem>
            <MenuItem value="custom">Custom Range</MenuItem>
          </Select>
        </Box>
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
                name === 'Revenue' ? [formatPrice(val), name] : [val, name]
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
