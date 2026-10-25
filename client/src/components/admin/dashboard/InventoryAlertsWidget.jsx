import { useState } from 'react';
import {
  Alert, Box, Button, Chip, Paper, Stack, Table, TableBody, TableCell,
  TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { useNavigate } from 'react-router-dom';
import { updateInventoryAlert } from '../../../services/adminService';
import { useNotification } from '../../../context/NotificationContext';
import { PERMISSIONS } from '../../../utils/permissions';
import { getPanelSx } from './dashboardUtils';

const InventoryAlertActions = ({ alert, canUpdate, onUpdated, draft, onDraftChange }) => {
  const { notify } = useNotification();
  const note = draft?.note ?? alert.note ?? '';
  const restockDate = draft?.restockDate ?? (alert.expectedRestockAt ? new Date(alert.expectedRestockAt).toISOString().slice(0, 10) : '');
  const [saving, setSaving] = useState(false);

  const save = async (status) => {
    setSaving(true);
    try {
      await updateInventoryAlert(alert.id, {
        status,
        note,
        expectedRestockAt: restockDate ? new Date(`${restockDate}T12:00:00`).toISOString() : null,
      });
      await onUpdated?.();
    } catch (error) {
      notify(error.response?.data?.error?.message || 'Unable to update this inventory alert.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableCell onClick={(event) => event.stopPropagation()}>
      <Stack spacing={1} sx={{ minWidth: 240 }}>
        <TextField size="small" label="Expected restock" type="date" value={restockDate} disabled={!canUpdate} onChange={(event) => onDraftChange({ restockDate: event.target.value })} InputLabelProps={{ shrink: true }} />
        <TextField size="small" label="Follow-up note" value={note} disabled={!canUpdate} onChange={(event) => onDraftChange({ note: event.target.value })} inputProps={{ maxLength: 1000 }} />
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="contained" disabled={!canUpdate || saving} onClick={() => save('acknowledged')}>
            {saving ? 'Saving…' : alert.status === 'acknowledged' ? 'Save update' : 'Acknowledge'}
          </Button>
          {alert.status === 'acknowledged' && <Button size="small" disabled={!canUpdate || saving} onClick={() => save('open')}>Reopen</Button>}
        </Stack>
      </Stack>
    </TableCell>
  );
};

const InventoryAlertsWidget = ({ lowStock = [], inventoryAlerts, loading, spacing, stats, hasAnyPermission, onInventoryAlertUpdated }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [followUpDrafts, setFollowUpDrafts] = useState({});
  const rows = inventoryAlerts?.rows || lowStock;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1));
  const visibleRows = rows.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);
  const totalAtRisk = Number(inventoryAlerts?.totalCount ?? stats?.inventory?.totalAtRisk ?? stats?.lowStockCount ?? rows.length);
  const outOfStockCount = Number(inventoryAlerts?.outOfStockCount ?? stats?.inventory?.outOfStockCount ?? stats?.outOfStockCount ?? rows.filter((item) => item.availableQty <= 0).length);
  const canUpdate = typeof hasAnyPermission === 'function' && hasAnyPermission([PERMISSIONS.PRODUCTS_UPDATE]);

  if (totalAtRisk === 0 && rows.length === 0) {
    return !loading ? <Alert severity="success" sx={{ borderRadius: 2 }}>All published products and active variants have adequate available stock.</Alert> : null;
  }

  return (
    <Paper elevation={0} sx={{ ...getPanelSx(spacing), height: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WarningIcon color="warning" />
        <Typography variant="h6" fontWeight={600}>Inventory Alerts ({totalAtRisk})</Typography>
      </Box>
      {outOfStockCount > 0 && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{outOfStockCount} item{outOfStockCount === 1 ? '' : 's'} out of stock.</Alert>}
      {inventoryAlerts && rows.length < totalAtRisk && <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>Showing the first {rows.length} of {totalAtRisk} inventory alerts.</Alert>}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Inventory alerts" sx={{ minWidth: inventoryAlerts ? 820 : 400 }}>
          <TableHead><TableRow>
            <TableCell>Product / SKU</TableCell><TableCell align="right">Total Qty</TableCell>
            <TableCell align="right">Reserved</TableCell><TableCell align="right">Available / Threshold</TableCell>
            {inventoryAlerts && <TableCell>Follow-up</TableCell>}
          </TableRow></TableHead>
          <TableBody>
            {visibleRows.map((alert) => {
              const product = alert.product || alert;
              const productId = alert.productId || product.id;
              const availableQty = Number(alert.availableQty) || 0;
              const outOfStock = alert.severity === 'out_of_stock' || availableQty <= 0;
              return (
                <TableRow key={alert.inventoryKey || alert.id} hover onClick={() => navigate(`/admin/products/${productId}/edit`)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{product.name || alert.name}</Typography>
                    {(alert.sku || alert.variant?.sku || product.sku) && <Typography variant="caption" color="text.secondary">SKU: {alert.sku || alert.variant?.sku || product.sku}</Typography>}
                  </TableCell>
                  <TableCell align="right">{alert.quantity}</TableCell><TableCell align="right">{alert.reservedQty}</TableCell>
                  <TableCell align="right"><Chip label={`${outOfStock ? 'Out of stock' : availableQty} / ${alert.threshold ?? '—'}`} size="small" color={outOfStock ? 'error' : 'warning'} /></TableCell>
                  {inventoryAlerts && <InventoryAlertActions
                    alert={alert}
                    canUpdate={canUpdate}
                    onUpdated={onInventoryAlertUpdated}
                    draft={followUpDrafts[alert.id]}
                    onDraftChange={(changes) => setFollowUpDrafts((current) => ({
                      ...current,
                      [alert.id]: { ...current[alert.id], ...changes },
                    }))}
                  />}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      <TablePagination
        component="div"
        count={rows.length}
        page={currentPage}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
        showFirstButton
        showLastButton
        sx={{ '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', justifyContent: 'flex-end', px: 0 } }}
      />
    </Paper>
  );
};

export default InventoryAlertsWidget;
