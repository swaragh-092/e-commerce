import React, { useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment,
  Paper, TextField, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import CategoryIcon, { CATEGORY_ICONS } from '../common/CategoryIcon';

export default function CategoryIconPicker({ open, onClose, onSelect, onBrowseMedia }) {
  const [search, setSearch] = useState('');
  const filteredIcons = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return CATEGORY_ICONS;
    return CATEGORY_ICONS.filter(({ label, keywords }) => `${label} ${keywords}`.toLowerCase().includes(query));
  }, [search]);

  const close = () => {
    setSearch('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" component="span" fontWeight={700}>Choose a category icon</Typography>
          <Typography variant="body2" color="text.secondary">Pick a built-in icon or use an image from your media library.</Typography>
        </Box>
        <IconButton aria-label="Close icon picker" onClick={close}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search icons"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          inputProps={{ 'aria-label': 'Search built-in category icons' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ mb: 2 }}
        />
        {filteredIcons.length ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 1 }}>
            {filteredIcons.map(({ id, label }) => (
              <Tooltip key={id} title={label}>
                <Paper
                  component="button"
                  type="button"
                  variant="outlined"
                  onClick={() => { onSelect(`mui:${id}`); close(); }}
                  aria-label={`Use ${label} icon`}
                  sx={{
                    minHeight: 76,
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    bgcolor: 'background.paper',
                    color: 'text.secondary',
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'action.hover' },
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                >
                  <CategoryIcon value={`mui:${id}`} size={26} />
                  <Typography variant="caption" noWrap sx={{ maxWidth: '100%' }}>{label}</Typography>
                </Paper>
              </Tooltip>
            ))}
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No icons match “{search}”.</Typography>
        )}
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">Your uploaded media can also be used as a category icon.</Typography>
          <Button variant="outlined" onClick={() => { close(); onBrowseMedia(); }}>Browse media library</Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
