import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment,
  Paper, TextField, Tooltip, Typography, Tabs, Tab, CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CategoryIcon, { CATEGORY_ICONS } from '../common/CategoryIcon';
import { mediaService } from '../../services/mediaService';
import MediaUploader from '../common/MediaUploader';

export default function CategoryIconPicker({ open, onClose, onSelect, onBrowseMedia }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'custom' | 'builtin'
  const [customIcons, setCustomIcons] = useState([]);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const fetchCustomIcons = useCallback(async () => {
    try {
      setLoadingCustom(true);
      const res = mediaService.listIcons
        ? await mediaService.listIcons({ limit: 100 })
        : await mediaService.list({ type: 'icon', limit: 100 });
      setCustomIcons(res?.data || []);
    } catch {
      // ignore
    } finally {
      setLoadingCustom(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchCustomIcons();
      setShowUpload(false);
    }
  }, [open, fetchCustomIcons]);

  const filteredBuiltIn = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return CATEGORY_ICONS;
    return CATEGORY_ICONS.filter(({ label, keywords }) => `${label} ${keywords}`.toLowerCase().includes(query));
  }, [search]);

  const filteredCustom = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customIcons;
    return customIcons.filter((icon) =>
      `${icon.originalName || ''} ${icon.filename || ''}`.toLowerCase().includes(query)
    );
  }, [customIcons, search]);

  const close = () => {
    setSearch('');
    setShowUpload(false);
    onClose();
  };

  const handleCustomUploadSuccess = (media) => {
    if (media?.url) {
      onSelect(media.url);
      close();
    }
  };

  const showCustomSection = (activeTab === 'all' || activeTab === 'custom') && filteredCustom.length > 0;
  const showBuiltInSection = (activeTab === 'all' || activeTab === 'builtin') && filteredBuiltIn.length > 0;
  const totalCount = filteredBuiltIn.length + filteredCustom.length;

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" component="span" fontWeight={700}>Choose a category icon</Typography>
          <Typography variant="body2" color="text.secondary">Pick a built-in icon, custom icon, or upload a new one.</Typography>
        </Box>
        <IconButton aria-label="Close icon picker" onClick={close}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {showUpload ? (
          <Box sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Upload Custom Icon</Typography>
              <Button size="small" onClick={() => setShowUpload(false)}>Back to icons</Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload a square PNG or WebP icon (transparent background recommended). It will be automatically selected for this category and saved to your icon library.
            </Typography>
            <MediaUploader
              onUploadSuccess={handleCustomUploadSuccess}
              multiple={false}
              autoUpload={true}
              uploadType="icon"
            />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center' }}>
              <TextField
                autoFocus
                fullWidth
                size="small"
                placeholder="Search icons"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                inputProps={{ 'aria-label': 'Search built-in category icons' }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloudUploadIcon />}
                onClick={() => setShowUpload(true)}
                sx={{ whiteSpace: 'nowrap', py: 0.9 }}
              >
                Upload
              </Button>
            </Box>

            <Tabs
              value={activeTab}
              onChange={(_, val) => setActiveTab(val)}
              sx={{ mb: 2, minHeight: 36, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label={`All (${totalCount})`} value="all" sx={{ minHeight: 36, py: 0.5 }} />
              <Tab label={`Custom (${filteredCustom.length})`} value="custom" sx={{ minHeight: 36, py: 0.5 }} />
              <Tab label={`Built-in (${filteredBuiltIn.length})`} value="builtin" sx={{ minHeight: 36, py: 0.5 }} />
            </Tabs>

            {loadingCustom && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {totalCount > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxHeight: 380, overflowY: 'auto', pr: 0.5 }}>
                {/* Custom Icons */}
                {showCustomSection && (
                  <Box>
                    {activeTab === 'all' && (
                      <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}>
                        Custom Icons ({filteredCustom.length})
                      </Typography>
                    )}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 1 }}>
                      {filteredCustom.map((icon) => (
                        <Tooltip key={icon.id} title={icon.originalName || icon.filename}>
                          <Paper
                            component="button"
                            type="button"
                            variant="outlined"
                            onClick={() => { onSelect(icon.url); close(); }}
                            aria-label={`Use ${icon.originalName || 'custom'} icon`}
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
                              p: 1,
                              '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'action.hover' },
                              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                            }}
                          >
                            <CategoryIcon value={icon.url} size={28} />
                            <Typography variant="caption" noWrap sx={{ maxWidth: '100%', fontSize: '0.7rem' }}>
                              {icon.originalName || 'Custom'}
                            </Typography>
                          </Paper>
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Built-in Icons */}
                {showBuiltInSection && (
                  <Box>
                    {activeTab === 'all' && (
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}>
                        Built-in Icons ({filteredBuiltIn.length})
                      </Typography>
                    )}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 1 }}>
                      {filteredBuiltIn.map(({ id, label }) => (
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
                              p: 1,
                              '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'action.hover' },
                              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                            }}
                          >
                            <CategoryIcon value={`mui:${id}`} size={26} />
                            <Typography variant="caption" noWrap sx={{ maxWidth: '100%', fontSize: '0.7rem' }}>{label}</Typography>
                          </Paper>
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            ) : (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No icons match “{search}”.</Typography>
            )}

            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">Looking for general media images?</Typography>
              <Button variant="outlined" size="small" onClick={() => { close(); onBrowseMedia(); }}>Browse media library</Button>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
