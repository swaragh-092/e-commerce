import { createContext, useContext, useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, TableCell, Typography } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';

const DisplayContext = createContext(null);
const WidgetContext = createContext(null);
const emptyPreferences = () => ({ hiddenCards: [], hiddenFields: {} });

export const AnalyticsDisplayProvider = ({ storageKey, widgets, children }) => {
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved && Array.isArray(saved.hiddenCards) && saved.hiddenFields && typeof saved.hiddenFields === 'object'
        ? saved : emptyPreferences();
    } catch { return emptyPreferences(); }
  });
  const update = (next) => {
    setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Browser storage may be unavailable. */ }
  };
  const visible = (id) => widgets.some((widget) => widget.id === id) && !preferences.hiddenCards.includes(id);
  return <DisplayContext.Provider value={{ preferences, update, visible, widgets }}>{children}</DisplayContext.Provider>;
};

export const useAnalyticsDisplay = () => useContext(DisplayContext);

export const AnalyticsCustomizeButton = () => {
  const [open, setOpen] = useState(false);
  const { preferences, update, visible, widgets } = useAnalyticsDisplay();
  const toggleCard = (id) => update({ ...preferences, hiddenCards: visible(id)
    ? [...preferences.hiddenCards, id] : preferences.hiddenCards.filter((key) => key !== id) });
  const toggleField = (id, field) => {
    const hidden = Array.isArray(preferences.hiddenFields[id]) ? preferences.hiddenFields[id] : [];
    update({ ...preferences, hiddenFields: { ...preferences.hiddenFields,
      [id]: hidden.includes(field) ? hidden.filter((key) => key !== field) : [...hidden, field] } });
  };
  return <>
    <Button startIcon={<TuneIcon />} variant="outlined" onClick={() => setOpen(true)}>Customize</Button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Customize analytics</DialogTitle>
      <DialogContent dividers>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>Choose your cards and table fields. Choices are saved for your account in this browser, separately for each store mode.</Typography>
        <Typography color="text.secondary" variant="caption">The first table column stays visible to identify each row.</Typography>
        {widgets.map(({ id, label, fields = [] }) => <Box key={id} sx={{ mb: 2 }}>
          <FormControlLabel control={<Checkbox checked={visible(id)} onChange={() => toggleCard(id)} />} label={label} />
          {fields.length > 0 && <Box sx={{ pl: 4, display: 'flex', flexWrap: 'wrap' }}>
            {fields.map(([field, name], index) => <FormControlLabel key={field} label={name}
              control={<Checkbox size="small" disabled={!visible(id) || index === 0}
                inputProps={{ 'aria-label': `${label}: ${name}` }}
                checked={index === 0 || !preferences.hiddenFields[id]?.includes?.(field)} onChange={() => toggleField(id, field)} />} />)}
          </Box>}
        </Box>)}
      </DialogContent>
      <DialogActions><Button onClick={() => update(emptyPreferences())}>Restore defaults</Button><Button variant="contained" onClick={() => setOpen(false)}>Done</Button></DialogActions>
    </Dialog>
  </>;
};

export const AnalyticsWidget = ({ metric, children, component: Component = Grid, ...props }) => {
  const { visible } = useAnalyticsDisplay();
  if (!visible(metric)) return null;
  return <WidgetContext.Provider value={metric}><Component {...props}>{children}</Component></WidgetContext.Provider>;
};

export const AnalyticsField = ({ name, children, ...props }) => {
  const metric = useContext(WidgetContext);
  const { preferences, widgets } = useAnalyticsDisplay();
  const firstField = widgets.find((widget) => widget.id === metric)?.fields?.[0]?.[0];
  if (name !== firstField && preferences.hiddenFields[metric]?.includes?.(name)) return null;
  return <TableCell {...props}>{children}</TableCell>;
};
