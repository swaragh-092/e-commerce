import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, Select, MenuItem, Skeleton, Alert, Button,
  Table, TableBody, TableHead, TableRow, Chip, IconButton, Tooltip,
  Switch, FormControlLabel, CircularProgress, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
  getTopProducts, getProductProfitability, getVariantPerformance, getInventoryPerformance, getStockoutHistory, getAovTrend, getAbandonedCarts,
  getRevenueByCategory, getTaxReport, getTaxByState, getReturnReasons, getOrderStatusReport, getCustomerTypeSales, getProductReturnRates, getShippingPerformance, getSalesReconciliation, getRepeatCustomers, getRefundRate,
  getGeographicSales, getRevenueByPaymentMethod, getCustomerLifetimeValue,
  getConversionRate, getTrafficSources, getProductFunnel, getCheckoutFunnel, getLandingPagePerformance, getDevicePerformance, getUtmAttribution,
  getCouponPerformance, saveCampaignSpend, exportAnalyticsCsv,
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
  { value: 'custom', label: 'Custom range' },
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

const SalesAnalyticsPage = ({ userId }) => {
  const theme = useTheme();
  const { formatPrice } = useCurrency();
  const pageRef = useRef(null);
  const requestRef = useRef(0);
  const { widgets, visible } = useAnalyticsDisplay();
  const visibleIds = widgets.filter(({ id }) => visible(id)).map(({ id }) => id).join(',');
  const [period, setPeriod] = useState('30d');
  const savedViewsKey = `analytics-saved-views:${userId || 'staff'}`;
  const [savedViews, setSavedViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem(savedViewsKey) || '[]'); } catch { return []; }
  });
  const [selectedSavedView, setSelectedSavedView] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedViewName, setSavedViewName] = useState('');
  const [customRange, setCustomRange] = useState(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 29 * 864e5);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  });
  const [trendPeriod, setTrendPeriod] = useState('monthly');
  const [attributionModel, setAttributionModel] = useState('last');
  const [spendDialogOpen, setSpendDialogOpen] = useState(false);
  const [spendSaving, setSpendSaving] = useState(false);
  const [spendForm, setSpendForm] = useState({
    spendDate: new Date().toISOString().slice(0, 10), source: '', medium: '', campaign: '', amount: '',
  });
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

  const qp = { period, ...(period === 'custom' ? customRange : {}), ...(compare ? { compare: true } : {}) };
  const tp = { period: trendPeriod, ...(compare ? { compare: true } : {}) };

  useEffect(() => {
    try { localStorage.setItem(savedViewsKey, JSON.stringify(savedViews)); } catch { /* Storage may be disabled or full. */ }
  }, [savedViewsKey, savedViews]);

  const saveCurrentView = () => {
    const name = savedViewName.trim();
    if (!name) return;
    const view = { id: `${Date.now()}`, name, period, customRange: { ...customRange } };
    setSavedViews((current) => [...current.filter((item) => item.name.toLowerCase() !== name.toLowerCase()), view]);
    setSelectedSavedView(view.id);
    setSaveDialogOpen(false);
    setSavedViewName('');
  };

  const loadSavedView = (id) => {
    setSelectedSavedView(id);
    const view = savedViews.find((item) => item.id === id);
    if (!view) return;
    setPeriod(view.period);
    setCustomRange(view.customRange || customRange);
  };

  const removeSavedView = () => {
    setSavedViews((current) => current.filter((item) => item.id !== selectedSavedView));
    setSelectedSavedView('');
  };

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
      ['productProfitability', () => getProductProfitability({ ...qp, limit: 50 })],
      ['variantPerformance', () => getVariantPerformance({ ...qp, limit: 20 })],
      ['inventoryPerformance', () => getInventoryPerformance({ ...qp, limit: 50 })],
      ['stockoutHistory', () => getStockoutHistory({ ...qp, limit: 50 })],
      ['aovTrend', () => getAovTrend(tp)],
      ['abandonedCarts', () => getAbandonedCarts(qp)],
      ['revenueByCategory', () => getRevenueByCategory({ ...qp, limit: 10 })],
      ['taxReport', () => getTaxReport(qp)],
      ['taxByState', () => getTaxByState({ ...qp, limit: 50 })],
      ['returnReasons', () => getReturnReasons({ ...qp, limit: 20 })],
      ['orderStatus', () => getOrderStatusReport(qp)],
      ['customerTypeSales', () => getCustomerTypeSales(qp)],
      ['productReturnRates', () => getProductReturnRates({ ...qp, limit: 20 })],
      ['shippingPerformance', () => getShippingPerformance({ ...qp, limit: 50 })],
      ['salesReconciliation', () => getSalesReconciliation(qp)],
      ['repeatCustomers', () => getRepeatCustomers(qp)],
      ['refundRate', () => getRefundRate(tp)],
      ['geographicSales', () => getGeographicSales({ ...qp, limit: 20 })],
      ['paymentMethods', () => getRevenueByPaymentMethod(qp)],
      ['clv', () => getCustomerLifetimeValue({ ...qp, limit: 10 })],
      ['conversionRate', () => getConversionRate(qp)],
      ['trafficSources', () => getTrafficSources({ ...qp, limit: 10 })],
      ['landingPages', () => getLandingPagePerformance({ ...qp, limit: 20 })],
      ['devicePerformance', () => getDevicePerformance(qp)],
      ['productFunnel', () => getProductFunnel({ ...qp, limit: 10 })],
      ['checkoutFunnel', () => getCheckoutFunnel(qp)],
      ['utmAttribution', () => getUtmAttribution({ ...qp, limit: 20, attribution: attributionModel })],
      ['couponPerformance', () => getCouponPerformance({ ...qp, limit: 10 })],
      ['cohortRetention', () => getCohortRetention(qp)],
      ['rfmSegmentation', () => getRfmSegmentation(qp)],
      ['orderHeatmap', () => getOrderHeatmap(qp)],
      ['revenueForecast', () => getRevenueForecast(qp)],
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

  const submitCampaignSpend = async (event) => {
    event.preventDefault();
    setSpendSaving(true);
    try {
      await saveCampaignSpend({ ...spendForm, amount: Number(spendForm.amount) });
      setSpendDialogOpen(false);
      setSpendForm((form) => ({ ...form, amount: '' }));
      fetchAll();
    } finally {
      setSpendSaving(false);
    }
  };

  const insights = [];
  if (Array.isArray(data.salesReconciliation)) {
    const revenueOf = (rows = []) => rows.reduce((sum, row) => sum + Number(row.netAfterRefunds || 0), 0);
    const currentRevenue = revenueOf(data.salesReconciliation);
    const previousRevenue = revenueOf(comparison.salesReconciliation?.previous || []);
    if (previousRevenue > 0) {
      const change = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
      if (change <= -10) insights.push({ severity: 'warning', title: 'Revenue is down', detail: `Net revenue is ${Math.abs(change).toFixed(1)}% below the previous period.`, target: 'salesReconciliation', action: 'Review sales' });
      else if (change >= 15) insights.push({ severity: 'success', title: 'Revenue is growing', detail: `Net revenue is up ${change.toFixed(1)}% from the previous period.`, target: 'salesReconciliation', action: 'Review sales' });
    }
  }
  if (data.conversionRate?.visitors >= 100 && data.conversionRate.rate < 1) {
    insights.push({ severity: 'warning', title: 'Conversion is below 1%', detail: `${data.conversionRate.rate}% of ${data.conversionRate.visitors.toLocaleString()} visitors placed an order.`, target: 'conversionRate', action: 'Review conversion' });
  }
  if (data.abandonedCarts?.abandoned >= 5 && data.abandonedCarts.rate >= 70) {
    insights.push({ severity: 'warning', title: 'Many carts are expiring', detail: `${data.abandonedCarts.rate}% of completed carts expired, with an estimated ${formatPrice(data.abandonedCarts.estimatedAbandonedValue || 0)} in cart value.`, target: 'abandonedCarts', action: 'Review carts' });
  }
  const lowCoverProduct = (data.inventoryPerformance || [])
    .filter((row) => row.unitsSold > 0 && row.daysOfCover != null && row.daysOfCover <= 7)
    .sort((a, b) => a.daysOfCover - b.daysOfCover)[0];
  if (lowCoverProduct) {
    insights.push({ severity: 'warning', title: 'Stock may run low', detail: `${lowCoverProduct.product} has about ${lowCoverProduct.daysOfCover} days of stock at recent sales pace.`, target: 'inventoryPerformance', action: 'Review inventory' });
  }
  const lowMarginProduct = (data.productProfitability || [])
    .filter((row) => row.costCoverage >= 80 && row.grossMargin != null && row.grossMargin < 10)
    .sort((a, b) => a.grossMargin - b.grossMargin)[0];
  if (lowMarginProduct) {
    insights.push({ severity: 'info', title: 'Low-margin product', detail: `${lowMarginProduct.product} has a ${lowMarginProduct.grossMargin}% gross margin based on recorded unit costs.`, target: 'productProfitability', action: 'Review margins' });
  }

  useEffect(() => {
    fetchAll();
    return () => { requestRef.current += 1; };
  }, [period, customRange.startDate, customRange.endDate, trendPeriod, attributionModel, compare, visibleIds]);

  return (
    <Box ref={pageRef}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" component="h1" fontWeight={700}>Analytics</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <AnalyticsCustomizeButton />
          <Select size="small" displayEmpty value={selectedSavedView} onChange={(event) => loadSavedView(event.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value=""><em>Saved views</em></MenuItem>
            {savedViews.map((view) => <MenuItem key={view.id} value={view.id}>{view.name}</MenuItem>)}
          </Select>
          <Button size="small" variant="outlined" onClick={() => setSaveDialogOpen(true)}>Save view</Button>
          {selectedSavedView && <Tooltip title="Delete saved view"><IconButton size="small" onClick={removeSavedView}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>}
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
          {period === 'custom' && <>
            <TextField size="small" type="date" label="From" value={customRange.startDate}
              onChange={(e) => setCustomRange((range) => ({ ...range, startDate: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: customRange.endDate } }} />
            <TextField size="small" type="date" label="To" value={customRange.endDate}
              onChange={(e) => setCustomRange((range) => ({ ...range, endDate: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: customRange.startDate } }} />
          </>}
          <Select size="small" value={trendPeriod} onChange={(e) => setTrendPeriod(e.target.value)} sx={{ minWidth: 110 }}>
            {TREND_PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </Select>
          <Select size="small" value={attributionModel} onChange={(e) => setAttributionModel(e.target.value)} sx={{ minWidth: 145 }}>
            <MenuItem value="first">First touch</MenuItem>
            <MenuItem value="last">Last touch</MenuItem>
          </Select>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={fetchAll}>Retry</Button>}>{error}</Alert>}

      {!visibleIds && <Alert severity="info" sx={{ mb: 2 }}>All cards are hidden. Use Customize to choose cards or restore the defaults.</Alert>}

      <AnalyticsWidget metric="insights" component={Box}>
        <Paper sx={{ p: 3, mb: 3 }} elevation={0}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Analytics insights</Typography>
          {loading ? <CardSkeleton /> : insights.length ? (
            <Grid container spacing={1.5}>
              {insights.slice(0, 6).map((insight, index) => (
                <Grid item xs={12} md={6} key={`${insight.target}-${index}`}>
                  <Alert severity={insight.severity} action={
                    <Button color="inherit" size="small" onClick={() => document.getElementById(insight.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                      {insight.action}
                    </Button>
                  }>
                    <Typography variant="subtitle2" fontWeight={700}>{insight.title}</Typography>
                    <Typography variant="body2">{insight.detail}</Typography>
                  </Alert>
                </Grid>
              ))}
            </Grid>
          ) : <Typography variant="body2" color="text.secondary">No priority issues detected from the available data. Turn on Compare to see revenue movement against the previous period.</Typography>}
        </Paper>
      </AnalyticsWidget>

      <AnalyticsWidget metric="checkoutFunnel" component={Box}>
        <Paper id="checkoutFunnel" sx={{ p: 3, mb: 3 }} elevation={0}>
          <SectionHeader title="Storewide Checkout Funnel" metric="checkout-funnel" params={qp} />
          {loading ? <CardSkeleton /> : data.checkoutFunnel ? (
            data.checkoutFunnel.trackingAvailable === false
              ? <Typography color="text.secondary">Run database migrations to enable checkout event tracking.</Typography>
              : <Grid container spacing={2}>
                {[
                  ['Product views', data.checkoutFunnel.productViews],
                  ['Added to cart', data.checkoutFunnel.addToCart],
                  ['Checkout started', data.checkoutFunnel.checkoutStarted],
                  ['Purchased', data.checkoutFunnel.purchases],
                ].map(([label, count], index, stages) => {
                  const previous = index > 0 ? stages[index - 1][1] : null;
                  const rate = previous > 0 ? `${((count / previous) * 100).toFixed(1)}% from previous` : index === 0 ? 'Top of funnel' : '—';
                  return <Grid item xs={6} md={3} key={label}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{Number(count).toLocaleString()}</Typography>
                    <Typography variant="caption" color="text.secondary">{rate}</Typography>
                  </Grid>;
                })}
              </Grid>
          ) : <Typography color="text.secondary">No funnel data for this period.</Typography>}
        </Paper>
      </AnalyticsWidget>

      {/* Conversion Rate Banner */}
      {!loading && data.conversionRate && (
        <AnalyticsWidget metric="conversionRate" component={Box}><Paper id="conversionRate" sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }} elevation={0}>
          <Box>
            <Typography variant="body2" color="text.secondary">Page views</Typography>
            <Typography variant="h5" fontWeight={700}>{data.conversionRate.visits?.toLocaleString()}
              {compare && comparison.conversionRate?.changes?.visits != null && <ComparisonIndicator change={comparison.conversionRate.changes.visits} />}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Unique visitors</Typography>
            <Typography variant="h5" fontWeight={700}>{data.conversionRate.visitors?.toLocaleString()}
              {compare && comparison.conversionRate?.changes?.visitors != null && <ComparisonIndicator change={comparison.conversionRate.changes.visitors} />}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Orders</Typography>
            <Typography variant="h5" fontWeight={700}>{data.conversionRate.orders?.toLocaleString()}
              {compare && comparison.conversionRate?.changes?.orders != null && <ComparisonIndicator change={comparison.conversionRate.changes.orders} />}
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Orders divided by unique visitors in the selected period">
              <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'underline dotted', cursor: 'help' }}>Visitor conversion</Typography>
            </Tooltip>
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
                      <AnalyticsField name="3" align="right">Orders</AnalyticsField>
                      <AnalyticsField name="4" align="right">Units Sold</AnalyticsField>
                      <AnalyticsField name="5" align="right">View→Cart</AnalyticsField>
                      <AnalyticsField name="6" align="right">Cart→Order</AnalyticsField>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.productFunnel.map((r) => (
                      <TableRow key={r.productId}>
                        <AnalyticsField name="0">{r.name}</AnalyticsField>
                        <AnalyticsField name="1" align="right">{r.views}</AnalyticsField>
                        <AnalyticsField name="2" align="right">{r.addToCart}</AnalyticsField>
                        <AnalyticsField name="3" align="right">{r.orders}</AnalyticsField>
                        <AnalyticsField name="4" align="right">{r.purchased}</AnalyticsField>
                        <AnalyticsField name="5" align="right"><Chip size="small" label={`${r.viewToCartRate}%`} color={r.viewToCartRate > 10 ? 'success' : 'default'} /></AnalyticsField>
                        <AnalyticsField name="6" align="right"><Chip size="small" label={`${r.cartToBuyRate}%`} color={r.cartToBuyRate > 30 ? 'success' : 'default'} /></AnalyticsField>
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

        <AnalyticsWidget metric="productProfitability" item xs={12}>
          <Paper id="productProfitability" sx={{ p: 3, overflowX: 'auto' }} elevation={0}>
            <SectionHeader title="Product Profitability" metric="product-profitability" params={{ ...qp, limit: 50 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Net sales deduct allocated merchandise discounts and completed refunds. Refunds are spread by line sales and capped at merchandise sales after discounts. Recorded profit uses order-time costs and keeps the original cost of goods. Estimated profit also uses current costs where snapshots are missing.
            </Typography>
            {loading ? <CardSkeleton /> : data.productProfitability?.length ? (
              <Table size="small" sx={{ minWidth: 1050 }}>
                <TableHead><TableRow>
                  <AnalyticsField name="0">Product</AnalyticsField>
                  <AnalyticsField name="1">SKU</AnalyticsField>
                  <AnalyticsField name="2" align="right">Units sold</AnalyticsField>
                  <AnalyticsField name="3" align="right">Net sales</AnalyticsField>
                  <AnalyticsField name="4" align="right">Cost of goods</AnalyticsField>
                  <AnalyticsField name="5" align="right">Gross profit</AnalyticsField>
                  <AnalyticsField name="6" align="right">Gross margin</AnalyticsField>
                  <AnalyticsField name="7" align="right">Cost coverage</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.productProfitability.map((row, index) => (
                  <TableRow key={`${row.productId || row.sku}-${index}`}>
                    <AnalyticsField name="0">{row.product}</AnalyticsField>
                    <AnalyticsField name="1">{row.sku}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.unitsSold}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{formatPrice(row.netSales)}</AnalyticsField>
                    <AnalyticsField name="4" align="right">{formatPrice(row.costOfGoods)}</AnalyticsField>
                    <AnalyticsField name="5" align="right">{row.grossProfit == null ? '—' : formatPrice(row.grossProfit)}</AnalyticsField>
                    <AnalyticsField name="6" align="right">{row.grossMargin == null ? 'Add unit cost' : `${row.grossMargin}%`}</AnalyticsField>
                    <AnalyticsField name="7" align="right">{row.costCoverage}%{row.estimatedUnits > 0 && <Typography variant="caption" display="block">Estimated profit {formatPrice(row.estimatedGrossProfit)} ({row.estimatedUnits} units use current costs)</Typography>}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No product sales in this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="stockoutHistory" item xs={12}>
          <Paper sx={{ p: 3, overflowX: 'auto' }} elevation={0}>
            <SectionHeader title="Stockout History" metric="stockout-history" params={{ ...qp, limit: 50 }} />
            {loading ? <CardSkeleton /> : data.stockoutHistory?.length ? (
              <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead><TableRow>
                  <AnalyticsField name="0">Product</AnalyticsField>
                  <AnalyticsField name="1">SKU</AnalyticsField>
                  <AnalyticsField name="2" align="right">Events</AnalyticsField>
                  <AnalyticsField name="3" align="right">Open stockouts</AnalyticsField>
                  <AnalyticsField name="4">Last stockout</AnalyticsField>
                  <AnalyticsField name="5" align="right">Avg. days to restock</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.stockoutHistory.map((row) => (
                  <TableRow key={row.productId}>
                    <AnalyticsField name="0">{row.product}</AnalyticsField>
                    <AnalyticsField name="1">{row.sku}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.stockoutEvents}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{row.stillOutOfStock}</AnalyticsField>
                    <AnalyticsField name="4">{fmt(row.lastStockout)}</AnalyticsField>
                    <AnalyticsField name="5" align="right">{row.avgDaysToRestock ?? '—'}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No stockout transactions recorded in this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="variantPerformance" item xs={12}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Sales by Variant" metric="variant-performance" params={{ ...qp, limit: 20 }} />
            {loading ? <CardSkeleton /> : data.variantPerformance?.length ? (
              <Table size="small">
                <TableHead><TableRow>
                  <AnalyticsField name="0">Product</AnalyticsField>
                  <AnalyticsField name="1">SKU</AnalyticsField>
                  <AnalyticsField name="2" align="right">Orders</AnalyticsField>
                  <AnalyticsField name="3" align="right">Units sold</AnalyticsField>
                  <AnalyticsField name="4" align="right">Revenue</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.variantPerformance.map((row, index) => (
                  <TableRow key={`${row.variantId || row.productId}-${index}`}>
                    <AnalyticsField name="0">{row.product}</AnalyticsField>
                    <AnalyticsField name="1">{row.sku}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.orders}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{row.unitsSold}</AnalyticsField>
                    <AnalyticsField name="4" align="right">{formatPrice(row.revenue)}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No variant sales in this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="inventoryPerformance" item xs={12}>
          <Paper id="inventoryPerformance" sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Inventory Performance" metric="inventory-performance" params={{ ...qp, limit: 50 }} />
            {loading ? <CardSkeleton /> : data.inventoryPerformance?.length ? (
              <Table size="small">
                <TableHead><TableRow>
                  <AnalyticsField name="0">Product</AnalyticsField>
                  <AnalyticsField name="1">SKU</AnalyticsField>
                  <AnalyticsField name="2" align="right">Available</AnalyticsField>
                  <AnalyticsField name="3" align="right">Units sold</AnalyticsField>
                  <AnalyticsField name="4" align="right">Days of cover</AnalyticsField>
                  <AnalyticsField name="5" align="right">Revenue</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.inventoryPerformance.map((row) => (
                  <TableRow key={row.productId}>
                    <AnalyticsField name="0">{row.product}</AnalyticsField>
                    <AnalyticsField name="1">{row.sku}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.availableStock}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{row.unitsSold}</AnalyticsField>
                    <AnalyticsField name="4" align="right">{row.daysOfCover == null ? 'No recent sales' : `${row.daysOfCover} days`}</AnalyticsField>
                    <AnalyticsField name="5" align="right">{formatPrice(row.revenue)}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No inventory data for this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="taxReport" item xs={12}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Tax Collected" metric="tax-report" params={qp} />
            {loading ? <CardSkeleton /> : data.taxReport?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.taxReport.map((row) => ({ ...row, date: fmt(row.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(value) => formatPrice(value)} tick={{ fontSize: 11 }} />
                  <RTooltip formatter={(value) => formatPrice(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="orderTax" name="Order tax" stroke={theme.palette.primary.main} dot={false} />
                  <Line type="monotone" dataKey="shippingTax" name="Shipping tax" stroke={theme.palette.secondary.main} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Typography color="text.secondary">No tax data for this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="returnReasons" item xs={12} md={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Returns by Reason" metric="return-reasons" params={{ ...qp, limit: 20 }} />
            {loading ? <CardSkeleton /> : data.returnReasons?.length ? (
              <Table size="small">
                <TableHead><TableRow>
                  <AnalyticsField name="0">Reason</AnalyticsField>
                  <AnalyticsField name="1" align="right">Cases</AnalyticsField>
                  <AnalyticsField name="2" align="right">Units</AnalyticsField>
                  <AnalyticsField name="3" align="right">Completed</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.returnReasons.map((row) => (
                  <TableRow key={row.reason}>
                    <AnalyticsField name="0">{row.reason}</AnalyticsField>
                    <AnalyticsField name="1" align="right">{row.cases}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.units}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{row.completed}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No return requests for this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="orderStatus" item xs={12} md={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Orders by Status" metric="order-status" params={qp} />
            {loading ? <CardSkeleton /> : data.orderStatus?.length ? (
              <Table size="small">
                <TableHead><TableRow>
                  <AnalyticsField name="0">Order status</AnalyticsField>
                  <AnalyticsField name="1">Payment status</AnalyticsField>
                  <AnalyticsField name="2" align="right">Orders</AnalyticsField>
                  <AnalyticsField name="3" align="right">Order value</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.orderStatus.map((row) => (
                  <TableRow key={`${row.orderStatus}-${row.paymentStatus}`}>
                    <AnalyticsField name="0">{row.orderStatus}</AnalyticsField>
                    <AnalyticsField name="1">{row.paymentStatus}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.orders}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{formatPrice(row.orderValue)}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No orders in this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="customerTypeSales" item xs={12} md={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="New vs Returning Customers" metric="customer-type-sales" params={qp} />
            {loading ? <CardSkeleton /> : data.customerTypeSales?.length ? (
              <Table size="small">
                <TableHead><TableRow>
                  <AnalyticsField name="0">Customer type</AnalyticsField>
                  <AnalyticsField name="1" align="right">Customers</AnalyticsField>
                  <AnalyticsField name="2" align="right">Orders</AnalyticsField>
                  <AnalyticsField name="3" align="right">Order value</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.customerTypeSales.map((row) => (
                  <TableRow key={row.customerType}>
                    <AnalyticsField name="0">{row.customerType}</AnalyticsField>
                    <AnalyticsField name="1" align="right">{row.customers}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.orders}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{formatPrice(row.orderValue)}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No customer sales data for this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="productReturnRates" item xs={12}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Product Return Rates" metric="product-return-rates" params={{ ...qp, limit: 20 }} />
            {loading ? <CardSkeleton /> : data.productReturnRates?.length ? (
              <Table size="small">
                <TableHead><TableRow>
                  <AnalyticsField name="0">Product</AnalyticsField>
                  <AnalyticsField name="1">SKU</AnalyticsField>
                  <AnalyticsField name="2" align="right">Units sold</AnalyticsField>
                  <AnalyticsField name="3" align="right">Returned</AnalyticsField>
                  <AnalyticsField name="4" align="right">Return rate</AnalyticsField>
                  <AnalyticsField name="5" align="right">Returned value</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.productReturnRates.map((row) => (
                  <TableRow key={row.productId}>
                    <AnalyticsField name="0">{row.product}</AnalyticsField>
                    <AnalyticsField name="1">{row.sku}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.unitsSold}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{row.unitsReturned}</AnalyticsField>
                    <AnalyticsField name="4" align="right">{row.returnRate}%</AnalyticsField>
                    <AnalyticsField name="5" align="right">{formatPrice(row.returnedValue)}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No completed product returns for this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="shippingPerformance" item xs={12} md={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Shipping Performance" metric="shipping-performance" params={{ ...qp, limit: 50 }} />
            {loading ? <CardSkeleton /> : data.shippingPerformance?.length ? (
              <Table size="small">
                <TableHead><TableRow>
                  <AnalyticsField name="0">Carrier</AnalyticsField>
                  <AnalyticsField name="1">Status</AnalyticsField>
                  <AnalyticsField name="2" align="right">Shipments</AnalyticsField>
                  <AnalyticsField name="3" align="right">Orders</AnalyticsField>
                  <AnalyticsField name="4" align="right">Overdue</AnalyticsField>
                  <AnalyticsField name="5" align="right">Avg delivery days</AnalyticsField>
                  <AnalyticsField name="6" align="right">Delivered late</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.shippingPerformance.map((row) => (
                  <TableRow key={`${row.carrier}-${row.shipmentStatus}`}>
                    <AnalyticsField name="0">{row.carrier}</AnalyticsField>
                    <AnalyticsField name="1">{row.shipmentStatus}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.shipments}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{row.orders}</AnalyticsField>
                    <AnalyticsField name="4" align="right">{row.overdue}</AnalyticsField>
                    <AnalyticsField name="5" align="right">{row.avgDeliveryDays == null ? '—' : row.avgDeliveryDays}</AnalyticsField>
                    <AnalyticsField name="6" align="right">{row.deliveredLate}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No shipments for this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="salesReconciliation" item xs={12}>
          <Paper id="salesReconciliation" sx={{ p: 3, overflowX: 'auto' }} elevation={0}>
            <SectionHeader title="Sales Reconciliation" metric="sales-reconciliation" params={qp} />
            {loading ? <CardSkeleton /> : data.salesReconciliation?.length ? (
              <Table size="small" sx={{ minWidth: 950 }}>
                <TableHead><TableRow>
                  <AnalyticsField name="0">Date</AnalyticsField>
                  <AnalyticsField name="1" align="right">Orders</AnalyticsField>
                  <AnalyticsField name="2" align="right">Subtotal</AnalyticsField>
                  <AnalyticsField name="3" align="right">Discounts</AnalyticsField>
                  <AnalyticsField name="4" align="right">Tax</AnalyticsField>
                  <AnalyticsField name="5" align="right">Shipping</AnalyticsField>
                  <AnalyticsField name="6" align="right">Order total</AnalyticsField>
                  <AnalyticsField name="7" align="right">Refunds</AnalyticsField>
                  <AnalyticsField name="8" align="right">Net after refunds</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.salesReconciliation.map((row) => (
                  <TableRow key={row.date}>
                    <AnalyticsField name="0">{fmt(row.date)}</AnalyticsField>
                    <AnalyticsField name="1" align="right">{row.orders}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{formatPrice(row.subtotal)}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{formatPrice(row.discounts)}</AnalyticsField>
                    <AnalyticsField name="4" align="right">{formatPrice(row.tax)}</AnalyticsField>
                    <AnalyticsField name="5" align="right">{formatPrice(row.shipping)}</AnalyticsField>
                    <AnalyticsField name="6" align="right">{formatPrice(row.orderTotal)}</AnalyticsField>
                    <AnalyticsField name="7" align="right">{formatPrice(row.refunds)}</AnalyticsField>
                    <AnalyticsField name="8" align="right">{formatPrice(row.netAfterRefunds)}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No sales data for this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="taxByState" item xs={12}>
          <Paper sx={{ p: 3, overflowX: 'auto' }} elevation={0}>
            <SectionHeader title="Tax by Destination" metric="tax-by-state" params={{ ...qp, limit: 50 }} />
            {loading ? <CardSkeleton /> : data.taxByState?.length ? (
              <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead><TableRow>
                  <AnalyticsField name="0">Destination</AnalyticsField>
                  <AnalyticsField name="1" align="right">Orders</AnalyticsField>
                  <AnalyticsField name="2" align="right">CGST</AnalyticsField>
                  <AnalyticsField name="3" align="right">SGST</AnalyticsField>
                  <AnalyticsField name="4" align="right">IGST</AnalyticsField>
                  <AnalyticsField name="5" align="right">Other tax</AnalyticsField>
                  <AnalyticsField name="6" align="right">Total tax</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.taxByState.map((row) => (
                  <TableRow key={row.destination}>
                    <AnalyticsField name="0">{row.destination}</AnalyticsField>
                    <AnalyticsField name="1" align="right">{row.orders}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{formatPrice(row.cgst)}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{formatPrice(row.sgst)}</AnalyticsField>
                    <AnalyticsField name="4" align="right">{formatPrice(row.igst)}</AnalyticsField>
                    <AnalyticsField name="5" align="right">{formatPrice(row.flatTax)}</AnalyticsField>
                    <AnalyticsField name="6" align="right">{formatPrice(row.totalTax)}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No destination tax data for this period.</Typography>}
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <SectionHeader title={`Marketing Attribution (${attributionModel} touch)`} metric="utm-attribution" params={{ ...qp, attribution: attributionModel, limit: 20 }} />
              <Button size="small" variant="outlined" onClick={() => setSpendDialogOpen(true)}>Add ad spend</Button>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Enter spend in store currency. ROAS = attributed revenue ÷ spend; CAC = spend ÷ first-time buyers. Saving the same campaign and date updates its spend.
            </Typography>
            {loading ? <CardSkeleton /> : (
              data.utmAttribution?.length > 0 ? (
                <Table size="small" sx={{ minWidth: 1000 }}>
                  <TableHead><TableRow><AnalyticsField name="0">Source</AnalyticsField><AnalyticsField name="1">Medium</AnalyticsField><AnalyticsField name="2">Campaign</AnalyticsField><AnalyticsField name="3" align="right">Customers</AnalyticsField><AnalyticsField name="4" align="right">New customers</AnalyticsField><AnalyticsField name="5" align="right">Orders</AnalyticsField><AnalyticsField name="6" align="right">Revenue</AnalyticsField><AnalyticsField name="7" align="right">Spend</AnalyticsField><AnalyticsField name="8" align="right">CAC</AnalyticsField><AnalyticsField name="9" align="right">ROAS</AnalyticsField></TableRow></TableHead>
                  <TableBody>
                    {data.utmAttribution.map((r, i) => (
                      <TableRow key={i}><AnalyticsField name="0">{r.source}</AnalyticsField><AnalyticsField name="1">{r.medium || '—'}</AnalyticsField><AnalyticsField name="2">{r.campaign || '—'}</AnalyticsField><AnalyticsField name="3" align="right">{r.customers}</AnalyticsField><AnalyticsField name="4" align="right">{r.newCustomers}</AnalyticsField><AnalyticsField name="5" align="right">{r.orders}</AnalyticsField><AnalyticsField name="6" align="right">{formatPrice(r.revenue)}</AnalyticsField><AnalyticsField name="7" align="right">{formatPrice(r.spend || 0)}</AnalyticsField><AnalyticsField name="8" align="right">{r.cac == null ? '—' : formatPrice(r.cac)}</AnalyticsField><AnalyticsField name="9" align="right">{r.roas == null ? '—' : `${r.roas}×`}</AnalyticsField></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography color="text.secondary">No UTM data yet. Share links with ?utm_source=... to track campaigns.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        <Dialog open={spendDialogOpen} onClose={() => !spendSaving && setSpendDialogOpen(false)} fullWidth maxWidth="sm">
          <Box component="form" onSubmit={submitCampaignSpend}>
            <DialogTitle>Record campaign spend</DialogTitle>
            <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, pt: '12px !important' }}>
              <TextField required autoFocus label="Source (utm_source)" value={spendForm.source} onChange={(e) => setSpendForm((form) => ({ ...form, source: e.target.value }))} inputProps={{ maxLength: 255 }} />
              <TextField label="Medium (utm_medium)" value={spendForm.medium} onChange={(e) => setSpendForm((form) => ({ ...form, medium: e.target.value }))} inputProps={{ maxLength: 255 }} />
              <TextField required label="Campaign (utm_campaign)" value={spendForm.campaign} onChange={(e) => setSpendForm((form) => ({ ...form, campaign: e.target.value }))} inputProps={{ maxLength: 255 }} />
              <TextField required type="date" label="Spend date" value={spendForm.spendDate} onChange={(e) => setSpendForm((form) => ({ ...form, spendDate: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField required type="number" label="Spend amount" value={spendForm.amount} onChange={(e) => setSpendForm((form) => ({ ...form, amount: e.target.value }))} inputProps={{ min: 0, step: '0.01' }} />
              <Typography variant="caption" color="text.secondary" alignSelf="center">Use the same UTM values as your campaign links. Amount is in store currency.</Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setSpendDialogOpen(false)} disabled={spendSaving}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={spendSaving || !spendForm.amount}>Save spend</Button>
            </DialogActions>
          </Box>
        </Dialog>

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
          <Paper id="abandonedCarts" sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Cart Abandonment" metric="abandoned-carts" params={qp} />
            {loading ? <CardSkeleton /> : (
              data.abandonedCarts?.total > 0 ? (
                <Box sx={{ textAlign: 'center' }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={[{ name: 'Converted', value: data.abandonedCarts.converted }, { name: 'Abandoned', value: data.abandonedCarts.abandoned }, { name: 'Still active', value: data.abandonedCarts.active }]} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                        <Cell fill={theme.palette.success.main} /><Cell fill={theme.palette.error.main} /><Cell fill={theme.palette.info.main} />
                      </Pie>
                      <RTooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <Tooltip title="Abandoned carts divided by converted plus abandoned carts. Active carts are shown separately until they expire.">
                    <Chip label={`${data.abandonedCarts.rate}% abandoned`} color={data.abandonedCarts.rate > 70 ? 'error' : 'warning'} sx={{ mt: 1 }} />
                  </Tooltip>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Estimated value in expired carts {formatPrice(data.abandonedCarts.estimatedAbandonedValue || 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Current catalog prices · Active cart value {formatPrice(data.abandonedCarts.estimatedActiveValue || 0)}
                  </Typography>
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
                <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.trafficSources}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Bar dataKey="visits" fill={theme.palette.info.main} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <Table size="small">
                  <TableHead><TableRow>
                    <AnalyticsField name="0">Source</AnalyticsField>
                    <AnalyticsField name="1" align="right">Visitors</AnalyticsField>
                    <AnalyticsField name="2" align="right">Orders</AnalyticsField>
                    <AnalyticsField name="3" align="right">Conversion</AnalyticsField>
                    <AnalyticsField name="4" align="right">Revenue</AnalyticsField>
                  </TableRow></TableHead>
                  <TableBody>{data.trafficSources.map((row) => (
                    <TableRow key={row.source}>
                      <AnalyticsField name="0">{row.source}</AnalyticsField>
                      <AnalyticsField name="1" align="right">{row.visitors}</AnalyticsField>
                      <AnalyticsField name="2" align="right">{row.orders}</AnalyticsField>
                      <AnalyticsField name="3" align="right">{row.conversionRate}%</AnalyticsField>
                      <AnalyticsField name="4" align="right">{formatPrice(row.revenue)}</AnalyticsField>
                    </TableRow>
                  ))}</TableBody>
                </Table>
                </>
              ) : <Typography color="text.secondary">No traffic data yet.</Typography>
            )}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="landingPages" item xs={12}>
          <Paper sx={{ p: 3, overflowX: 'auto' }} elevation={0}>
            <SectionHeader title="Landing Page Performance" metric="landing-pages" params={{ ...qp, limit: 20 }} />
            {loading ? <CardSkeleton /> : data.landingPages?.length ? (
              <Table size="small" sx={{ minWidth: 650 }}>
                <TableHead><TableRow>
                  <AnalyticsField name="0">Landing page</AnalyticsField>
                  <AnalyticsField name="1" align="right">Visitors</AnalyticsField>
                  <AnalyticsField name="2" align="right">Orders</AnalyticsField>
                  <AnalyticsField name="3" align="right">Conversion</AnalyticsField>
                  <AnalyticsField name="4" align="right">Revenue</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.landingPages.map((row) => (
                  <TableRow key={row.path}>
                    <AnalyticsField name="0">{row.path}</AnalyticsField>
                    <AnalyticsField name="1" align="right">{row.visitors}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.orders}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{row.conversionRate}%</AnalyticsField>
                    <AnalyticsField name="4" align="right">{formatPrice(row.revenue)}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No landing page data for this period.</Typography>}
          </Paper>
        </AnalyticsWidget>

        <AnalyticsWidget metric="devicePerformance" item xs={12} md={6}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <SectionHeader title="Device Performance" metric="devices" params={{ ...qp, limit: 10 }} />
            {loading ? <CardSkeleton /> : data.devicePerformance?.length ? (
              <Table size="small">
                <TableHead><TableRow>
                  <AnalyticsField name="0">Device</AnalyticsField>
                  <AnalyticsField name="1" align="right">Page views</AnalyticsField>
                  <AnalyticsField name="2" align="right">Visitors</AnalyticsField>
                  <AnalyticsField name="3" align="right">Orders</AnalyticsField>
                  <AnalyticsField name="4" align="right">Conversion</AnalyticsField>
                  <AnalyticsField name="5" align="right">Revenue</AnalyticsField>
                </TableRow></TableHead>
                <TableBody>{data.devicePerformance.map((row) => (
                  <TableRow key={row.device}>
                    <AnalyticsField name="0">{row.device}</AnalyticsField>
                    <AnalyticsField name="1" align="right">{row.pageViews}</AnalyticsField>
                    <AnalyticsField name="2" align="right">{row.visitors}</AnalyticsField>
                    <AnalyticsField name="3" align="right">{row.orders}</AnalyticsField>
                    <AnalyticsField name="4" align="right">{row.conversionRate}%</AnalyticsField>
                    <AnalyticsField name="5" align="right">{formatPrice(row.revenue)}</AnalyticsField>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Typography color="text.secondary">No device data for this period.</Typography>}
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
                <CohortHeatmap data={data.cohortRetention} formatPrice={formatPrice} />
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
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save analytics view</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="View name" value={savedViewName}
            onChange={(event) => setSavedViewName(event.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveCurrentView} disabled={!savedViewName.trim()}>Save</Button>
        </DialogActions>
      </Dialog>
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
    (id !== 'shippingPerformance' || features.shipping === true) &&
    (id !== 'couponPerformance' || features.coupons === true) &&
    (id !== 'clv' || hasPermission(PERMISSIONS.CUSTOMERS_READ))) : CATALOG_ANALYTICS_WIDGETS;
  const storageKey = `analytics-display:${user?.id || 'staff'}:${mode}:${sales ? 'sales' : 'catalog'}`;
  return <AnalyticsDisplayProvider key={storageKey} storageKey={storageKey} widgets={widgets}>
    {sales ? <SalesAnalyticsPage userId={user?.id} /> : <CatalogAnalytics />}
  </AnalyticsDisplayProvider>;
};

export default AnalyticsPage;
