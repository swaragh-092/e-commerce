import { useState } from 'react';
import { Dialog, DialogContent, DialogActions, Button, Box, Typography, Grid, Chip, Stack, Divider, IconButton, ToggleButtonGroup, ToggleButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadDoneIcon from '@mui/icons-material/DownloadDone';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import TabletMacIcon from '@mui/icons-material/TabletMac';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StorefrontTemplatePreview from './StorefrontTemplatePreview';

const SECTION_LABELS = {
  'hero-carousel': 'Hero Carousel',
  'value-props': 'Value Propositions',
  'category-shortcuts': 'Category Shortcuts',
  'promo-banners': 'Promo Banners',
  'product-row': 'Product Row',
  'brand-showcase': 'Brand Showcase',
  'editorial-image-text': 'Editorial Image/Text',
  testimonials: 'Testimonials',
  'logo-cloud': 'Logo Cloud',
  'newsletter-signup': 'Newsletter Signup',
  'countdown-sale': 'Countdown Sale',
  'featured-collection-grid': 'Featured Collection Grid',
  faq: 'FAQ',
  'trust-badges': 'Trust Badges',
};

const ThemeDetailModal = ({ open, onClose, packageData, onPreview, onApply }) => {
  const [previewMode, setPreviewMode] = useState('desktop');

  if (!packageData) return null;

  const pkg = packageData.packageData || packageData;
  const meta = pkg.meta || {};
  const design = pkg.design?.theme || {};
  const layout = pkg.layout || {};
  const demo = pkg.demoContent || {};
  const sections = layout.homepageSections || [];
  const dataSources = pkg.dataSources || [];
  const componentStyles = pkg.componentStyles || {};
  const colors = [design.primaryColor, design.secondaryColor, design.backgroundColor, design.surfaceColor, design.textColor].filter(Boolean);

  const scopes = [];
  if (pkg.design?.theme) scopes.push('Design');
  if (Object.keys(componentStyles).length) scopes.push('Component Styles');
  if (layout.nav || layout.footerStyle || layout.announcementStyle) scopes.push('Layout Styling');
  if (sections.length) scopes.push('Homepage Sections');
  if (demo.heroSlides?.length || demo.promoBanners?.length || demo.valueProps?.length) scopes.push('Demo Content');
  if (dataSources.length) scopes.push('Dynamic Data Sources');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { height: { xs: '95vh', sm: '92vh', md: '90vh' }, maxHeight: '95vh' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={700}>{meta.name || 'Template Details'}</Typography>
        <IconButton onClick={onClose} aria-label="Close theme details"><CloseIcon /></IconButton>
      </Box>

      <DialogContent sx={{ p: 0, overflow: 'auto' }}>
        <Grid container sx={{ height: '100%' }}>
          {/* Left: Info Panel */}
          <Grid item xs={12} md={4} sx={{ p: 3, borderRight: { md: '1px solid' }, borderColor: { md: 'divider' }, overflow: 'auto' }}>
            {/* Overview */}
            <Typography variant="overline" color="text.secondary">Overview</Typography>
            <Typography variant="h6" fontWeight={800} sx={{ mt: 0.5 }}>{meta.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {meta.author || 'Platform Templates'} • v{meta.version || '1.0.0'}
            </Typography>
            {meta.category && <Chip label={meta.category} size="small" color="primary" variant="outlined" sx={{ mt: 1 }} />}
            {meta.description && (
              <Typography variant="body2" sx={{ mt: 1.5 }}>{meta.description}</Typography>
            )}

            {meta.tags?.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                {meta.tags.map(tag => <Chip key={tag} label={tag} size="small" />)}
              </Stack>
            )}

            {/* Version & Changelog */}
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" fontWeight={700}>Version {meta.version || '1.0.0'}</Typography>
              {meta.changelog && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>{meta.changelog}</Typography>}
              {!meta.changelog && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>Initial release — full design, layout, sections, and demo content.</Typography>}
              {meta.platformCompatibility && <Typography variant="caption" color="text.secondary" display="block">Platform: {meta.platformCompatibility}</Typography>}
            </Box>

            <Divider sx={{ my: 2 }} />
            <Typography variant="overline" color="text.secondary">Color Palette</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {colors.map((c, i) => (
                <Box key={i} sx={{ textAlign: 'center' }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: c, border: '1px solid', borderColor: 'divider' }} />
                  <Typography variant="caption" sx={{ fontSize: 9, display: 'block', mt: 0.5 }}>{c}</Typography>
                </Box>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Typography */}
            <Typography variant="overline" color="text.secondary">Typography</Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2"><strong>Body:</strong> {design.fontFamily || 'System default'}</Typography>
              <Typography variant="body2"><strong>Headings:</strong> {design.headingFont || design.fontFamily || 'System default'}</Typography>
              <Typography variant="body2"><strong>Mode:</strong> {design.mode || 'light'}</Typography>
              <Typography variant="body2"><strong>Radius:</strong> {design.borderRadius || '8px'}</Typography>
              <Typography variant="body2"><strong>Button:</strong> {design.buttonStyle || 'solid'}</Typography>
              <Typography variant="body2"><strong>Card:</strong> {design.cardStyle || 'elevated'}</Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Included Sections */}
            <Typography variant="overline" color="text.secondary">Homepage Sections ({sections.length})</Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {sections.filter(s => s.enabled !== false).map((s, i) => (
                <Box key={s.id || `${s.type}-${s.title || ''}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                  <Typography variant="body2">{s.title || SECTION_LABELS[s.type] || s.type}</Typography>
                </Box>
              ))}
            </Stack>

            {dataSources.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary">Dynamic Data Sources ({dataSources.length})</Typography>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {dataSources.map((source) => (
                    <Typography key={source.key} variant="body2"><strong>{source.key}</strong> • {source.definition?.config?.blocks?.length || 0} API block(s)</Typography>
                  ))}
                </Stack>
              </>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Install Scopes */}
            <Typography variant="overline" color="text.secondary">Included Scopes</Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
              {scopes.map(s => <Chip key={s} label={s} size="small" variant="outlined" />)}
            </Stack>
          </Grid>

          {/* Right: Preview */}
          <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
              <ToggleButtonGroup value={previewMode} exclusive onChange={(_, v) => v && setPreviewMode(v)} size="small">
                <ToggleButton value="desktop"><DesktopWindowsIcon fontSize="small" /></ToggleButton>
                <ToggleButton value="tablet"><TabletMacIcon fontSize="small" /></ToggleButton>
                <ToggleButton value="mobile"><PhoneIphoneIcon fontSize="small" /></ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', justifyContent: 'center' }}>
              <StorefrontTemplatePreview packageData={pkg} mode={previewMode} />
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>Close</Button>
        <Button startIcon={<VisibilityIcon />} onClick={() => { onClose(); onPreview(pkg); }}>Full Preview</Button>
        <Button variant="contained" startIcon={<DownloadDoneIcon />} onClick={() => { onClose(); onApply(pkg); }}>Install Template</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThemeDetailModal;
