import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Select, MenuItem, Skeleton, Alert, Button,
  Table, TableBody, TableCell, TableHead, TableRow, Chip,
} from '@mui/material';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { useCurrency } from '../../hooks/useSettings';
import {
  getTopProducts, getAovTrend, getAbandonedCarts,
  getRevenueByCategory, getRepeatCustomers, getRefundRate,
} from '../../services/adminService';

const PERIODS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12m', label: 'Last 12 months' },
];

const TREND_PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const PIE_COLORS = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#795548', '#607d8b', '#e91e63', '#3f51b5'];

const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const CardSkeleton = () => <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />;

const AnalyticsPage = () => {
  const theme = useTheme();
  const { formatPrice } = useCurrency();
  const [period, setPeriod] = useState('30d');
  const [trendPeriod, setTrendPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({});

  const fetchAll = () => {
    setLoading(true);
    setError('');
    Promise.allSettled([
      getTopProducts({ period, limit: 10, sortBy: 'revenue' }),
      getAovTrend({ period: trendPeriod }),
      getAbandonedCarts({ period }),
      getRevenueByCategory({ period, limit: 10 }),
      getRepeatCustomers({ period }),
      getRefundRate({ period: trendPeriod }),
    ]).then(([tp, aov, ac, rc, rep, ref]) => {
      setData({
        topProducts: tp.status === 'fulfilled' ? tp.value.data.data : [],
        aovTrend: aov.status === 'fulfilled' ? aov.value.data.data : [],
        abandonedCarts: ac.status === 'fulfilled' ? ac.value.data.data : null,
        revenueByCategory: rc.status === 'fulfilled' ? rc.value.data.data : [],
        repeatCustomers: rep.status === 'fulfilled' ? rep.value.data.data : null,
        refundRate: ref.status === 'fulfilled' ? ref.value.data.data : [],
      });
      const allFailed = [tp, aov, ac, rc, rep, ref].every(r => r.status === 'rejected');
      if (allFailed) setError('Failed to load analytics data.');
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [period, trendPeriod]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" fontWeight={700}>Analytics</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Select size="small" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ minWidth: 140 }}>
            {PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </Select>
          <Select size="small" value={trendPeriod} onChange={(e) => setTrendPeriod(e.target.value)} sx={{ minWidth: 120 }}>
            {TREND_PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </Select>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={fetchAll}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Top Products */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <Typography variant="h6" fontWeight={600} mb={2}>Top Selling Products</Typography>
            {loading ? <CardSkeleton /> : (
              data.topProducts?.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.topProducts.slice(0, 5)} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip formatter={(v) => formatPrice(v)} />
                      <Bar dataKey="revenue" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table size="small" sx={{ mt: 2 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.topProducts.map((p, i) => (
                        <TableRow key={p.productId || i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{p.name}</TableCell>
                          <TableCell align="right">{formatPrice(p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <Typography color="text.secondary">No sales data for this period.</Typography>
            )}
          </Paper>
        </Grid>

        {/* AOV Trend */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <Typography variant="h6" fontWeight={600} mb={2}>Average Order Value</Typography>
            {loading ? <CardSkeleton /> : (
              data.aovTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.aovTrend.map(r => ({ ...r, date: fmt(r.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, name) => name === 'aov' ? [formatPrice(v), 'AOV'] : [v, 'Orders']} />
                    <Legend />
                    <Line type="monotone" dataKey="aov" stroke={theme.palette.primary.main} strokeWidth={2} name="AOV" dot={false} />
                    <Line type="monotone" dataKey="orderCount" stroke={theme.palette.success.main} strokeWidth={1} name="Orders" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <Typography color="text.secondary">No order data for this period.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Abandoned Carts */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <Typography variant="h6" fontWeight={600} mb={2}>Cart Abandonment</Typography>
            {loading ? <CardSkeleton /> : (
              data.abandonedCarts && data.abandonedCarts.total > 0 ? (
                <Box sx={{ textAlign: 'center' }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Converted', value: data.abandonedCarts.converted },
                          { name: 'Abandoned', value: data.abandonedCarts.abandoned },
                        ]}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value"
                      >
                        <Cell fill={theme.palette.success.main} />
                        <Cell fill={theme.palette.error.main} />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <Chip
                    label={`${data.abandonedCarts.rate}% abandonment rate`}
                    color={data.abandonedCarts.rate > 70 ? 'error' : data.abandonedCarts.rate > 50 ? 'warning' : 'success'}
                    sx={{ mt: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {data.abandonedCarts.total} carts total • {data.abandonedCarts.converted} converted
                  </Typography>
                </Box>
              ) : <Typography color="text.secondary">No cart data for this period.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Revenue by Category */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <Typography variant="h6" fontWeight={600} mb={2}>Revenue by Category</Typography>
            {loading ? <CardSkeleton /> : (
              data.revenueByCategory?.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.revenueByCategory}
                      cx="50%" cy="50%" outerRadius={90} dataKey="revenue" nameKey="category" label={({ category }) => category}
                    >
                      {data.revenueByCategory.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatPrice(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Typography color="text.secondary">No category revenue data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Repeat Customers */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <Typography variant="h6" fontWeight={600} mb={2}>Customer Retention</Typography>
            {loading ? <CardSkeleton /> : (
              data.repeatCustomers && data.repeatCustomers.total > 0 ? (
                <Box sx={{ textAlign: 'center' }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Repeat', value: data.repeatCustomers.repeat },
                          { name: 'One-time', value: data.repeatCustomers.oneTime },
                        ]}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value"
                      >
                        <Cell fill={theme.palette.primary.main} />
                        <Cell fill={theme.palette.grey[400]} />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <Chip
                    label={`${data.repeatCustomers.rate}% repeat rate`}
                    color={data.repeatCustomers.rate > 30 ? 'success' : data.repeatCustomers.rate > 15 ? 'warning' : 'error'}
                    sx={{ mt: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {data.repeatCustomers.total} unique customers
                  </Typography>
                </Box>
              ) : <Typography color="text.secondary">No customer data for this period.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Refund Rate */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <Typography variant="h6" fontWeight={600} mb={2}>Refund Trend</Typography>
            {loading ? <CardSkeleton /> : (
              data.refundRate?.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.refundRate.map(r => ({ ...r, date: fmt(r.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(v, name) => name === 'Refund Amount' ? formatPrice(v) : `${v}%`} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="refundAmount" stroke={theme.palette.error.main} strokeWidth={2} name="Refund Amount" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="rate" stroke={theme.palette.warning.main} strokeWidth={2} name="Refund Rate %" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <Typography color="text.secondary">No refund data for this period.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsPage;
