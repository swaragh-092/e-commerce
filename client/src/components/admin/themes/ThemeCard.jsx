import { Box, Card, CardContent, Typography, Button, Chip, Stack, Divider, Tooltip } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadDoneIcon from '@mui/icons-material/DownloadDone';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { scoreTheme } from '../../../utils/themeScore';

const CATEGORY_LABELS = {
  general: 'General',
  fashion: 'Fashion',
  electronics: 'Electronics',
  grocery: 'Grocery',
  food: 'Food',
  beauty: 'Beauty',
  luxury: 'Luxury',
  kids: 'Kids',
  books: 'Books',
  sports: 'Sports',
  handmade: 'Handmade',
  b2b: 'B2B',
};

const getTemplateSummary = (pkg, theme) => {
  const meta = pkg.meta || theme || {};
  const category = meta.category || theme.category || 'general';
  const sections = pkg.layout?.homepageSections || [];
  const demo = pkg.demoContent || {};
  const included = [];

  if (pkg.design?.theme) included.push('Design');
  if (pkg.layout?.nav || pkg.layout?.footerStyle || pkg.layout?.announcementStyle) included.push('Layout');
  if (sections.length) included.push(String(sections.length) + ' sections');
  if (demo.heroSlides?.length || demo.promoBanners?.length || demo.valueProps?.length) included.push('Demo content');
  if (pkg.componentStyles && Object.keys(pkg.componentStyles).length) included.push('Card styles');
  if (pkg.pageTemplates && Object.keys(pkg.pageTemplates).length) included.push('Page layouts');
  if (pkg.dataSources?.length) included.push(String(pkg.dataSources.length) + ' data sources');

  return {
    meta,
    category,
    categoryLabel: CATEGORY_LABELS[category] || category,
    bestFor: meta.bestFor || meta.description || 'Launch-ready storefront design with layout and merchandising structure.',
    included,
    sections,
  };
};

const ThemeCard = ({ theme, onPreview, onApply, onDetail, isActive }) => {
  const pkg = theme.packageData || theme;
  const design = pkg.design?.theme || {};
  const colors = [design.primaryColor, design.secondaryColor, design.backgroundColor, design.surfaceColor].filter(Boolean);
  const { meta, categoryLabel, bestFor, included, sections } = getTemplateSummary(pkg, theme);
  const scores = scoreTheme(pkg);

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 3,
        transition: '160ms ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: 4, borderColor: 'primary.main' },
      }}
    >
      {isActive && (
        <Chip label="Currently Active" size="small" color="success" sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, fontWeight: 700 }} />
      )}
      <Box
        sx={{
          minHeight: 128,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          bgcolor: design.backgroundColor || 'background.default',
          color: design.textColor || 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip size="small" label={categoryLabel} color="primary" variant="outlined" sx={{ bgcolor: 'background.paper' }} />
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {/* Colour swatches */}
            {colors.slice(0, 4).map((color, idx) => (
              <Box key={`${color}-${idx}`} sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: color, border: '1px solid rgba(0,0,0,0.14)' }} />
            ))}
            {/* Performance score badge */}
            <Tooltip
              title={`Performance: ${scores.performance}/100 — measures font count, CSS size, section count, and data source overhead.`}
              arrow
            >
              <Chip
                icon={<SpeedIcon style={{ fontSize: 12 }} />}
                label={scores.performanceLabel}
                size="small"
                color={scores.performanceColor}
                variant="outlined"
                sx={{ fontSize: '0.62rem', height: 20, fontWeight: 700, cursor: 'help', ml: 0.5,
                      '& .MuiChip-icon': { fontSize: 11, ml: '4px' },
                      '& .MuiChip-label': { px: '6px' } }}
              />
            </Tooltip>
            {/* Accessibility score badge */}
            {scores.accessibility !== null && (
              <Tooltip
                title={`Accessibility: ${scores.accessibility}/100 — WCAG 2.1 contrast ratio check across primary, text, secondary, and white-on-primary colour pairs.`}
                arrow
              >
                <Chip
                  icon={<AccessibilityNewIcon style={{ fontSize: 12 }} />}
                  label={scores.accessibilityLabel}
                  size="small"
                  color={scores.accessibilityColor}
                  variant="outlined"
                  sx={{ fontSize: '0.62rem', height: 20, fontWeight: 700, cursor: 'help',
                        '& .MuiChip-icon': { fontSize: 11, ml: '4px' },
                        '& .MuiChip-label': { px: '6px' } }}
                />
              </Tooltip>
            )}
          </Stack>
        </Stack>
        <Box sx={{ mt: 3, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.72)', color: '#111827', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.10)' }}>
          <Typography variant="caption" fontWeight={800} color="primary.main">STORE TEMPLATE</Typography>
          <Typography variant="body2" fontWeight={800}>{meta.name || theme.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {sections.length ? sections.length + ' homepage sections included' : 'Design and layout ready'}
          </Typography>
        </Box>
      </Box>

      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>{meta.name || theme.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {meta.author || theme.author || 'Platform Templates'} • v{meta.version || theme.version || '1.0.0'}
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {bestFor}
        </Typography>

        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          {included.slice(0, 4).map((item) => (
            <Chip key={item} icon={<AutoAwesomeIcon />} label={item} size="small" variant="outlined" />
          ))}
        </Stack>

        {meta.tags?.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {meta.tags.slice(0, 4).map((tag) => (
              <Chip key={tag} label={tag} size="small" />
            ))}
          </Stack>
        )}

        <Divider />

        <Stack direction="row" spacing={1}>
          {onDetail && <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={() => onDetail(pkg)}>Details</Button>}
          <Button size="small" startIcon={<VisibilityIcon />} onClick={() => onPreview(pkg)}>Preview</Button>
          <Button size="small" variant="contained" startIcon={<DownloadDoneIcon />} onClick={() => onApply(pkg)}>Install</Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ThemeCard;
