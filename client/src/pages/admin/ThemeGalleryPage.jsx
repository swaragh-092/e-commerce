import { useState, useEffect, useContext, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Button, Tab, Tabs, Grid, TextField, InputAdornment, CircularProgress, Stack, Chip, Paper, Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox, Divider, IconButton, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import HistoryIcon from '@mui/icons-material/History';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import themeService from '../../services/themeService';
import { useNotification } from '../../context/NotificationContext';
import { SettingsContext } from '../../context/ThemeContext';
import ThemeCard from '../../components/admin/themes/ThemeCard';
import ThemePreviewModal from '../../components/admin/themes/ThemePreviewModal';
import ThemeApplyDialog from '../../components/admin/themes/ThemeApplyDialog';
import ThemeImportDialog from '../../components/admin/themes/ThemeImportDialog';
import ThemeHistoryPanel from '../../components/admin/themes/ThemeHistoryPanel';
import ThemeDetailModal from '../../components/admin/themes/ThemeDetailModal';
import SaveAsTemplateDialog from '../../components/admin/themes/SaveAsTemplateDialog';
import SortIcon from '@mui/icons-material/Sort';
import { updateSettings } from '../../services/adminService';

// ─── localStorage helpers for favorites & recently viewed ────────────────────

const FAVORITES_KEY = 'themeGalleryFavorites';
const RECENT_KEY = 'themeGalleryRecent';

const loadFavorites = () => {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; }
  catch { return []; }
};
const saveFavorites = (slugs) => localStorage.setItem(FAVORITES_KEY, JSON.stringify(slugs));

const loadRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
  catch { return []; }
};
const pushRecent = (slug) => {
  if (!slug) return;
  const list = loadRecent().filter((s) => s !== slug);
  list.unshift(slug);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
};

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'food', label: 'Food' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'kids', label: 'Kids' },
  { value: 'books', label: 'Books' },
  { value: 'sports', label: 'Sports' },
  { value: 'handmade', label: 'Handmade' },
  { value: 'b2b', label: 'B2B' },
];

const getMeta = (template) => template.packageData?.meta || template.meta || template;

const formatSettingLabel = (group, key) => {
  const g = group.charAt(0).toUpperCase() + group.slice(1);
  const k = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[._]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return `${g} › ${k}`;
};

const renderValue = (val) => {
  if (val === null || val === undefined) return <Chip label="empty" size="small" variant="outlined" />;
  if (typeof val === 'boolean') {
    return <Chip label={val ? 'True' : 'False'} color={val ? 'primary' : 'default'} size="small" variant="outlined" />;
  }
  if (typeof val === 'string' && val.startsWith('#') && (val.length === 4 || val.length === 7)) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: val, border: '1px solid #ccc' }} />
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{val}</Typography>
      </Box>
    );
  }
  if (Array.isArray(val)) {
    return <Chip label={`Array (${val.length} items)`} size="small" variant="outlined" />;
  }
  if (typeof val === 'object') {
    return <Chip label="Object" size="small" variant="outlined" />;
  }
  return <Typography variant="body2">{String(val)}</Typography>;
};

