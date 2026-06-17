import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, Select, MenuItem, Skeleton, Alert, Button,
  Table, TableBody, TableCell, TableHead, TableRow, Chip, IconButton, Tooltip,
  Switch, FormControlLabel, CircularProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { useCurrency } from '../../hooks/useSettings';
import {
  getTopProducts, getAovTrend, getAbandonedCarts,
  getRevenueByCategory, getRepeatCustomers, getRefundRate,
  getGeographicSales, getRevenueByPaymentMethod, getCustomerLifetimeValue,
  getConversionRate, getTrafficSources, getProductFunnel, getUtmAttribution,
  getCouponPerformance, exportAnalyticsCsv,
  getCohortRetention, getRfmSegmentation, getOrderHeatmap, getRevenueForecast,
} from '../../services/adminService';
import ComparisonIndicator from '../../components/admin/analytics/ComparisonIndicator';
import CohortHeatmap from '../../components/admin/analytics/CohortHeatmap';
import OrderHeatmap from '../../components/admin/analytics/OrderHeatmap';
import DrillDownDialog from '../../components/admin/analytics/DrillDownDialog';

const PERIODS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
];
const TREND_PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];
const PIE_COLORS = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#795548', '#607d8b', '#e91e63', '#3f51b5'];
const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const CardSkeleton = () => <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />;

const ExportBtn = ({ metric, params }) => (
  <Tooltip title="Export CSV">
    <IconButton size="small" onClick={() => exportAnalyticsCsv(metric, params)}>
      <DownloadIcon fontSize="small" />
    </IconButton>
  </Tooltip>
);

const SectionHeader = ({ title, metric, params }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
    <Typography variant="h6" fontWeight={600}>{title}</Typography>
    <ExportBtn metric={metric} params={params} />
  </Box>
);

