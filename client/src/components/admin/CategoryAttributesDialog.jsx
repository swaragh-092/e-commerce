import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Typography, Box, List, ListItem, ListItemText, ListItemIcon,
  IconButton, Chip, TextField, Autocomplete, Divider,
  Alert, CircularProgress, Tooltip, Stack, Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  AccountTree as AccountTreeIcon,
  Link as LinkIcon,
  Add as AddIcon,
  Info as InfoIcon,
  ChevronRight as ChevronRightIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

import attributeService from '../../services/attributeService';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/apiErrors';

const CategoryAttributesDialog = ({ open, onClose, categoryId, categoryName }) => {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attributes, setAttributes] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const fetchAttributes = useCallback(async () => {
    if (!categoryId) return;
    try {
      setLoading(true);
      const [linkedRes, allRes] = await Promise.all([
        attributeService.getCategoryAttributes(categoryId, true),
        attributeService.getAttributes({ page: 1, limit: 1000 })
      ]);
      setAttributes(linkedRes?.data?.data || []);
      setAllTemplates(allRes?.data?.data?.rows || allRes?.data?.data || []);
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [categoryId, notify]);

  useEffect(() => {
    if (open && categoryId) {
      fetchAttributes();
    }
  }, [open, categoryId, fetchAttributes]);

  const handleLink = async () => {
    if (!selectedTemplate) return;
    try {
      setSaving(true);
      await attributeService.linkAttributeToCategory(categoryId, { attributeId: selectedTemplate.id });
      notify('Attribute linked successfully', 'success');
      setSelectedTemplate(null);
      fetchAttributes();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (attributeId) => {
    try {
      setSaving(true);
      await attributeService.unlinkAttributeFromCategory(categoryId, attributeId);
      notify('Attribute unlinked successfully', 'success');
      fetchAttributes();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const isTemplateLinked = (templateId) => {
    return attributes.some(attr => attr.id === templateId);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Category Attributes</Typography>
          <Typography variant="body2" color="text.secondary">Manage attributes for <b>{categoryName}</b></Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, height: '500px' }}>
          {/* Left Side: Linked Attributes */}
          <Box sx={{ flex: 1, borderRight: { md: '1px solid' }, borderColor: 'divider', overflow: 'auto', p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinkIcon fontSize="small" color="primary" /> Linked Attributes
            </Typography>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
            ) : attributes.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
                <Typography variant="body2" color="text.secondary">No attributes linked to this category yet.</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {attributes.map((attr) => {
                  const directLink = attr.sources.find(s => s.id === categoryId);
                  const isInherited = !directLink;
                  
                  return (
                    <Paper key={attr.id} variant="outlined" sx={{ mb: 1.5, p: 1.5, position: 'relative', overflow: 'hidden' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body1" fontWeight={600}>{attr.name}</Typography>
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                            {attr.sources.map(source => (
                              <Chip 
                                key={source.id}
                                size="small"
                                icon={source.id === categoryId ? <LinkIcon sx={{ fontSize: 14 }} /> : <AccountTreeIcon sx={{ fontSize: 14 }} />}
                                label={source.id === categoryId ? 'Direct' : `From ${source.name}`}
                                variant={source.id === categoryId ? 'filled' : 'outlined'}
                                color={source.id === categoryId ? 'primary' : 'default'}
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            ))}
                          </Stack>
                        </Box>
                        {!isInherited && (
                          <Tooltip title="Unlink Attribute">
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={() => handleUnlink(attr.id)}
                              disabled={saving}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                      
                      <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(attr.values || []).slice(0, 5).map(v => (
                          <Typography key={v.id} variant="caption" sx={{ bgcolor: 'action.hover', px: 0.8, py: 0.2, borderRadius: 0.5, border: '1px solid', borderColor: 'divider' }}>
                            {v.value}
                          </Typography>
                        ))}
                        {(attr.values || []).length > 5 && (
                          <Typography variant="caption" color="text.secondary">+{attr.values.length - 5} more</Typography>
                        )}
                      </Box>
                    </Paper>
                  );
                })}
              </List>
            )}
          </Box>

          {/* Right Side: Link New Attribute */}
          <Box sx={{ width: { md: '300px' }, p: 2, bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AddIcon fontSize="small" color="success" /> Link New Attribute
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
              Linking an attribute template makes its values available to all products in this category.
            </Alert>

            <Autocomplete
              size="small"
              options={allTemplates.filter(t => !isTemplateLinked(t.id))}
              getOptionLabel={(option) => option.name}
              value={selectedTemplate}
              onChange={(_, val) => setSelectedTemplate(val)}
              renderInput={(params) => <TextField {...params} label="Select Template" variant="outlined" />}
              sx={{ mb: 2 }}
            />

            <Button
              variant="contained"
              fullWidth
              startIcon={<LinkIcon />}
              disabled={!selectedTemplate || saving}
              onClick={handleLink}
            >
              {saving ? <CircularProgress size={20} color="inherit" /> : 'Link Template'}
            </Button>

            <Box sx={{ mt: 4 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon sx={{ fontSize: 12 }} /> <b>Tip:</b> Attributes linked to parent categories are automatically inherited.
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CategoryAttributesDialog;
