import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { locationHelp } from './constants';

const MenuDialog = ({ open, onClose, menuForm, setMenuForm, onSave }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Menu</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Name"
            value={menuForm.name}
            onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
          />
          <TextField
            label="Slug"
            helperText="Optional. Leave empty to generate."
            value={menuForm.slug || ''}
            onChange={(e) => setMenuForm({ ...menuForm, slug: e.target.value })}
          />
          <FormControl fullWidth>
            <InputLabel>Location</InputLabel>
            <Select
              label="Location"
              value={menuForm.location}
              onChange={(e) => setMenuForm({ ...menuForm, location: e.target.value })}
            >
              <MenuItem value="header">Header</MenuItem>
              <MenuItem value="footer">Footer</MenuItem>
              <MenuItem value="mobile">Mobile</MenuItem>
              <MenuItem value="sidebar">Sidebar</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Alignment</InputLabel>
            <Select
              label="Alignment"
              value={menuForm.alignment || 'left'}
              onChange={(e) => setMenuForm({ ...menuForm, alignment: e.target.value })}
            >
              <MenuItem value="left">Left</MenuItem>
              <MenuItem value="center">Center</MenuItem>
              <MenuItem value="right">Right</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary">
            {locationHelp[menuForm.location] || locationHelp.header}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MenuDialog;
