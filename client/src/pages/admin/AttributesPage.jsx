import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, CircularProgress,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Collapse, Tooltip, Alert, Divider,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import attributeService from '../../services/attributeService';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useNotification } from '../../context/NotificationContext';

const ValuesPanel = ({ attribute, onRefresh, canManage }) => {
  const { notify } = useNotification();
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!canManage) return;
    if (!newValue.trim()) return;
    try {
      setSaving(true);
      await attributeService.addAttributeValue(attribute.id, { value: newValue.trim() });
      setNewValue('');
      onRefresh();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (valueId) => {
    if (!canManage) return;
    if (!window.confirm('Remove this value?')) return;
    try {
      await attributeService.removeAttributeValue(attribute.id, valueId);
      onRefresh();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    }
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" gutterBottom>Values</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {(attribute.values || []).length === 0 && (
          <Typography variant="body2" color="text.secondary">No values yet.</Typography>
        )}
        {(attribute.values || []).map((value) => (
          <Chip
            key={value.id}
            label={value.value}
            size="small"
            onDelete={canManage ? () => handleRemove(value.id) : undefined}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="New value…"
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
          sx={{ width: 220 }}
        />
        <Button variant="outlined" size="small" onClick={handleAdd} disabled={!canManage || saving || !newValue.trim()}>
          Add
        </Button>
      </Box>
    </Box>
  );
};

const AttributesPage = () => {
  const { hasPermission } = useAuth();
  const { notify } = useNotification();
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', type: 'select', isRequired: false });
  const canManageAttributes = hasPermission(PERMISSIONS.ATTRIBUTES_MANAGE);

  const fetchAttributes = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await attributeService.getAttributes({ page: 1, limit: 100 });
      setAttributes(response?.data?.data?.rows || response?.data?.data || []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load attributes'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const openCreate = () => {
    if (!canManageAttributes) return;
    setEditing(null);
    setFormData({ name: '', type: 'select', isRequired: false });
    setDialogOpen(true);
  };

  const openEdit = (attribute) => {
    if (!canManageAttributes) return;
    setEditing(attribute);
    setFormData({
      name: attribute.name,
      type: attribute.type || 'select',
      isRequired: attribute.isRequired || false,
    });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!canManageAttributes) return;
    try {
      if (editing) {
        await attributeService.updateAttribute(editing.id, formData);
      } else {
        await attributeService.createAttribute(formData);
      }
      handleDialogClose();
      fetchAttributes();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!canManageAttributes) return;
    if (!window.confirm('Delete this attribute template? This will also remove all its values and category links.')) return;
    try {
      await attributeService.deleteAttribute(id);
      fetchAttributes();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    }
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Attribute Templates</Typography>
        {canManageAttributes && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            New Attribute
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.paper' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Values</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {attributes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No attribute templates yet. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
              {attributes.map((attribute) => (
                <React.Fragment key={attribute.id}>
                  <TableRow hover>
                    <TableCell>{attribute.name}</TableCell>
                    <TableCell>
                      <Chip label={attribute.type || 'select'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="text"
                        endIcon={expanded[attribute.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        onClick={() => toggleExpanded(attribute.id)}
                      >
                        {(attribute.values || []).length} value{(attribute.values || []).length !== 1 ? 's' : ''}
                      </Button>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(attribute)} disabled={!canManageAttributes}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(attribute.id)} disabled={!canManageAttributes}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                      <Collapse in={!!expanded[attribute.id]} timeout="auto" unmountOnExit>
                        <ValuesPanel attribute={attribute} onRefresh={fetchAttributes} canManage={canManageAttributes} />
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? 'Edit Attribute' : 'New Attribute'}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="Name"
            fullWidth
            value={formData.name}
            onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
            sx={{ mb: 2 }}
            autoFocus
          />
          <TextField
            label="Type"
            fullWidth
            select
            SelectProps={{ native: true }}
            value={formData.type}
            onChange={(event) => setFormData((current) => ({ ...current, type: event.target.value }))}
          >
            <option value="select">Select (dropdown)</option>
            <option value="multiselect">Multi-select</option>
            <option value="text">Text (free input)</option>
            <option value="boolean">Boolean (yes/no)</option>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!canManageAttributes || !formData.name.trim()}>
            {editing ? 'Save Changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttributesPage;
