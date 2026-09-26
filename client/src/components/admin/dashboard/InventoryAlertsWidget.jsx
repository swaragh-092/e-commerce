import { useState } from 'react';
import {
  Alert, Box, Button, Chip, FormControl, MenuItem, Paper, Select, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { useNavigate } from 'react-router-dom';
import { updateInventoryAlert } from '../../../services/adminService';
import { useNotification } from '../../../context/NotificationContext';
import { PERMISSIONS } from '../../../utils/permissions';
import { getPanelSx } from './dashboardUtils';

const InventoryAlertActions = ({ alert, eligibleAssignees, canUpdate, onUpdated }) => {
  const { notify } = useNotification();
  const [assignedTo, setAssignedTo] = useState(alert.assignedTo || '');
  const [note, setNote] = useState(alert.note || '');
  const [restockDate, setRestockDate] = useState(alert.expectedRestockAt ? new Date(alert.expectedRestockAt).toISOString().slice(0, 10) : '');
  const [saving, setSaving] = useState(false);

  const save = async (status) => {
    setSaving(true);
    try {
      await updateInventoryAlert(alert.id, {
        assignedTo: assignedTo || null,
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
        <FormControl size="small" fullWidth disabled={!canUpdate}>
          <Select value={assignedTo} displayEmpty onChange={(event) => setAssignedTo(event.target.value)} aria-label="Assign inventory owner">
            <MenuItem value=""><em>Choose owner</em></MenuItem>
            {eligibleAssignees.map((user) => <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="Expected restock" type="date" value={restockDate} disabled={!canUpdate} onChange={(event) => setRestockDate(event.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" label="Owner note" value={note} disabled={!canUpdate} onChange={(event) => setNote(event.target.value)} inputProps={{ maxLength: 1000 }} />
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="contained" disabled={!canUpdate || !assignedTo || saving} onClick={() => save('acknowledged')}>
            {saving ? 'Saving…' : alert.status === 'acknowledged' ? 'Save update' : 'Assign & acknowledge'}
          </Button>
          {alert.status === 'acknowledged' && <Button size="small" disabled={!canUpdate || saving} onClick={() => save('open')}>Reopen</Button>}
        </Stack>
      </Stack>
    </TableCell>
  );
};

const InventoryAlertsWidget = ({ lowStock = [], inventoryAlerts, loading, spacing, stats, hasAnyPermission, onInventoryAlertUpdated }) => {
  const navigate = useNavigate();
  const rows = inventoryAlerts?.rows || lowStock;
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
        <Table size="small" sx={{ minWidth: inventoryAlerts ? 980 : 400 }}>
          <TableHead><TableRow>
            <TableCell>Product / SKU</TableCell><TableCell align="right">Total Qty</TableCell>
            <TableCell align="right">Reserved</TableCell><TableCell align="right">Available / Threshold</TableCell>
            {inventoryAlerts && <TableCell>Owner / follow-up</TableCell>}
          </TableRow></TableHead>
          <TableBody>
            {rows.map((alert) => {
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
                  {inventoryAlerts && <InventoryAlertActions alert={alert} eligibleAssignees={inventoryAlerts.eligibleAssignees || []} canUpdate={canUpdate} onUpdated={onInventoryAlertUpdated} />}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};

export default InventoryAlertsWidget;
