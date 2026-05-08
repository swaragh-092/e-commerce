import React from 'react';
import {
  Button,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { locationHelp } from './constants';

const MenuSettings = ({
  selectedMenu,
  setSelectedMenu,
  canManage,
  saveSelectedMenu,
  deleteSelectedMenu,
}) => {
  if (!selectedMenu) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography color="text.secondary">Create a menu to begin.</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Name"
            value={selectedMenu.name || ''}
            disabled={!canManage}
            onChange={(e) => setSelectedMenu({ ...selectedMenu, name: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={2}>
          <TextField
            fullWidth
            label="Slug"
            value={selectedMenu.slug || ''}
            disabled={!canManage}
            onChange={(e) => setSelectedMenu({ ...selectedMenu, slug: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={2}>
          <FormControl fullWidth>
            <InputLabel>Location</InputLabel>
            <Select
              label="Location"
              value={selectedMenu.location || 'header'}
              disabled={!canManage}
              onChange={(e) => setSelectedMenu({ ...selectedMenu, location: e.target.value })}
            >
              <MenuItem value="header">Header</MenuItem>
              <MenuItem value="footer">Footer</MenuItem>
              <MenuItem value="mobile">Mobile</MenuItem>
              <MenuItem value="sidebar">Sidebar</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={2}>
          <FormControl fullWidth>
            <InputLabel>Alignment</InputLabel>
            <Select
              label="Alignment"
              value={selectedMenu.alignment || 'left'}
              disabled={!canManage}
              onChange={(e) => setSelectedMenu({ ...selectedMenu, alignment: e.target.value })}
            >
              <MenuItem value="left">Left</MenuItem>
              <MenuItem value="center">Center</MenuItem>
              <MenuItem value="right">Right</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={6} md={1.5}>
          <TextField
            fullWidth
            label="Order"
            type="number"
            value={selectedMenu.sortOrder || 0}
            disabled={!canManage}
            onChange={(e) => setSelectedMenu({ ...selectedMenu, sortOrder: Number(e.target.value) })}
          />
        </Grid>
        <Grid item xs={6} md={1.5}>
          <Stack direction="row" alignItems="center">
            <Switch
              checked={selectedMenu.isActive !== false}
              disabled={!canManage}
              onChange={(e) => setSelectedMenu({ ...selectedMenu, isActive: e.target.checked })}
            />
            <Typography>Active</Typography>
          </Stack>
        </Grid>
        <Grid item xs={12} md={2}>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={!canManage} onClick={saveSelectedMenu}>
              Save
            </Button>
            <IconButton
              color="error"
              disabled={!canManage}
              onClick={deleteSelectedMenu}
              aria-label="Delete menu"
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary">
            {locationHelp[selectedMenu.location] || locationHelp.header}
          </Typography>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default MenuSettings;
