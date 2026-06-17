import { useState, useContext } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, ToggleButtonGroup, ToggleButton, FormControlLabel, Switch } from '@mui/material';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import TabletMacIcon from '@mui/icons-material/TabletMac';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import StorefrontTemplatePreview from './StorefrontTemplatePreview';
import { SettingsContext } from '../../../context/ThemeContext';

const ThemePreviewModal = ({ open, onClose, packageData, onApply }) => {
  const [mode, setMode] = useState('desktop');
  const [compare, setCompare] = useState(false);
  const { settings } = useContext(SettingsContext) || {};

  if (!packageData) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <span>Preview: {packageData.meta?.name}</span>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={<Switch size="small" checked={compare} onChange={(e) => setCompare(e.target.checked)} />}
            label="Compare"
            sx={{ mr: 0 }}
          />
          <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)} size="small">
            <ToggleButton value="desktop" aria-label="Desktop"><DesktopWindowsIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="tablet" aria-label="Tablet"><TabletMacIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="mobile" aria-label="Mobile"><PhoneIphoneIcon fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, overflow: 'auto', bgcolor: '#f5f5f5' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
          <StorefrontTemplatePreview
            packageData={packageData}
            mode={mode}
            currentSettings={compare ? settings : null}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={() => onApply(packageData)}>Install Template</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThemePreviewModal;
