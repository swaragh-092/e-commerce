import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, Select, MenuItem, Skeleton, Alert, Button,
  Table, TableBody, TableHead, TableRow, Chip, IconButton, Tooltip,
  Switch, FormControlLabel, CircularProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { useCurrency, useSettings } from '../../hooks/useSettings';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { CATALOG_ANALYTICS_WIDGETS, SALES_ANALYTICS_WIDGETS } from '../../utils/analyticsWidgets';
import CatalogAnalytics from '../../components/admin/analytics/CatalogAnalytics';
import { AnalyticsDisplayProvider, AnalyticsCustomizeButton, AnalyticsWidget, AnalyticsField, useAnalyticsDisplay } from '../../components/admin/analytics/AnalyticsCustomization';
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

const SalesAnalyticsPage = () => {
  const theme = useTheme();
  const { formatPrice } = useCurrency();
  const pageRef = useRef(null);
  const requestRef = useRef(0);
  const { widgets, visible } = useAnalyticsDisplay();
  const visibleIds = widgets.filter(({ id }) => visible(id)).map(({ id }) => id).join(',');
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
    const requestId = ++requestRef.current;
    const requests = [
      ['topProducts', () => getTopProducts({ ...qp, limit: 10, sortBy: 'revenue' })],
      ['aovTrend', () => getAovTrend(tp)],
      ['abandonedCarts', () => getAbandonedCarts(qp)],
      ['revenueByCategory', () => getRevenueByCategory({ ...qp, limit: 10 })],
      ['repeatCustomers', () => getRepeatCustomers(qp)],
      ['refundRate', () => getRefundRate(tp)],
      ['geographicSales', () => getGeographicSales({ ...qp, limit: 20 })],
      ['paymentMethods', () => getRevenueByPaymentMethod(qp)],
      ['clv', () => getCustomerLifetimeValue({ ...qp, limit: 10 })],
      ['conversionRate', () => getConversionRate(qp)],
      ['trafficSources', () => getTrafficSources({ ...qp, limit: 10 })],
      ['productFunnel', () => getProductFunnel({ ...qp, limit: 10 })],
      ['utmAttribution', () => getUtmAttribution({ ...qp, limit: 20 })],
      ['couponPerformance', () => getCouponPerformance({ ...qp, limit: 10 })],
      ['cohortRetention', () => getCohortRetention({ period })],
      ['rfmSegmentation', () => getRfmSegmentation({ period })],
      ['orderHeatmap', () => getOrderHeatmap(qp)],
      ['revenueForecast', () => getRevenueForecast({ period })],
    ].filter(([id]) => widgets.some((widget) => widget.id === id) && visible(id));
    Promise.allSettled(requests.map(([, load]) => load())).then((results) => {
      if (requestId !== requestRef.current) return;
      const raw = Object.fromEntries(results.map((result, index) => [requests[index][0],
        result.status === 'fulfilled' ? result.value.data.data : null]));

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

      if (results.length > 0 && results.every(r => r.status === 'rejected')) setError('Failed to load analytics data.');
    }).finally(() => { if (requestId === requestRef.current) setLoading(false); });
  };

  useEffect(() => {
    fetchAll();
    return () => { requestRef.current += 1; };
  }, [period, trendPeriod, compare, visibleIds]);

  return (
    <Box ref={pageRef}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" component="h1" fontWeight={700}>Analytics</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <AnalyticsCustomizeButton />
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

      {!visibleIds && <Alert severity="info" sx={{ mb: 2 }}>All cards are hidden. Use Customize to choose cards or restore the defaults.</Alert>}

      {/* Conversion Rate Banner */}
      {!loading && data.conversionRate && (
        <AnalyticsWidget metric="conversionRate" component={Box}><Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }} elevation={0}>
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
        </Paper></AnalyticsWidget>
      )}

      <Grid container spacing={3}>
        {/* Product Funnel */}
        <AnalyticsWidget metric="productFunnel" item xs={12}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Product Funnel (Views → Cart → Purchase)" metric="product-funnel" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.productFunnel?.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <AnalyticsField name="0">Product</AnalyticsField>
                      <AnalyticsField name="1" align="right">Views</AnalyticsField>
                      <AnalyticsField name="2" align="right">Add to Cart</AnalyticsField>
                      <AnalyticsField name="3" align="right">Purchased</AnalyticsField>
                      <AnalyticsField name="4" align="right">View→Cart</AnalyticsField>
                      <AnalyticsField name="5" align="right">Cart→Buy</AnalyticsField>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.productFunnel.map((r) => (
                      <TableRow key={r.productId}>
                        <AnalyticsField name="0">{r.name}</AnalyticsField>
                        <AnalyticsField name="1" align="right">{r.views}</AnalyticsField>
                        <AnalyticsField name="2" align="right">{r.addToCart}</AnalyticsField>
                        <AnalyticsField name="3" align="right">{r.purchased}</AnalyticsField>
                        <AnalyticsField name="4" align="right"><Chip size="small" label={`${r.viewToCartRate}%`} color={r.viewToCartRate > 10 ? 'success' : 'default'} /></AnalyticsField>
                        <AnalyticsField name="5" align="right"><Chip size="small" label={`${r.cartToBuyRate}%`} color={r.cartToBuyRate > 30 ? 'success' : 'default'} /></AnalyticsField>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No funnel data yet. Appears after product page visits are tracked.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        {/* Top Products */}
        <AnalyticsWidget metric="topProducts" item xs={12} lg={6}>
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
                    <TableHead><TableRow><AnalyticsField name="0">#</AnalyticsField><AnalyticsField name="1">Product</AnalyticsField><AnalyticsField name="2" align="right">Revenue</AnalyticsField></TableRow></TableHead>
                    <TableBody>
                      {data.topProducts.map((p, i) => (
                        <TableRow key={p.productId || i} hover sx={{ cursor: 'pointer' }} onClick={() => setDrillDown({ open: true, metric: 'product', filterValue: p.productId, label: p.name })}><AnalyticsField name="0">{i + 1}</AnalyticsField><AnalyticsField name="1">{p.name}</AnalyticsField><AnalyticsField name="2" align="right">{formatPrice(p.revenue)}</AnalyticsField></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <Typography color="text.secondary">No sales data.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        {/* AOV Trend */}
        <AnalyticsWidget metric="aovTrend" item xs={12} lg={6}>
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
        </AnalyticsWidget>

        {/* UTM Attribution */}
        <AnalyticsWidget metric="utmAttribution" item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Marketing Attribution (UTM)" metric="utm-attribution" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.utmAttribution?.length > 0 ? (
                <Table size="small">
                  <TableHead><TableRow><AnalyticsField name="0">Source</AnalyticsField><AnalyticsField name="1">Medium</AnalyticsField><AnalyticsField name="2">Campaign</AnalyticsField><AnalyticsField name="3" align="right">Orders</AnalyticsField><AnalyticsField name="4" align="right">Revenue</AnalyticsField></TableRow></TableHead>
                  <TableBody>
                    {data.utmAttribution.map((r, i) => (
                      <TableRow key={i}><AnalyticsField name="0">{r.source}</AnalyticsField><AnalyticsField name="1">{r.medium || '—'}</AnalyticsField><AnalyticsField name="2">{r.campaign || '—'}</AnalyticsField><AnalyticsField name="3" align="right">{r.orders}</AnalyticsField><AnalyticsField name="4" align="right">{formatPrice(r.revenue)}</AnalyticsField></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No UTM data yet. Share links with ?utm_source=... to track campaigns.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        {/* Coupon Performance */}
        <AnalyticsWidget metric="couponPerformance" item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Coupon Performance" metric="coupon-performance" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.couponPerformance?.length > 0 ? (
                <Table size="small">
                  <TableHead><TableRow><AnalyticsField name="0">Code</AnalyticsField><AnalyticsField name="1" align="right">Used</AnalyticsField><AnalyticsField name="2" align="right">Revenue</AnalyticsField><AnalyticsField name="3" align="right">Discount Given</AnalyticsField><AnalyticsField name="4" align="right">Avg Discount</AnalyticsField></TableRow></TableHead>
                  <TableBody>
                    {data.couponPerformance.map((c) => (
                      <TableRow key={c.couponId}><AnalyticsField name="0"><Chip label={c.code} size="small" /></AnalyticsField><AnalyticsField name="1" align="right">{c.timesUsed}</AnalyticsField><AnalyticsField name="2" align="right">{formatPrice(c.revenueGenerated)}</AnalyticsField><AnalyticsField name="3" align="right">{formatPrice(c.totalDiscountGiven)}</AnalyticsField><AnalyticsField name="4" align="right">{formatPrice(c.avgDiscount)}</AnalyticsField></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No coupon usage data.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        {/* Revenue by Payment */}
        <AnalyticsWidget metric="paymentMethods" item xs={12} md={6} lg={4}>
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
        </AnalyticsWidget>

        {/* Abandoned Carts */}
        <AnalyticsWidget metric="abandonedCarts" item xs={12} md={6} lg={4}>
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
        </AnalyticsWidget>

        {/* Repeat Customers */}
        <AnalyticsWidget metric="repeatCustomers" item xs={12} md={6} lg={4}>
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
        </AnalyticsWidget>

        {/* Revenue by Category */}
        <AnalyticsWidget metric="revenueByCategory" item xs={12} md={6}>
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
        </AnalyticsWidget>

        {/* Traffic Sources */}
        <AnalyticsWidget metric="trafficSources" item xs={12} md={6}>
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
        </AnalyticsWidget>

        {/* Geographic Sales */}
        <AnalyticsWidget metric="geographicSales" item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Geographic Sales" metric="geographic-sales" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.geographicSales?.length > 0 ? (
                <Table size="small">
                  <TableHead><TableRow><AnalyticsField name="0">State</AnalyticsField><AnalyticsField name="1">City</AnalyticsField><AnalyticsField name="2" align="right">Orders</AnalyticsField><AnalyticsField name="3" align="right">Revenue</AnalyticsField></TableRow></TableHead>
                  <TableBody>
                    {data.geographicSales.map((r, i) => (
                      <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => setDrillDown({ open: true, metric: 'geographic-sales', filterValue: r.state, label: `${r.state} — ${r.city}` })}><AnalyticsField name="0">{r.state}</AnalyticsField><AnalyticsField name="1">{r.city}</AnalyticsField><AnalyticsField name="2" align="right">{r.orders}</AnalyticsField><AnalyticsField name="3" align="right">{formatPrice(r.revenue)}</AnalyticsField></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No geographic data.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        {/* CLV */}
        <AnalyticsWidget metric="clv" item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Customer Lifetime Value (Top 10)" metric="customer-lifetime-value" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.clv?.length > 0 ? (
                <Table size="small">
                  <TableHead><TableRow><AnalyticsField name="0">Customer</AnalyticsField><AnalyticsField name="1" align="right">Orders</AnalyticsField><AnalyticsField name="2" align="right">LTV</AnalyticsField></TableRow></TableHead>
                  <TableBody>
                    {data.clv.map((c) => (
                      <TableRow key={c.id}><AnalyticsField name="0"><Typography variant="body2" fontWeight={500}>{c.name}</Typography><Typography variant="caption" color="text.secondary">{c.email}</Typography></AnalyticsField><AnalyticsField name="1" align="right">{c.orders}</AnalyticsField><AnalyticsField name="2" align="right">{formatPrice(c.lifetimeValue)}</AnalyticsField></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No data.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        {/* Refund Rate */}
        <AnalyticsWidget metric="refundRate" item xs={12}>
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
        </AnalyticsWidget>

        {/* Cohort Retention */}
        <AnalyticsWidget metric="cohortRetention" item xs={12}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Cohort Retention" metric="cohort-retention" params={{ period }} />
            {loading ? <CardSkeleton /> : (
              data.cohortRetention?.length > 0 ? (
                <CohortHeatmap data={data.cohortRetention} />
              ) : <Typography color="text.secondary">No cohort data yet. Requires customers with orders over multiple months.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        {/* RFM Segmentation */}
        <AnalyticsWidget metric="rfmSegmentation" item xs={12} lg={6}>
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
                        <AnalyticsField name="0">Segment</AnalyticsField>
                        <AnalyticsField name="1" align="right">Customers</AnalyticsField>
                        <AnalyticsField name="2" align="right">Avg Recency (days)</AnalyticsField>
                        <AnalyticsField name="3" align="right">Avg Frequency</AnalyticsField>
                        <AnalyticsField name="4" align="right">Avg Monetary</AnalyticsField>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.rfmSegmentation.map((r) => (
                        <TableRow key={r.segment}>
                          <AnalyticsField name="0"><Chip label={r.segment} size="small" /></AnalyticsField>
                          <AnalyticsField name="1" align="right">{r.customers}</AnalyticsField>
                          <AnalyticsField name="2" align="right">{r.avgRecencyDays}</AnalyticsField>
                          <AnalyticsField name="3" align="right">{r.avgFrequency}</AnalyticsField>
                          <AnalyticsField name="4" align="right">{formatPrice(r.avgMonetary)}</AnalyticsField>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <Typography color="text.secondary">No segmentation data yet.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        {/* Order Heatmap */}
        <AnalyticsWidget metric="orderHeatmap" item xs={12} lg={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Order Activity Heatmap" metric="order-heatmap" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.orderHeatmap?.length > 0 ? (
                <OrderHeatmap data={data.orderHeatmap} />
              ) : <Typography color="text.secondary">No order data for heatmap.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        {/* Revenue Forecast */}
        <AnalyticsWidget metric="revenueForecast" item xs={12}>
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
        </AnalyticsWidget>
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

const AnalyticsPage = () => {
  const { features, mode } = useSettings();
  const { user, hasPermission } = useAuth();
  if (!features) return <CardSkeleton />;
  if (!features.analytics) return <Alert severity="info">Analytics is disabled in Platform Features.</Alert>;
  const sales = mode === 'ecommerce' && features.orders === true && hasPermission(PERMISSIONS.ORDERS_READ);
  const widgets = sales ? SALES_ANALYTICS_WIDGETS.filter(({ id }) =>
    (id !== 'couponPerformance' || features.coupons === true) &&
    (id !== 'clv' || hasPermission(PERMISSIONS.CUSTOMERS_READ))) : CATALOG_ANALYTICS_WIDGETS;
  const storageKey = `analytics-display:${user?.id || 'staff'}:${mode}:${sales ? 'sales' : 'catalog'}`;
  return <AnalyticsDisplayProvider key={storageKey} storageKey={storageKey} widgets={widgets}>
    {sales ? <SalesAnalyticsPage /> : <CatalogAnalytics />}
  </AnalyticsDisplayProvider>;
};

export default AnalyticsPage;
