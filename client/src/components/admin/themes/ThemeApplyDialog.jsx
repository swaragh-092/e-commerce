import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControlLabel, Checkbox, Typography, Alert, Box, Chip, CircularProgress, Stack } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import themeService from '../../../services/themeService';

const ThemeApplyDialog = ({ open, onClose, packageData, onConfirm, loading }) => {
  const [scopes, setScopes] = useState(['design', 'layoutStyle']);
  const [replaceDemoContent, setReplaceDemoContent] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [impactDiff, setImpactDiff] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const dataSourceCount = packageData?.dataSources?.length || 0;
  const pageTemplateCount = Object.keys(packageData?.pageTemplates || {}).filter(Boolean).length;
  const homepageSectionCount = packageData?.layout?.homepageSections?.length || 0;
  const componentStyleCount = Object.keys(packageData?.componentStyles || {}).filter(Boolean).length;
  const sectionPresetCount = Object.keys(packageData?.sectionPresets || {}).filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    themeService.getStoreStatus()
      .then(s => setIsEmpty(s.isEmpty))
      .catch((err) => {
        console.error('[ThemeApplyDialog] Failed to fetch store status:', err);
      });
  }, [open]);

  useEffect(() => {
    if (!open || !packageData) return;
    if (isEmpty) {
      const all = ['design', 'layoutStyle', 'homepageSections'];
      if (componentStyleCount) all.push('componentStyles');
      if (sectionPresetCount) all.push('sectionPresets');
      if (pageTemplateCount) all.push('pageTemplates');
      if (dataSourceCount) all.push('dataSources');
      setScopes(all);
      setReplaceDemoContent(true);
    } else {
      const nextScopes = ['design', 'layoutStyle', 'homepageSections'];
      if (componentStyleCount) nextScopes.push('componentStyles');
      if (sectionPresetCount) nextScopes.push('sectionPresets');
      if (pageTemplateCount) nextScopes.push('pageTemplates');
      if (dataSourceCount) nextScopes.push('dataSources');
      setScopes(nextScopes);
      setReplaceDemoContent(false);
    }
  }, [open, packageData, dataSourceCount, pageTemplateCount, componentStyleCount, sectionPresetCount, isEmpty]);

  // Fetch impact diff when scopes change
  useEffect(() => {
    if (!open || !packageData) { setImpactDiff(null); setPreviewError(null); return; }
    const previewScopes = [...scopes];
    if (replaceDemoContent && !previewScopes.includes('demoContent')) previewScopes.push('demoContent');
    if (previewScopes.length === 0) { setImpactDiff(null); setPreviewError(null); return; }

    setDiffLoading(true);
    setPreviewError(null);
    themeService.previewTheme(packageData, previewScopes)
      .then(result => setImpactDiff(result))
      .catch((err) => {
        console.error('[ThemeApplyDialog] Failed to preview theme impact:', err);
        setPreviewError(err);
        setImpactDiff(null);
      })
      .finally(() => setDiffLoading(false));
  }, [open, packageData, scopes, replaceDemoContent]);

  const toggleScope = (scope) => {
    setScopes((prev) => {
      if (prev.includes(scope)) {
        const next = prev.filter((s) => s !== scope);
        // Data sources require homepage sections to be installed (they reference section configs);
        // when homepage sections are removed, data sources must also be removed.
        return scope === 'homepageSections' ? next.filter((s) => s !== 'dataSources') : next;
      }
      // Installing data sources also requires homepage sections, so auto-add homepage sections.
      return scope === 'dataSources' && !prev.includes('homepageSections')
        ? [...prev, 'homepageSections', scope]
        : [...prev, scope];
    });
  };

  const handleConfirm = () => {
    const finalScopes = [...scopes];
    if (replaceDemoContent && !finalScopes.includes('demoContent')) finalScopes.push('demoContent');
    onConfirm(packageData, finalScopes, replaceDemoContent);
  };

  const handleStartFresh = () => {
    const all = ['design', 'layoutStyle', 'homepageSections', 'demoContent'];
    if (componentStyleCount) all.push('componentStyles');
    if (sectionPresetCount) all.push('sectionPresets');
    if (pageTemplateCount) all.push('pageTemplates');
    if (dataSourceCount) all.push('dataSources');
    onConfirm(packageData, all, true);
  };

  if (!packageData) return null;

  // Summarize impact diff
  const diffSummary = (() => {
    if (!impactDiff?.changes?.length) return null;
    const groups = {};
    for (const change of impactDiff.changes) {
      groups[change.group] = (groups[change.group] || 0) + 1;
    }
    return { total: impactDiff.changes.length, groups };
  })();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Install Template: {packageData.meta?.name}</DialogTitle>
      <DialogContent>
        {isEmpty && (
          <Alert severity="success" icon={<RocketLaunchIcon />} sx={{ mb: 2 }}>
            Your store is empty — we recommend a full install for a launch-ready homepage.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose how much of this store template to apply:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <FormControlLabel
            control={<Checkbox checked={scopes.includes('design')} onChange={() => toggleScope('design')} />}
            label="Apply design: colors, typography and global theme tokens"
          />
          <FormControlLabel
            control={<Checkbox checked={scopes.includes('componentStyles')} onChange={() => toggleScope('componentStyles')} disabled={!componentStyleCount} />}
            label={componentStyleCount ? `Apply card/component styles (${componentStyleCount})` : 'Apply card/component styles'}
          />
          <FormControlLabel
            control={<Checkbox checked={scopes.includes('sectionPresets')} onChange={() => toggleScope('sectionPresets')} disabled={!sectionPresetCount} />}
            label={sectionPresetCount ? `Apply reusable section presets (${sectionPresetCount})` : 'Apply reusable section presets'}
          />
          <FormControlLabel
            control={<Checkbox checked={scopes.includes('layoutStyle')} onChange={() => toggleScope('layoutStyle')} />}
            label="Apply layout styling: navigation, footer and announcement colors"
          />
          <FormControlLabel
            control={<Checkbox checked={scopes.includes('homepageSections')} onChange={() => toggleScope('homepageSections')} />}
            label={`Apply homepage section order${homepageSectionCount ? ` (${homepageSectionCount} sections)` : ''}`}
          />
          <FormControlLabel
            control={<Checkbox checked={scopes.includes('pageTemplates')} onChange={() => toggleScope('pageTemplates')} disabled={!pageTemplateCount} />}
            label={pageTemplateCount ? `Apply product and collection page layouts (${pageTemplateCount})` : 'Apply product and collection page layouts'}
          />
          <FormControlLabel
            control={<Checkbox checked={scopes.includes('dataSources')} onChange={() => toggleScope('dataSources')} disabled={!dataSourceCount || !scopes.includes('homepageSections')} />}
            label={dataSourceCount ? `Create dynamic data sources (${dataSourceCount})` : 'Create dynamic data sources'}
          />
          <FormControlLabel
            control={<Checkbox checked={replaceDemoContent} onChange={(e) => setReplaceDemoContent(e.target.checked)} />}
            label="Replace homepage demo content and announcement text"
          />
        </Box>

        {/* Install Impact Diff */}
        {diffLoading && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">Calculating changes...</Typography>
          </Stack>
        )}
        {!diffLoading && diffSummary && (
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.75 }}>
              Install impact: {diffSummary.total} setting{diffSummary.total !== 1 ? 's' : ''} will change
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {Object.entries(diffSummary.groups).map(([group, count]) => (
                <Chip key={group} label={`${group}: ${count}`} size="small" variant="outlined" />
              ))}
              {dataSourceCount > 0 && scopes.includes('dataSources') && (
                <Chip label={`+${dataSourceCount} data source${dataSourceCount > 1 ? 's' : ''}`} size="small" color="info" variant="outlined" />
              )}
            </Stack>
          </Box>
        )}
        {!diffLoading && previewError && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Could not calculate the install impact. You can still install, but the change summary is unavailable.
          </Alert>
        )}

        {scopes.includes('dataSources') && dataSourceCount > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            This will create safe API Builder storefront endpoints used by this template's dynamic sections.
          </Alert>
        )}
        {replaceDemoContent && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            This will overwrite current hero slides, promo banners, value props, and announcement text. Previous content is saved in activation history and can be restored.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Button size="small" startIcon={<RocketLaunchIcon />} onClick={handleStartFresh} disabled={loading} color="secondary">
          Start Fresh
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirm} disabled={loading || (scopes.length === 0 && !replaceDemoContent) || Boolean(previewError)}>
            {loading ? 'Installing...' : 'Install Template'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ThemeApplyDialog;
