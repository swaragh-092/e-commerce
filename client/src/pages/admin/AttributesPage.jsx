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

// ─── Attribute Values Inline Panel ───────────────────────────────────────────
const ValuesPanel = ({ attribute, onRefresh }) => {
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    try {
      setSaving(true);
      await attributeService.addAttributeValue(attribute.id, { value: newValue.trim() });
      setNewValue('');
      onRefresh();
    } catch (err) {
      alert(err?.response?.data?.error?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (valueId) => {
    if (!window.confirm('Remove this value?')) return;
    try {
      await attributeService.removeAttributeValue(attribute.id, valueId);
      onRefresh();
    } catch (err) {
      alert(err?.response?.data?.error?.message || err.message);
    }
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" gutterBottom>Values</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {(attribute.values || []).length === 0 && (
          <Typography variant="body2" color="text.secondary">No values yet.</Typography>
        )}
        {(attribute.values || []).map((v) => (
          <Chip
            key={v.id}
            label={v.value}
            size="small"
            onDelete={() => handleRemove(v.id)}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="New value…"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ width: 220 }}
        />
        <Button variant="outlined" size="small" onClick={handleAdd} disabled={saving || !newValue.trim()}>
          Add
        </Button>
      </Box>
    </Box>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AttributesPage = () => {
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', type: 'select', isRequired: false });

  const fetchAttributes = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await attributeService.getAttributes({ page: 1, limit: 100 });
      setAttributes(res?.data?.data?.rows || res?.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to load attributes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  // ─── Dialog handlers ────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', type: 'select', isRequired: false });
    setDialogOpen(true);
  };

  const openEdit = (attr) => {
    setEditing(attr);
    setFormData({ name: attr.name, type: attr.type || 'select', isRequired: attr.isRequired || false });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await attributeService.updateAttribute(editing.id, formData);
      } else {
        await attributeService.createAttribute(formData);
      }
      handleDialogClose();
      fetchAttributes();
    } catch (err) {
      alert(err?.response?.data?.error?.message || err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this attribute template? This will also remove all its values and category links.')) return;
    try {
      await attributeService.deleteAttribute(id);
      fetchAttributes();
    } catch (err) {
      alert(err?.response?.data?.error?.message || err.message);
    }
  };

  const toggleExpanded = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Attribute Templates</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New Attribute
        </Button>
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
              <TableRow sx={{ bgcolor: 'grey.100' }}>
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
              {attributes.map((attr) => (
                <React.Fragment key={attr.id}>
                  <TableRow hover>
                    <TableCell>{attr.name}</TableCell>
                    <TableCell>
                      <Chip label={attr.type || 'select'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="text"
                        endIcon={expanded[attr.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        onClick={() => toggleExpanded(attr.id)}
                      >
                        {(attr.values || []).length} value{(attr.values || []).length !== 1 ? 's' : ''}
                      </Button>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(attr)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(attr.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                      <Collapse in={!!expanded[attr.id]} unmountOnExit>
                        <ValuesPanel attribute={attr} onRefresh={fetchAttributes} />
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? 'Edit Attribute' : 'New Attribute'}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            sx={{ mb: 2 }}
            autoFocus
          />
          <TextField
            label="Type"
            fullWidth
            select
            SelectProps={{ native: true }}
            value={formData.type}
            onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="select">Select (dropdown)</option>
            <option value="multiselect">Multi-select</option>
            <option value="text">Text (free input)</option>
            <option value="boolean">Boolean (yes/no)</option>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!formData.name.trim()}>
            {editing ? 'Save Changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttributesPage;