const AnalyticsPage = () => {
  const theme = useTheme();
  const { formatPrice } = useCurrency();
  const pageRef = useRef(null);
  const [period, setPeriod] = useState('30d');
  const [trendPeriod, setTrendPeriod] = useState('monthly');
  const [compare, setCompare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({});
  const [comparison, setComparison] = useState({});
  const [drillDown, setDrillDown] = useState({ open: false, metric: null, filterValue: null, label: null });

  const handleExportPdf = async () => {
    if (!pageRef.current) return;
    setPdfLoading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(pageRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        windowWidth: 1200,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position -= pdf.internal.pageSize.getHeight();
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`analytics-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const qp = { period, ...(compare ? { compare: true } : {}) };
  const tp = { period: trendPeriod, ...(compare ? { compare: true } : {}) };

  const normalizeResult = (result, isCompare) => {
    if (!isCompare) return { current: result, previous: null, changes: null };
    if (result?.current) return result;
    return { current: result, previous: null, changes: null };
  };

  const fetchAll = () => {
    setLoading(true);
    setError('');
    Promise.allSettled([
      getTopProducts({ ...qp, limit: 10, sortBy: 'revenue' }),
      getAovTrend(tp),
      getAbandonedCarts(qp),
      getRevenueByCategory({ ...qp, limit: 10 }),
      getRepeatCustomers(qp),
      getRefundRate(tp),
      getGeographicSales({ ...qp, limit: 20 }),
      getRevenueByPaymentMethod(qp),
      getCustomerLifetimeValue({ ...qp, limit: 10 }),
      getConversionRate(qp),
      getTrafficSources({ ...qp, limit: 10 }),
      getProductFunnel({ ...qp, limit: 10 }),
      getUtmAttribution({ ...qp, limit: 20 }),
      getCouponPerformance({ ...qp, limit: 10 }),
      getCohortRetention({ period }),
      getRfmSegmentation({ period }),
      getOrderHeatmap(qp),
      getRevenueForecast({ period }),
    ]).then((results) => {
      const d = (i) => results[i].status === 'fulfilled' ? results[i].value.data.data : null;
      const raw = {
        topProducts: d(0),
        aovTrend: d(1),
        abandonedCarts: d(2),
        revenueByCategory: d(3),
        repeatCustomers: d(4),
        refundRate: d(5),
        geographicSales: d(6),
        paymentMethods: d(7),
        clv: d(8),
        conversionRate: d(9),
        trafficSources: d(10),
        productFunnel: d(11),
        utmAttribution: d(12),
        couponPerformance: d(13),
        cohortRetention: d(14),
        rfmSegmentation: d(15),
        orderHeatmap: d(16),
        revenueForecast: d(17),
      };

      if (compare) {
        const curr = {};
        const comp = {};
        for (const [key, val] of Object.entries(raw)) {
          const norm = normalizeResult(val, true);
          curr[key] = norm.current ?? (Array.isArray(val) ? [] : null);
          comp[key] = norm;
        }
        setData(curr);
        setComparison(comp);
      } else {
        const curr = {};
        for (const [key, val] of Object.entries(raw)) {
          curr[key] = val ?? (Array.isArray(val) ? [] : null);
        }
        setData(curr);
        setComparison({});
      }

      if (results.every(r => r.status === 'rejected')) setError('Failed to load analytics data.');
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [period, trendPeriod, compare]);

  return (
    <Box ref={pageRef}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" fontWeight={700}>Analytics</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControlLabel
            control={<Switch size="small" checked={compare} onChange={(e) => setCompare(e.target.checked)} />}
            label={<Typography variant="body2">Compare</Typography>}
            sx={{ mr: 1 }}
          />
          <Tooltip title="Export as PDF">
            <span>
              <IconButton onClick={handleExportPdf} disabled={pdfLoading || loading}>
                {pdfLoading ? <CircularProgress size={20} /> : <PictureAsPdfIcon />}
              </IconButton>
            </span>
          </Tooltip>
          <Select size="small" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ minWidth: 120 }}>
            {PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </Select>
          <Select size="small" value={trendPeriod} onChange={(e) => setTrendPeriod(e.target.value)} sx={{ minWidth: 110 }}>
            {TREND_PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </Select>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={fetchAll}>Retry</Button>}>{error}</Alert>}

      {/* Conversion Rate Banner */}
      {!loading && data.conversionRate && (
        <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }} elevation={0}>
          <Box>
            <Typography variant="body2" color="text.secondary">Visits</Typography>
            <Typography variant="h5" fontWeight={700}>{data.conversionRate.visits?.toLocaleString()}
              {compare && comparison.conversionRate?.changes?.visits != null && <ComparisonIndicator change={comparison.conversionRate.changes.visits} />}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Orders</Typography>
            <Typography variant="h5" fontWeight={700}>{data.conversionRate.orders?.toLocaleString()}
              {compare && comparison.conversionRate?.changes?.orders != null && <ComparisonIndicator change={comparison.conversionRate.changes.orders} />}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Conversion</Typography>
            <Typography variant="h5" fontWeight={700} color="primary.main">{data.conversionRate.rate}%
              {compare && comparison.conversionRate?.changes?.rate != null && <ComparisonIndicator change={comparison.conversionRate.changes.rate} />}
            </Typography>
          </Box>
          {data.conversionRate.message && <Typography variant="caption" color="text.secondary">{data.conversionRate.message}</Typography>}
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Product Funnel */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Product Funnel (Views → Cart → Purchase)" metric="product-funnel" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.productFunnel?.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Views</TableCell>
                      <TableCell align="right">Add to Cart</TableCell>
                      <TableCell align="right">Purchased</TableCell>
                      <TableCell align="right">View→Cart</TableCell>
                      <TableCell align="right">Cart→Buy</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.productFunnel.map((r) => (
                      <TableRow key={r.productId}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell align="right">{r.views}</TableCell>
                        <TableCell align="right">{r.addToCart}</TableCell>
                        <TableCell align="right">{r.purchased}</TableCell>
                        <TableCell align="right"><Chip size="small" label={`${r.viewToCartRate}%`} color={r.viewToCartRate > 10 ? 'success' : 'default'} /></TableCell>
                        <TableCell align="right"><Chip size="small" label={`${r.cartToBuyRate}%`} color={r.cartToBuyRate > 30 ? 'success' : 'default'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No funnel data yet. Appears after product page visits are tracked.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Top Products */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Top Selling Products" metric="top-products" params={{ ...qp, sortBy: 'revenue' }} />
            {loading ? <CardSkeleton /> : (
              data.topProducts?.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.topProducts.slice(0, 5)} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <RTooltip formatter={(v) => formatPrice(v)} />
                      <Bar dataKey="revenue" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table size="small" sx={{ mt: 1 }}>
                    <TableHead><TableRow><TableCell>#</TableCell><TableCell>Product</TableCell><TableCell align="right">Revenue</TableCell></TableRow></TableHead>
                    <TableBody>
                      {data.topProducts.map((p, i) => (
                        <TableRow key={p.productId || i} hover sx={{ cursor: 'pointer' }} onClick={() => setDrillDown({ open: true, metric: 'product', filterValue: p.productId, label: p.name })}><TableCell>{i + 1}</TableCell><TableCell>{p.name}</TableCell><TableCell align="right">{formatPrice(p.revenue)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <Typography color="text.secondary">No sales data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* AOV Trend */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Average Order Value" metric="aov-trend" params={tp} />
            {loading ? <CardSkeleton /> : (
              data.aovTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.aovTrend.map(r => ({ ...r, date: fmt(r.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip formatter={(v, name) => name === 'AOV' ? [formatPrice(v), 'AOV'] : [v, 'Orders']} />
                    <Legend />
                    <Line type="monotone" dataKey="aov" stroke={theme.palette.primary.main} strokeWidth={2} name="AOV" dot={false} />
                    <Line type="monotone" dataKey="orderCount" stroke={theme.palette.success.main} strokeWidth={1} name="Orders" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <Typography color="text.secondary">No data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* UTM Attribution */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Marketing Attribution (UTM)" metric="utm-attribution" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.utmAttribution?.length > 0 ? (
                <Table size="small">
                  <TableHead><TableRow><TableCell>Source</TableCell><TableCell>Medium</TableCell><TableCell>Campaign</TableCell><TableCell align="right">Orders</TableCell><TableCell align="right">Revenue</TableCell></TableRow></TableHead>
                  <TableBody>
                    {data.utmAttribution.map((r, i) => (
                      <TableRow key={i}><TableCell>{r.source}</TableCell><TableCell>{r.medium || '—'}</TableCell><TableCell>{r.campaign || '—'}</TableCell><TableCell align="right">{r.orders}</TableCell><TableCell align="right">{formatPrice(r.revenue)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No UTM data yet. Share links with ?utm_source=... to track campaigns.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Coupon Performance */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Coupon Performance" metric="coupon-performance" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.couponPerformance?.length > 0 ? (
                <Table size="small">
                  <TableHead><TableRow><TableCell>Code</TableCell><TableCell align="right">Used</TableCell><TableCell align="right">Revenue</TableCell><TableCell align="right">Discount Given</TableCell><TableCell align="right">Avg Discount</TableCell></TableRow></TableHead>
                  <TableBody>
                    {data.couponPerformance.map((c) => (
                      <TableRow key={c.couponId}><TableCell><Chip label={c.code} size="small" /></TableCell><TableCell align="right">{c.timesUsed}</TableCell><TableCell align="right">{formatPrice(c.revenueGenerated)}</TableCell><TableCell align="right">{formatPrice(c.totalDiscountGiven)}</TableCell><TableCell align="right">{formatPrice(c.avgDiscount)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No coupon usage data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Revenue by Payment */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Revenue by Payment" metric="revenue-by-payment" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.paymentMethods?.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={data.paymentMethods} cx="50%" cy="50%" outerRadius={80} dataKey="revenue" nameKey="method" label={({ method }) => method}>
                      {data.paymentMethods.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RTooltip formatter={(v) => formatPrice(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Typography color="text.secondary">No data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Abandoned Carts */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Cart Abandonment" metric="abandoned-carts" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.abandonedCarts?.total > 0 ? (
                <Box sx={{ textAlign: 'center' }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={[{ name: 'Converted', value: data.abandonedCarts.converted }, { name: 'Abandoned', value: data.abandonedCarts.abandoned }]} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                        <Cell fill={theme.palette.success.main} /><Cell fill={theme.palette.error.main} />
                      </Pie>
                      <RTooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <Chip label={`${data.abandonedCarts.rate}% abandoned`} color={data.abandonedCarts.rate > 70 ? 'error' : 'warning'} sx={{ mt: 1 }} />
                  {compare && comparison.abandonedCarts?.changes?.rate != null && <ComparisonIndicator change={comparison.abandonedCarts.changes.rate} />}
                </Box>
              ) : <Typography color="text.secondary">No cart data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Repeat Customers */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Customer Retention" metric="repeat-customers" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.repeatCustomers?.total > 0 ? (
                <Box sx={{ textAlign: 'center' }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={[{ name: 'Repeat', value: data.repeatCustomers.repeat }, { name: 'One-time', value: data.repeatCustomers.oneTime }]} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                        <Cell fill={theme.palette.primary.main} /><Cell fill={theme.palette.grey[400]} />
                      </Pie>
                      <RTooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <Chip label={`${data.repeatCustomers.rate}% repeat`} color={data.repeatCustomers.rate > 30 ? 'success' : 'warning'} sx={{ mt: 1 }} />
                  {compare && comparison.repeatCustomers?.changes?.rate != null && <ComparisonIndicator change={comparison.repeatCustomers.changes.rate} />}
                </Box>
              ) : <Typography color="text.secondary">No data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Revenue by Category */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Revenue by Category" metric="revenue-by-category" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.revenueByCategory?.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={data.revenueByCategory} cx="50%" cy="50%" outerRadius={90} dataKey="revenue" nameKey="category" label={({ category }) => category}>
                      {data.revenueByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RTooltip formatter={(v) => formatPrice(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Typography color="text.secondary">No data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Traffic Sources */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Traffic Sources" metric="traffic-sources" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.trafficSources?.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.trafficSources}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Bar dataKey="visits" fill={theme.palette.info.main} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Typography color="text.secondary">No traffic data yet.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Geographic Sales */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Geographic Sales" metric="geographic-sales" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.geographicSales?.length > 0 ? (
                <Table size="small">
                  <TableHead><TableRow><TableCell>State</TableCell><TableCell>City</TableCell><TableCell align="right">Orders</TableCell><TableCell align="right">Revenue</TableCell></TableRow></TableHead>
                  <TableBody>
                    {data.geographicSales.map((r, i) => (
                      <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => setDrillDown({ open: true, metric: 'geographic-sales', filterValue: r.state, label: `${r.state} — ${r.city}` })}><TableCell>{r.state}</TableCell><TableCell>{r.city}</TableCell><TableCell align="right">{r.orders}</TableCell><TableCell align="right">{formatPrice(r.revenue)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No geographic data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* CLV */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Customer Lifetime Value (Top 10)" metric="customer-lifetime-value" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.clv?.length > 0 ? (
                <Table size="small">
                  <TableHead><TableRow><TableCell>Customer</TableCell><TableCell align="right">Orders</TableCell><TableCell align="right">LTV</TableCell></TableRow></TableHead>
                  <TableBody>
                    {data.clv.map((c) => (
                      <TableRow key={c.id}><TableCell><Typography variant="body2" fontWeight={500}>{c.name}</Typography><Typography variant="caption" color="text.secondary">{c.email}</Typography></TableCell><TableCell align="right">{c.orders}</TableCell><TableCell align="right">{formatPrice(c.lifetimeValue)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Refund Rate */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Refund Trend" metric="refund-rate" params={tp} />
            {loading ? <CardSkeleton /> : (
              data.refundRate?.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.refundRate.map(r => ({ ...r, date: fmt(r.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                    <RTooltip formatter={(v, name) => name === 'Refund Amount' ? formatPrice(v) : `${v}%`} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="refundAmount" stroke={theme.palette.error.main} strokeWidth={2} name="Refund Amount" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="rate" stroke={theme.palette.warning.main} strokeWidth={2} name="Refund Rate %" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <Typography color="text.secondary">No refund data.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Cohort Retention */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Cohort Retention" metric="cohort-retention" params={{ period }} />
            {loading ? <CardSkeleton /> : (
              data.cohortRetention?.length > 0 ? (
                <CohortHeatmap data={data.cohortRetention} />
              ) : <Typography color="text.secondary">No cohort data yet. Requires customers with orders over multiple months.</Typography>
            )}
          </Paper>
        </Grid>

        {/* RFM Segmentation */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Customer Segmentation (RFM)" metric="rfm-segmentation" params={{ period }} />
            {loading ? <CardSkeleton /> : (
              data.rfmSegmentation?.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.rfmSegmentation} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="segment" tick={{ fontSize: 11 }} width={100} />
                      <RTooltip />
                      <Bar dataKey="customers" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} name="Customers" />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table size="small" sx={{ mt: 1 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Segment</TableCell>
                        <TableCell align="right">Customers</TableCell>
                        <TableCell align="right">Avg Recency (days)</TableCell>
                        <TableCell align="right">Avg Frequency</TableCell>
                        <TableCell align="right">Avg Monetary</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.rfmSegmentation.map((r) => (
                        <TableRow key={r.segment}>
                          <TableCell><Chip label={r.segment} size="small" /></TableCell>
                          <TableCell align="right">{r.customers}</TableCell>
                          <TableCell align="right">{r.avgRecencyDays}</TableCell>
                          <TableCell align="right">{r.avgFrequency}</TableCell>
                          <TableCell align="right">{formatPrice(r.avgMonetary)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <Typography color="text.secondary">No segmentation data yet.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Order Heatmap */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Order Activity Heatmap" metric="order-heatmap" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.orderHeatmap?.length > 0 ? (
                <OrderHeatmap data={data.orderHeatmap} />
              ) : <Typography color="text.secondary">No order data for heatmap.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Revenue Forecast */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Revenue Forecast (30 Days)" metric="revenue-forecast" params={{ period }} />
            {loading ? <CardSkeleton /> : (
              data.revenueForecast?.actual?.length > 0 ? (
                <>
                  <Box sx={{ mb: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Trend: <Typography component="span" variant="body2" fontWeight={600} color={data.revenueForecast.trend === 'up' ? 'success.main' : data.revenueForecast.trend === 'down' ? 'error.main' : 'text.secondary'}>
                        {data.revenueForecast.trend === 'up' ? 'Upward' : data.revenueForecast.trend === 'down' ? 'Downward' : 'Flat'}
                      </Typography>
                    </Typography>
                  </Box>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={[...data.revenueForecast.actual.map(d => ({ ...d, date: fmt(d.date) })), ...data.revenueForecast.forecast.map(d => ({ ...d, date: fmt(d.date) }))].map((d, i) => ({ ...d, idx: i }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor((data.revenueForecast.actual.length + 30) / 8)} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <RTooltip formatter={(v) => formatPrice(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke={theme.palette.primary.main} strokeWidth={2} name="Actual" dot={false} connectNulls={false} />
                      <Line type="monotone" dataKey="upper" stroke={theme.palette.success.light} strokeWidth={1} strokeDasharray="4 4" name="Upper Bound" dot={false} />
                      <Line type="monotone" dataKey="lower" stroke={theme.palette.error.light} strokeWidth={1} strokeDasharray="4 4" name="Lower Bound" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              ) : <Typography color="text.secondary">Not enough data for forecasting. Need at least 2 days of orders.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <DrillDownDialog
        open={drillDown.open}
        onClose={() => setDrillDown({ open: false, metric: null, filterValue: null, label: null })}
        metric={drillDown.metric}
        filterValue={drillDown.filterValue}
        label={drillDown.label}
        period={period}
      />
    </Box>
  );
};

export default AnalyticsPage;