const ThemeGalleryPage = () => {
  const [tab, setTab] = useState(0);
  const [builtinThemes, setBuiltinThemes] = useState([]);
  const [libraryThemes, setLibraryThemes] = useState([]);
  const [activations, setActivations] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [previewPkg, setPreviewPkg] = useState(null);
  const [applyPkg, setApplyPkg] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportOpts, setExportOpts] = useState({ includeHomepageSections: true, includeDemoContent: true, includeComponentStyles: true, includeSectionPresets: true });
  const [detailPkg, setDetailPkg] = useState(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [sortBy, setSortBy] = useState('featured');
  const { notify } = useNotification();
  const { settings, refreshSettings } = useContext(SettingsContext) || {};
  const [differences, setDifferences] = useState([]);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [recentSlugs, setRecentSlugs] = useState(loadRecent);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSlugs, setCompareSlugs] = useState([]);

  // Toggle a theme as favorite
  const toggleFavorite = useCallback((slug) => {
    setFavorites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      saveFavorites(next);
      return next;
    });
  }, []);

  // Track recently viewed when previewing
  const handlePreview = useCallback((pkg) => {
    const slug = pkg?.meta?.slug || pkg?.slug;
    if (slug) {
      pushRecent(slug);
      setRecentSlugs(loadRecent());
    }
    setPreviewPkg(pkg);
  }, []);

  // Toggle compare selection
  const toggleCompare = useCallback((slug) => {
    setCompareSlugs((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, slug];
    });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [builtin, library, history] = await Promise.all([
        themeService.getBuiltinThemes(),
        themeService.getLibraryThemes(),
        themeService.getActivations(),
      ]);
      setBuiltinThemes(builtin || []);
      setLibraryThemes(library?.themes || library || []);
      setActivations(history || []);
    } catch (e) {
      notify('Failed to load store templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!settings || !activations.length) {
      setDifferences([]);
      return;
    }
    const activeActivation = activations.find(a => !a.rolledBackAt);
    if (!activeActivation || !activeActivation.afterSnapshot) {
      setDifferences([]);
      return;
    }

    const diffs = [];
    const after = activeActivation.afterSnapshot;
    for (const [group, keys] of Object.entries(after)) {
      if (typeof keys !== 'object' || keys === null) continue;
      for (const [key, originalValue] of Object.entries(keys)) {
        const currentValue = settings[group]?.[key];
        if (JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
          diffs.push({
            group,
            key,
            originalValue,
            currentValue,
          });
        }
      }
    }
    setDifferences(diffs);
  }, [settings, activations]);

  const handleApply = async (packageData, scopes, replaceDemoContent) => {
    setActionLoading(true);
    try {
      await themeService.applyTheme(packageData, scopes, replaceDemoContent);
      notify('Store template installed successfully.', 'success');
      setApplyPkg(null);
      setPreviewPkg(null);
      if (refreshSettings) await refreshSettings();
      fetchData();
    } catch (e) {
      notify(e.response?.data?.message || 'Failed to install store template', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleImport = async (packageData) => {
    setActionLoading(true);
    try {
      await themeService.importTheme(packageData);
      notify('Template imported to your library.', 'success');
      setImportOpen(false);
      fetchData();
    } catch (e) {
      notify(e.response?.data?.message || 'Import failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const pkg = await themeService.exportTheme(exportOpts);
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (pkg.meta?.slug || 'store-template') + '-v' + (pkg.meta?.version || '1.0.0') + '.theme.json';
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch (e) {
      notify('Export failed', 'error');
    }
  };

  const handleRollback = async (activationId) => {
    setActionLoading(true);
    try {
      const result = await themeService.rollbackTheme(activationId);
      const conflictCount = Array.isArray(result?.rollbackConflicts) ? result.rollbackConflicts.length : 0;
      const dataSourceConflicts = Array.isArray(result?.dataSourceRollbackConflicts)
        ? result.dataSourceRollbackConflicts
        : [];
      const totalConflictCount = conflictCount + dataSourceConflicts.length;
      if (totalConflictCount) {
        const sourceNames = dataSourceConflicts
          .map((conflict) => conflict.slug || conflict.key)
          .filter(Boolean)
          .slice(0, 2)
          .join(', ');
        const detail = [
          conflictCount ? `${conflictCount} newer setting${conflictCount === 1 ? '' : 's'}` : null,
          dataSourceConflicts.length
            ? `${dataSourceConflicts.length} dynamic source${dataSourceConflicts.length === 1 ? '' : 's'}${sourceNames ? ` (${sourceNames})` : ''}`
            : null,
        ].filter(Boolean).join(' and ');
        notify(`Rollback completed; preserved ${detail}.`, 'warning');
      } else {
        notify('Template install rolled back successfully.', 'success');
      }
      if (refreshSettings) await refreshSettings();
      await fetchData();
    } catch (e) {
      notify(e.response?.data?.message || 'Rollback failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetSetting = async (group, key, originalValue) => {
    setActionLoading(true);
    try {
      await updateSettings([{ group, key, value: originalValue }]);
      notify(`Reset ${formatSettingLabel(group, key)} to original theme value.`, 'success');
      if (refreshSettings) await refreshSettings();
      await fetchData();
    } catch (e) {
      notify('Failed to reset setting', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetAllSettings = async () => {
    if (!differences.length) return;
    setActionLoading(true);
    try {
      const payload = differences.map(diff => ({
        group: diff.group,
        key: diff.key,
        value: diff.originalValue
      }));
      await updateSettings(payload);
      notify('All settings reset to the original theme values successfully.', 'success');
      if (refreshSettings) await refreshSettings();
      await fetchData();
    } catch (e) {
      notify('Failed to reset settings', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const filterTemplates = (templates) => {
    const q = search.trim().toLowerCase();
    return templates.filter((template) => {
      const meta = getMeta(template);
      const templateCategory = meta.category || 'general';
      const matchesCategory = category === 'all' || templateCategory === category;
      const matchesSearch = !q ||
        (meta.name || '').toLowerCase().includes(q) ||
        (meta.author || '').toLowerCase().includes(q) ||
        (meta.description || '').toLowerCase().includes(q) ||
        (meta.tags || []).some((tag) => tag.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  };

  let visibleBuiltin = filterTemplates(builtinThemes);
  let visibleLibrary = filterTemplates(libraryThemes);
  if (showFavoritesOnly) {
    visibleBuiltin = visibleBuiltin.filter((t) => favorites.includes(t.meta?.slug));
    visibleLibrary = visibleLibrary.filter((t) => favorites.includes(t.packageData?.meta?.slug || t.meta?.slug));
  }

  const sortTemplates = (list) => {
    if (sortBy === 'newest') return [...list].reverse();
    if (sortBy === 'name') return [...list].sort((a, b) => (getMeta(a).name || '').localeCompare(getMeta(b).name || ''));
    if (sortBy === 'sections') return [...list].sort((a, b) => ((b.packageData || b).layout?.homepageSections?.length || 0) - ((a.packageData || a).layout?.homepageSections?.length || 0));
    return list; // 'featured' = default order
  };

  const sortedBuiltin = sortTemplates(visibleBuiltin);
  const sortedLibrary = sortTemplates(visibleLibrary);
  const featuredTemplates = builtinThemes.slice(0, 3);
  const activeTemplateSlug = activations.find(a => !a.rolledBackAt)?.themeName || null;
  const activeActivation = activations.find(a => !a.rolledBackAt);
  const groupedDiffs = differences.reduce((acc, diff) => {
    if (!acc[diff.group]) acc[diff.group] = [];
    acc[diff.group].push(diff);
    return acc;
  }, {});

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight={800}>Store Templates</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
            Install launch-ready storefront blueprints. Templates can apply brand design, layout styling, homepage structure, demo content, and rollback history without touching custom code.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button component={RouterLink} to="/admin/store-designer" variant="contained">Customize Store</Button>
          <Button startIcon={<FileUploadIcon />} variant="outlined" onClick={() => setImportOpen(true)}>Import Template</Button>
          <Button startIcon={<FileDownloadIcon />} variant="outlined" onClick={() => setExportOpen(true)}>Export Current</Button>
          <Button variant="outlined" onClick={() => setSaveTemplateOpen(true)}>Save as Template</Button>
        </Box>
      </Box>

      {(tab === 0 || tab === 1) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <TextField
              size="small"
              placeholder="Search templates by industry, tag, or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: { xs: '100%', md: 360 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {CATEGORIES.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  clickable
                  color={category === item.value ? 'primary' : 'default'}
                  variant={category === item.value ? 'filled' : 'outlined'}
                  onClick={() => setCategory(item.value)}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>
      )}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
        <Tab label={'Built-in Templates (' + builtinThemes.length + ')'} />
        <Tab label={'My Templates (' + libraryThemes.length + ')'} />
        <Tab label={'Install History (' + activations.length + ')'} />
        <Tab label={'Theme Drafts & Compare' + (differences.length > 0 ? ` (${differences.length})` : '')} />
      </Tabs>

      {/* Recently Viewed */}
      {tab === 0 && !search && category === 'all' && recentSlugs.length > 0 && (() => {
        const recentTemplates = recentSlugs
          .map((slug) => builtinThemes.find((t) => t.meta?.slug === slug))
          .filter(Boolean);
        if (!recentTemplates.length) return null;
        return (
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <HistoryIcon fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={800}>Recently Viewed</Typography>
            </Stack>
            <Grid container spacing={2}>
              {recentTemplates.map((template) => (
                <Grid item xs={12} sm={6} md={3} key={'recent-' + template.meta?.slug}>
                  <ThemeCard
                    theme={template}
                    onPreview={handlePreview}
                    onApply={setApplyPkg}
                    onDetail={setDetailPkg}
                    isActive={activeTemplateSlug === (getMeta(template).name)}
                    isFavorite={favorites.includes(template.meta?.slug)}
                    onToggleFavorite={() => toggleFavorite(template.meta?.slug)}
                  />
                </Grid>
              ))}
            </Grid>
            <Divider sx={{ mt: 3 }} />
          </Box>
        );
      })()}

      {/* Featured Row */}
      {tab === 0 && !search && category === 'all' && featuredTemplates.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>⭐ Featured Templates</Typography>
          <Grid container spacing={2.5}>
            {featuredTemplates.map((template) => (
              <Grid item xs={12} sm={6} md={4} key={'feat-' + (template.meta?.slug || '')}>
                <ThemeCard
                  theme={template}
                  onPreview={handlePreview}
                  onApply={setApplyPkg}
                  onDetail={setDetailPkg}
                  isActive={activeTemplateSlug === (getMeta(template).name)}
                  isFavorite={favorites.includes(template.meta?.slug)}
                  onToggleFavorite={() => toggleFavorite(template.meta?.slug)}
                />
              </Grid>
            ))}
          </Grid>
          <Divider sx={{ mt: 3 }} />
        </Box>
      )}

      {/* Sorting & Favorites filter */}
      {(tab === 0 || tab === 1) && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
          <SortIcon fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary">Sort:</Typography>
          {[{ value: 'featured', label: 'Featured' }, { value: 'newest', label: 'Newest' }, { value: 'name', label: 'Name' }, { value: 'sections', label: 'Most Sections' }].map((opt) => (
            <Chip key={opt.value} label={opt.label} size="small" clickable variant={sortBy === opt.value ? 'filled' : 'outlined'} color={sortBy === opt.value ? 'primary' : 'default'} onClick={() => setSortBy(opt.value)} />
          ))}
          <Box sx={{ flex: 1 }} />
          <Chip
            icon={showFavoritesOnly ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            label={showFavoritesOnly ? 'Favorites Only' : 'All Themes'}
            size="small"
            clickable
            color={showFavoritesOnly ? 'error' : 'default'}
            variant={showFavoritesOnly ? 'filled' : 'outlined'}
            onClick={() => setShowFavoritesOnly((v) => !v)}
          />
          <Chip
            icon={<CompareArrowsIcon />}
            label={compareMode ? `Compare (${compareSlugs.length})` : 'Compare'}
            size="small"
            clickable
            color={compareMode ? 'primary' : 'default'}
            variant={compareMode ? 'filled' : 'outlined'}
            onClick={() => { setCompareMode((v) => !v); if (compareMode) setCompareSlugs([]); }}
          />
        </Stack>
      )}

      {tab === 0 && (
        <Grid container spacing={2.5}>
          {sortedBuiltin.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.meta?.slug}>
              <ThemeCard theme={template} onPreview={setPreviewPkg} onApply={setApplyPkg} onDetail={setDetailPkg} isActive={activeTemplateSlug === (getMeta(template).name)} />
            </Grid>
          ))}
          {visibleBuiltin.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary">No built-in templates match this search or category.</Typography>
            </Grid>
          )}
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={2.5}>
          {sortedLibrary.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <ThemeCard theme={template} onPreview={(pkg) => setPreviewPkg(pkg || template.packageData)} onApply={(pkg) => setApplyPkg(pkg || template.packageData)} onDetail={(pkg) => setDetailPkg(pkg || template.packageData)} isActive={activeTemplateSlug === (getMeta(template).name)} />
            </Grid>
          ))}
          {libraryThemes.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary">No saved templates yet. Import a .theme.json file or export your current store as a reusable template.</Typography>
            </Grid>
          )}
          {libraryThemes.length > 0 && visibleLibrary.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary">No saved templates match this search or category.</Typography>
            </Grid>
          )}
        </Grid>
      )}

      {tab === 2 && (
        <ThemeHistoryPanel activations={activations} onRollback={handleRollback} loading={actionLoading} />
      )}

      {tab === 3 && (
        <Box>
          {!activeActivation ? (
            <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                No Active Theme Blueprint
              </Typography>
              <Typography variant="body2">
                Apply a theme template from the "Built-in Templates" or "My Templates" tabs to track edits and drafts.
              </Typography>
            </Paper>
          ) : (
            <Box>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={850}>
                      Theme Draft: {activeActivation.themeName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Applied: {new Date(activeActivation.createdAt).toLocaleString()} • Scope: {activeActivation.appliedScopes?.join(', ')}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1.5}>
                    <Button
                      variant="outlined"
                      onClick={() => setExportOpen(true)}
                    >
                      Export Custom Package
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => setSaveTemplateOpen(true)}
                      disabled={differences.length === 0}
                    >
                      Save as Custom Theme
                    </Button>
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={handleResetAllSettings}
                      disabled={differences.length === 0 || actionLoading}
                    >
                      Reset All Drafts
                    </Button>
                  </Stack>
                </Box>
              </Paper>

              {differences.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center', color: 'success.main', bgcolor: 'success.lightest' }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    ✓ Draft is in sync
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Your current store settings match the original applied theme blueprint perfectly. No drift detected.
                  </Typography>
                </Paper>
              ) : (
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2 }}>
                      Modified Settings ({differences.length})
                    </Typography>
                    <Stack spacing={3.5}>
                      {Object.entries(groupedDiffs).map(([group, diffList]) => (
                        <Box key={group}>
                          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                            <Box sx={{ bgcolor: 'action.hover', px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                                {group.toUpperCase()} SETTINGS ({diffList.length})
                              </Typography>
                              <Button
                                size="small"
                                color="warning"
                                onClick={() => {
                                  const payload = diffList.map(d => ({ group: d.group, key: d.key, value: d.originalValue }));
                                  setActionLoading(true);
                                  updateSettings(payload)
                                    .then(() => {
                                      notify(`Reset all ${group} settings to original theme values.`, 'success');
                                      if (refreshSettings) refreshSettings();
                                      fetchData();
                                    })
                                    .catch(() => notify('Failed to reset group settings', 'error'))
                                    .finally(() => setActionLoading(false));
                                }}
                                disabled={actionLoading}
                              >
                                Reset Group
                              </Button>
                            </Box>
                            <Box>
                              {diffList.map((diff, index) => (
                                <Box
                                  key={`${diff.group}-${diff.key}`}
                                  sx={{
                                    p: 2.5,
                                    borderBottom: index < diffList.length - 1 ? '1px solid' : 'none',
                                    borderColor: 'divider',
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: '2.5fr 2fr 2fr 1fr' },
                                    gap: 2,
                                    alignItems: 'center',
                                  }}
                                >
                                  <Box>
                                    <Typography variant="subtitle2" fontWeight={600}>
                                      {formatSettingLabel(diff.group, diff.key)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                      {diff.group}.{diff.key}
                                    </Typography>
                                  </Box>
                                  <Box>
                                    <Typography variant="caption" color="text.secondary" display="block">Original Theme:</Typography>
                                    {renderValue(diff.originalValue)}
                                  </Box>
                                  <Box>
                                    <Typography variant="caption" color="text.secondary" display="block">Current Edited:</Typography>
                                    {renderValue(diff.currentValue)}
                                  </Box>
                                  <Box sx={{ textAlign: 'right' }}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="warning"
                                      onClick={() => handleResetSetting(diff.group, diff.key, diff.originalValue)}
                                      disabled={actionLoading}
                                    >
                                      Reset
                                    </Button>
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          </Paper>
                        </Box>
                      ))}
                    </Stack>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}
        </Box>
      )}

      <ThemePreviewModal open={!!previewPkg} onClose={() => setPreviewPkg(null)} packageData={previewPkg} onApply={setApplyPkg} />
      <ThemeApplyDialog open={!!applyPkg} onClose={() => setApplyPkg(null)} packageData={applyPkg} onConfirm={handleApply} loading={actionLoading} />
      <ThemeImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} onPreview={(pkg) => { setImportOpen(false); setPreviewPkg(pkg); }} loading={actionLoading} />
      <ThemeDetailModal open={!!detailPkg} onClose={() => setDetailPkg(null)} packageData={detailPkg} onPreview={setPreviewPkg} onApply={setApplyPkg} />
      <SaveAsTemplateDialog open={saveTemplateOpen} onClose={() => setSaveTemplateOpen(false)} onSaved={() => { notify('Template saved to library', 'success'); fetchData(); }} />

      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Export Current Store Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose how much of the current store configuration should be included in the exported .theme.json file. Advanced custom code, payments, shipping, credentials, and private settings are never exported.
          </Typography>
          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOpts.includeHomepageSections}
                  onChange={(e) => setExportOpts((current) => ({ ...current, includeHomepageSections: e.target.checked }))}
                />
              }
              label="Include homepage section structure"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOpts.includeDemoContent}
                  onChange={(e) => setExportOpts((current) => ({ ...current, includeDemoContent: e.target.checked }))}
                />
              }
              label="Include demo content: hero slides, banners, value props, announcement text"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOpts.includeComponentStyles}
                  onChange={(e) => setExportOpts((current) => ({ ...current, includeComponentStyles: e.target.checked }))}
                />
              }
              label="Include card/component styles: product, category, promo, brand, trust cards"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOpts.includeSectionPresets}
                  onChange={(e) => setExportOpts((current) => ({ ...current, includeSectionPresets: e.target.checked }))}
                />
              }
              label="Include reusable section presets for the composer"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<FileDownloadIcon />} onClick={handleExport}>Export Template</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ThemeGalleryPage;
