import { useEffect, useState } from 'react';
import { Alert, Box, Button, Grid, MenuItem, Paper, Select, Skeleton, Table, TableBody, TableHead, TableRow, Typography } from '@mui/material';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getCatalogOverview } from '../../../services/adminService';
import { CATALOG_ANALYTICS_WIDGETS } from '../../../utils/analyticsWidgets';
import { AnalyticsCustomizeButton, AnalyticsField, AnalyticsWidget, useAnalyticsDisplay } from './AnalyticsCustomization';

const PERIODS = [['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['12m', '12 months']];
const formatCount = (value) => Number(value || 0).toLocaleString();

const ReportTable = ({ metric, rows, values }) => {
  const fields = CATALOG_ANALYTICS_WIDGETS.find(({ id }) => id === metric).fields;
  if (!rows?.length) return <Typography color="text.secondary">No activity recorded for this period.</Typography>;
  return <Box sx={{ overflowX: 'auto' }}><Table size="small">
    <TableHead><TableRow>{fields.map(([id, label]) => <AnalyticsField key={id} name={id}>{label}</AnalyticsField>)}</TableRow></TableHead>
    <TableBody>{rows.map((row, index) => <TableRow key={row.id || index}>
      {values(row).map((value, column) => <AnalyticsField key={column} name={String(column)}>{value ?? '—'}</AnalyticsField>)}
    </TableRow>)}</TableBody>
  </Table></Box>;
};

export default function CatalogAnalytics() {
  const [period, setPeriod] = useState('30d');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ loading: true, data: null, error: '' });
  const { widgets, visible } = useAnalyticsDisplay();
  const hasVisibleCards = widgets.some(({ id }) => visible(id));
  useEffect(() => {
    let active = true;
    if (!hasVisibleCards) {
      setResult({ loading: false, data: null, error: '' });
      return () => { active = false; };
    }
    setResult({ loading: true, data: null, error: '' });
    getCatalogOverview({ period }).then((response) => {
      if (active) setResult({ loading: false, data: response.data.data, error: '' });
    }).catch(() => {
      if (active) setResult({ loading: false, data: null, error: 'Could not load analytics. Please try again.' });
    });
    return () => { active = false; };
  }, [period, retry, hasVisibleCards]);
  const { loading, data, error } = result;
  const reports = [
    ['topViews', 'Most viewed products', (row) => [row.name, formatCount(row.views)]],
    ['trafficSources', 'Traffic sources', (row) => [row.source, formatCount(row.visits)]],
    ['campaigns', 'Campaign visits', (row) => [row.source, row.medium, row.campaign, formatCount(row.visits)]],
  ];
  return <Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
      <Box><Typography component="h1" variant="h5" fontWeight={700}>Analytics</Typography>
        <Typography color="text.secondary" variant="body2">Understand how visitors find and explore your catalog.</Typography></Box>
      <Box sx={{ display: 'flex', gap: 1 }}><AnalyticsCustomizeButton />
        <Select size="small" value={period} onChange={(event) => setPeriod(event.target.value)} inputProps={{ 'aria-label': 'Analytics period' }}>
          {PERIODS.map(([value, label]) => <MenuItem value={value} key={value}>{label}</MenuItem>)}
        </Select>
      </Box>
    </Box>
    {error && <Alert severity="error" action={<Button onClick={() => setRetry((n) => n + 1)}>Retry</Button>} sx={{ mb: 2 }}>{error}</Alert>}
    {data?.trackingAvailable === false && <Alert severity="info" sx={{ mb: 2 }}>Visit tracking is not available yet. Analytics will appear once tracking is configured.</Alert>}
    {widgets.every(({ id }) => !visible(id)) && <Alert severity="info">All cards are hidden. Use Customize to choose cards or restore the defaults.</Alert>}
    {!error && <Grid container spacing={3}>
      {[['visits', 'Page views'], ['sessions', 'Sessions'], ['productViews', 'Product views']].map(([id, label]) => <AnalyticsWidget metric={id} item xs={12} sm={4} key={id}>
        <Paper elevation={0} sx={{ p: 3 }}><Typography color="text.secondary">{label}</Typography>
          {loading ? <Skeleton width="60%" height={40} /> : <Typography variant="h4" fontWeight={700}>{formatCount(data?.[id])}</Typography>}
          {id === 'sessions' && <Typography variant="caption" color="text.secondary">Distinct recorded session IDs</Typography>}
        </Paper>
      </AnalyticsWidget>)}
      <AnalyticsWidget metric="trend" item xs={12}>
        <Paper elevation={0} sx={{ p: 3 }}><Typography component="h2" variant="h6" sx={{ mb: 2 }}>Visits over time</Typography>
          {loading ? <Skeleton variant="rectangular" height={260} /> : data?.trend?.length ? <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="visits" name="Visits" stroke="currentColor" /></LineChart>
          </ResponsiveContainer> : <Typography color="text.secondary">No visits recorded for this period.</Typography>}
        </Paper>
      </AnalyticsWidget>
      {reports.map(([id, label, values]) => <AnalyticsWidget metric={id} item xs={12} lg={id === 'campaigns' ? 12 : 6} key={id}>
        <Paper elevation={0} sx={{ p: 3 }}><Typography component="h2" variant="h6" sx={{ mb: 2 }}>{label}</Typography>
          {loading ? <Skeleton variant="rectangular" height={200} /> : <ReportTable metric={id} rows={data?.[id]} values={values} />}
        </Paper>
      </AnalyticsWidget>)}
    </Grid>}
  </Box>;
}
