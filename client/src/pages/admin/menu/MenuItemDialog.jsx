import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { needsTarget, needsUrl } from './constants';

const MenuItemDialog = ({
  open,
  onClose,
  editingItem,
  itemForm,
  setItemForm,
  parentOptions,
  targetOptions,
  placementOptions,
  onSave,
  selectedMenu,
}) => {

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={4} mt={1}>
          {/* Section 1: Identity & Hierarchy */}
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 2, fontWeight: 700, letterSpacing: 1.2 }}>
              Identity & Hierarchy
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Label"
                  placeholder="e.g. Shop All"
                  value={itemForm.label}
                  onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Parent Item</InputLabel>
                  <Select
                    label="Parent Item"
                    value={itemForm.parentId || ''}
                    onChange={(e) => setItemForm({ ...itemForm, parentId: e.target.value })}
                  >
                    <MenuItem value=""><em>None (Root level)</em></MenuItem>
                    {parentOptions.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.displayLabel}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Section 2: Navigation Target */}
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 2, fontWeight: 700, letterSpacing: 1.2 }}>
              Navigation Target
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Link Type</InputLabel>
                  <Select
                    label="Link Type"
                    value={itemForm.targetType}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        targetType: e.target.value,
                        targetId: '',
                        url: '',
                        openInNewTab: false,
                      })
                    }
                  >
                    <MenuItem value="none">Label Only (Category Header)</MenuItem>
                    <MenuItem value="custom_url">Custom URL</MenuItem>
                    <MenuItem value="system_route">System Route</MenuItem>
                    <MenuItem value="page">Static Page</MenuItem>
                    <MenuItem value="category">Category</MenuItem>
                    <MenuItem value="product">Product</MenuItem>
                    <MenuItem value="collection">Collection</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {needsTarget(itemForm.targetType) && (
                <Grid item xs={12} md={8}>
                  <FormControl fullWidth>
                    <InputLabel>Select Target</InputLabel>
                    <Select
                      label="Select Target"
                      value={itemForm.targetId || ''}
                      onChange={(e) => setItemForm({ ...itemForm, targetId: e.target.value })}
                    >
                      <MenuItem value=""><em>Choose an option...</em></MenuItem>
                      {targetOptions.map((target) => (
                        <MenuItem key={target.id} value={target.id}>
                          {target.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {needsUrl(itemForm.targetType) && (
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label={itemForm.targetType === 'system_route' ? 'Route Path' : 'URL'}
                    placeholder={
                      itemForm.targetType === 'system_route'
                        ? '/products'
                        : 'https://example.com or /internal-path'
                    }
                    value={itemForm.url || ''}
                    onChange={(e) => setItemForm({ ...itemForm, url: e.target.value })}
                  />
                </Grid>
              )}
            </Grid>
          </Box>

          <Divider />

          {/* Section 3: Display & Visibility */}
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 2, fontWeight: 700, letterSpacing: 1.2 }}>
              Display & Visibility
            </Typography>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Placement</InputLabel>
                  <Select
                    label="Placement"
                    value={itemForm.placement}
                    onChange={(e) => setItemForm({ ...itemForm, placement: e.target.value })}
                  >
                    {placementOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', px: 1 }}>
                    {selectedMenu?.location === 'header' 
                      ? 'Controls whether this appears in main nav or utilities.'
                      : selectedMenu?.location === 'footer'
                      ? 'Groups items into columns in the footer.'
                      : 'Determines the visual grouping in the sidebar.'}
                  </Typography>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  type="number"
                  label="Sort Order"
                  value={itemForm.sortOrder ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItemForm({ 
                      ...itemForm, 
                      sortOrder: val === '' ? '' : parseInt(val, 10) 
                    });
                  }}
                />
              </Grid>

              <Grid item xs={6} md={3}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Switch
                    checked={itemForm.isVisible}
                    onChange={(e) => setItemForm({ ...itemForm, isVisible: e.target.checked })}
                  />
                  <Typography variant="body2">Visible to Public</Typography>
                </Stack>
              </Grid>
              {needsUrl(itemForm.targetType) && (
                <Grid item xs={6} md={3}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Switch
                      checked={itemForm.openInNewTab}
                      onChange={(e) => setItemForm({ ...itemForm, openInNewTab: e.target.checked })}
                    />
                    <Typography variant="body2">Open in New Tab</Typography>
                  </Stack>
                </Grid>
              )}
            </Grid>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} size="large" sx={{ px: 4 }}>
          {editingItem ? 'Save Changes' : 'Add Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MenuItemDialog;
