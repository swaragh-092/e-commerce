import { Paper } from '@mui/material';
import SalesChart from '../SalesChart';
import { getPanelSx } from './dashboardUtils';

const SalesChartWidget = ({ defaultChartPeriod, spacing }) => (
  <Paper elevation={0} sx={getPanelSx(spacing)}>
    <SalesChart defaultPeriod={defaultChartPeriod} />
  </Paper>
);

export default SalesChartWidget;
