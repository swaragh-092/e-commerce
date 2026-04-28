import {
  Alert,
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { getPanelSx } from './dashboardUtils';

const LowStockWidget = ({ lowStock, loading, spacing }) => {
  if (lowStock.length === 0) {
    return !loading ? (
      <Alert severity="success" sx={{ borderRadius: 2 }}>
        All products have adequate stock levels.
      </Alert>
    ) : null;
  }

  return (
    <Paper elevation={0} sx={{ ...getPanelSx(spacing), height: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WarningIcon color="warning" />
        <Typography variant="h6" fontWeight={600}>Low Stock Alerts ({lowStock.length})</Typography>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Product</TableCell>
            <TableCell align="right">Total Qty</TableCell>
            <TableCell align="right">Reserved</TableCell>
            <TableCell align="right">Available</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lowStock.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell align="right">{product.quantity}</TableCell>
              <TableCell align="right">{product.reservedQty}</TableCell>
              <TableCell align="right">
                <Chip label={product.availableQty} size="small" color={product.availableQty <= 0 ? 'error' : 'warning'} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
};

export default LowStockWidget;
