import React, { useRef, useState, useCallback } from 'react';
import { Box, Typography, Grid, FormControl, InputLabel, Select, MenuItem, TextField, Divider, Button, IconButton, Slider, Alert, Chip, Paper, LinearProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { mediaService } from '../../../services/mediaService';
import { ThemeContrastPanel } from '../settings/ContrastBadge';
import { getDesignComponentControlSchema } from '../../../utils/designRegistry';
import { DesignSchemaFields } from './designer/DesignSchemaFields';

const SCALE_PRESETS = [
  { value: 'compact', label: 'Compact' },
  { value: 'default', label: 'Default' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'display', label: 'Display' },
  { value: 'goldenRatio', label: 'Golden Ratio' },
  { value: 'minorThird', label: 'Minor Third' },
  { value: 'custom', label: 'Custom' },
];

const VARIABLE_FONT_PRESETS = {
  'Inter': { axes: { wght: { min: 100, max: 900, default: 400 }, slnt: { min: -10, max: 0, default: 0 } } },
  'Roboto Flex': { axes: { wght: { min: 100, max: 1000, default: 400 }, wdth: { min: 25, max: 151, default: 100 }, opsz: { min: 8, max: 144, default: 14 }, GRAD: { min: -200, max: 150, default: 0 }, slnt: { min: -10, max: 0, default: 0 } } },
  'Open Sans': { axes: { wght: { min: 300, max: 800, default: 400 }, wdth: { min: 75, max: 100, default: 100 } } },
  'Montserrat': { axes: { wght: { min: 100, max: 900, default: 400 } } },
  'Work Sans': { axes: { wght: { min: 100, max: 900, default: 400 } } },
  'Poppins': { axes: { wght: { min: 100, max: 900, default: 400 } } },
  'Lato': { axes: { wght: { min: 100, max: 900, default: 400 } } },
  'Quicksand': { axes: { wght: { min: 300, max: 700, default: 400 } } },
  'Raleway': { axes: { wght: { min: 100, max: 900, default: 400 } } },
  'Nunito': { axes: { wght: { min: 200, max: 900, default: 400 } } },
  'Source Sans 3': { axes: { wght: { min: 200, max: 900, default: 400 }, opsz: { min: 8, max: 60, default: 14 } } },
  'Lora': { axes: { wght: { min: 400, max: 700, default: 400 }, opsz: { min: 5, max: 72, default: 11 } } },
};

const AXIS_LABELS = {
  wght: 'Weight', wdth: 'Width', opsz: 'Optical Size', slnt: 'Slant', ital: 'Italic', GRAD: 'Grade',
};

const generateClamp = (minRem, maxRem, minVw = 320, maxVw = 1280, unit = 'vw') => {
  const minVal = parseFloat(minRem);
  const maxVal = parseFloat(maxRem);
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal < 0 || maxVal < 0) return '';
  const slope = ((maxVal - minVal) / ((maxVw - minVw) / 100)).toFixed(4);
  const intercept = (minVal - (slope * minVw) / 100).toFixed(4);
  return `clamp(${minVal}rem, ${intercept}rem + ${slope}${unit}, ${maxVal}rem)`;
};

const parseClampOrValue = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  const match = raw.match(/clamp\(\s*([^,)]+)/i);
  const firstArg = match ? match[1] : raw;
  return firstArg.replace(/rem/g, '').trim();
};

const Field = ({ label, value, onChange, type = 'text', helperText, placeholder }) => (
  <TextField
    fullWidth
    size="small"
    type={type}
    label={label}
    value={value || ''}
    onChange={(event) => onChange(event.target.value)}
    helperText={helperText}
    placeholder={placeholder}
    InputLabelProps={type === 'color' ? { shrink: true } : undefined}
  />
);

const SelectField = ({ label, value, onChange, options }) => (
  <FormControl fullWidth size="small">
    <InputLabel>{label}</InputLabel>
    <Select label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <MenuItem key={option.value || option} value={option.value || option}>{option.label || option}</MenuItem>
      ))}
    </Select>
  </FormControl>
);

const FontUploadField = ({ label, url, fontFamily, onUpload, onClear }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const result = await mediaService.uploadFont(file);
      const media = result?.data?.media || result?.media;
      if (media?.url) {
        onUpload(media.url, file.name);
      } else {
        setError('Upload succeeded but no URL was returned.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onUpload]);

  return (
    <Box>
      <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>{label}</Typography>
      {url ? (
        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>{fontFamily || 'Custom Font'}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{url}</Typography>
          </Box>
          <IconButton size="small" color="error" onClick={onClear} title="Remove font">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Paper>
      ) : (
        <>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloudUploadIcon />}
            fullWidth
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            sx={{ textTransform: 'none' }}
          >
            {uploading ? 'Uploading...' : 'Upload Font File'}
          </Button>
          <input ref={inputRef} type="file" accept=".woff2,.woff,.ttf,.otf" hidden onChange={handleFile} />
        </>
      )}
      {uploading && <LinearProgress sx={{ mt: 1 }} />}
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  );
};

const TypographyScalePreview = ({ typeScale, fontStacks, themeSettings }) => {
  const headingFamily = fontStacks?.heading || 'inherit';
  const bodyFamily = fontStacks?.body || 'inherit';
  const levels = [
    { label: 'H1', size: typeScale?.h1, family: headingFamily, weight: themeSettings?.headingWeight || 800 },
    { label: 'H2', size: typeScale?.h2, family: headingFamily, weight: themeSettings?.headingWeight || 800 },
    { label: 'H3', size: typeScale?.h3, family: headingFamily, weight: themeSettings?.headingWeight || 700 },
    { label: 'H4', size: typeScale?.h4, family: headingFamily, weight: themeSettings?.headingWeight || 700 },
    { label: 'H5', size: typeScale?.h5, family: headingFamily, weight: themeSettings?.headingWeight || 700 },
    { label: 'H6', size: typeScale?.h6, family: headingFamily, weight: themeSettings?.headingWeight || 700 },
    { label: 'Body', size: typeScale?.body1, family: bodyFamily, weight: themeSettings?.bodyWeight || 400 },
    { label: 'Small', size: typeScale?.body2, family: bodyFamily, weight: themeSettings?.bodyWeight || 400 },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'action.hover' }}>
      <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: 'block' }}>Typography Scale Preview</Typography>
      {levels.map(({ label, size, family, weight }) => (
        <Box key={label} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
          <Chip label={label} size="small" sx={{ minWidth: 48, fontWeight: 700, fontSize: '0.65rem' }} />
          <Typography
            sx={{ fontFamily: family, fontSize: size || '1rem', fontWeight: weight, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            The quick brown fox
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};

/**
 * Global Design Tokens editor — shared between DesignerThemePanel and legacy SectionComposerPage.
 * Controls the whole-storefront visual baseline: button style, card style, border radius, typography, etc.
 */
export const DesignTokensEditor = ({ value = {}, onChange }) => {
  const patch = (key, nextValue) => onChange({ ...value, [key]: nextValue });
  const patchNested = (group, key, nextValue) => patch(group, { ...(value[group] || {}), [key]: nextValue });

  const typographyScale = value.typographyScale || {};
  const mobile = value.mobileOverrides || {};
  const customFonts = value.customFonts || {};
  const variableFontAxes = value.variableFontAxes || {};
  const fluidConfig = typographyScale.fluidConfig || {};

  const knownBodyPreset = VARIABLE_FONT_PRESETS[value.fontFamily];
  const knownHeadingPreset = VARIABLE_FONT_PRESETS[value.headingFont];
  const hasVariableFont = Boolean(knownBodyPreset || knownHeadingPreset);

  const handleBodyFontUpload = (url, filename) => {
    patchNested('customFonts', 'bodyUrl', url);
    if (filename) patchNested('customFonts', 'bodyFamily', filename.replace(/\.[^.]+$/, ''));
  };

  const handleHeadingFontUpload = (url, filename) => {
    patchNested('customFonts', 'headingUrl', url);
    if (filename) patchNested('customFonts', 'headingFamily', filename.replace(/\.[^.]+$/, ''));
  };

  const updateAxisValue = (axisTag, newValue) => {
    const current = variableFontAxes[axisTag] || {};
    patchNested('variableFontAxes', axisTag, { ...current, value: newValue });
  };

  const toggleAxis = (axisTag, config) => {
    const current = variableFontAxes[axisTag];
    if (current && current.enabled !== false) {
      patchNested('variableFontAxes', axisTag, { ...current, enabled: false });
    } else {
      patchNested('variableFontAxes', axisTag, { ...config, value: config.default, enabled: true });
    }
  };

  const resolvedAxes = {};
  const mergePreset = (preset) => {
    if (!preset?.axes) return;
    Object.entries(preset.axes).forEach(([tag, config]) => {
      if (!resolvedAxes[tag]) resolvedAxes[tag] = config;
    });
  };
  mergePreset(knownBodyPreset);
  mergePreset(knownHeadingPreset);

  const buildVariationSettings = () => {
    const parts = [];
    Object.entries(variableFontAxes).forEach(([tag, config]) => {
      if (config && config.enabled !== false && config.value !== undefined) {
        parts.push(`"${tag}" ${config.value}`);
      }
    });
    return parts.length ? parts.join(', ') : 'normal';
  };

  const bodyFontSize = fluidConfig.bodyMin || parseClampOrValue(typographyScale.body1) || '1';
  const headingSizes = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((level) => ({
    level,
    min: fluidConfig[level + 'Min'] || '',
    max: fluidConfig[level + 'Max'] || parseClampOrValue(typographyScale[level]) || '',
  }));

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
        Global Design Tokens
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        These controls affect the whole storefront — buttons, cards, backgrounds, border radius, typography rhythm, and density.
      </Typography>

      <DesignSchemaFields
        schema={getDesignComponentControlSchema('designTokens')}
        value={value}
        onChange={onChange}
      />

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        These colors are the storefront foundation. Check the WCAG status before publishing changes.
      </Typography>
      <DesignSchemaFields
        schema={{ groups: [getDesignComponentControlSchema('designTokens').groups[1]] }}
        value={value}
        onChange={onChange}
      />
      <ThemeContrastPanel
        primaryColor={value.primaryColor || '#0f766e'}
        secondaryColor={value.secondaryColor || '#f97316'}
        backgroundColor={value.backgroundColor || '#f7f3ec'}
        textColor={value.textColor || '#1f2933'}
      />

      <Divider sx={{ my: 2 }} />
      <DesignSchemaFields
        schema={{ groups: [getDesignComponentControlSchema('designTokens').groups[2]] }}
        value={value}
        onChange={onChange}
      />

      <Divider sx={{ my: 2 }} />
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <SelectField label="Typography Scale" value={typographyScale.preset || 'default'} onChange={(next) => patchNested('typographyScale', 'preset', next)} options={SCALE_PRESETS} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <SelectField label="Responsive Type" value={typographyScale.fluid === false ? 'fixed' : 'fluid'} onChange={(next) => patchNested('typographyScale', 'fluid', next === 'fluid')} options={[
            { value: 'fluid', label: 'Fluid clamp()' }, { value: 'fixed', label: 'Fixed sizes' },
          ]} />
        </Grid>
      </Grid>
      <DesignSchemaFields
        schema={{ groups: [getDesignComponentControlSchema('designTokens').groups[3]] }}
        value={value}
        onChange={onChange}
      />

      {/* Custom Font Uploads */}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>Custom Font Uploads</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Upload WOFF2, WOFF, TTF, or OTF files. Uploaded fonts override Google Fonts above.
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <FontUploadField
            label="Body Font File"
            url={customFonts.bodyUrl}
            fontFamily={customFonts.bodyFamily || value.fontFamily}
            onUpload={handleBodyFontUpload}
            onClear={() => { patchNested('customFonts', 'bodyUrl', ''); patchNested('customFonts', 'bodyFamily', ''); }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FontUploadField
            label="Heading Font File"
            url={customFonts.headingUrl}
            fontFamily={customFonts.headingFamily || value.headingFont}
            onUpload={handleHeadingFontUpload}
            onClear={() => { patchNested('customFonts', 'headingUrl', ''); patchNested('customFonts', 'headingFamily', ''); }}
          />
        </Grid>
        {customFonts.bodyUrl && (
          <Grid item xs={12} sm={6}>
            <Field label="Body Font Family Name" value={customFonts.bodyFamily || ''} placeholder="Storefront Body Custom" onChange={(next) => patchNested('customFonts', 'bodyFamily', next)} helperText="CSS font-family name for the uploaded font" />
          </Grid>
        )}
        {customFonts.headingUrl && (
          <Grid item xs={12} sm={6}>
            <Field label="Heading Font Family Name" value={customFonts.headingFamily || ''} placeholder="Storefront Heading Custom" onChange={(next) => patchNested('customFonts', 'headingFamily', next)} helperText="CSS font-family name for the uploaded font" />
          </Grid>
        )}
        {customFonts.bodyUrl && (
          <Grid item xs={12} sm={6}>
            <SelectField label="Body Font Format" value={customFonts.bodyFormat || 'woff2'} onChange={(next) => patchNested('customFonts', 'bodyFormat', next)} options={[
              { value: 'woff2', label: 'WOFF2 (recommended)' }, { value: 'woff', label: 'WOFF' }, { value: 'truetype', label: 'TrueType (.ttf)' }, { value: 'opentype', label: 'OpenType (.otf)' },
            ]} />
          </Grid>
        )}
        {customFonts.headingUrl && (
          <Grid item xs={12} sm={6}>
            <SelectField label="Heading Font Format" value={customFonts.headingFormat || 'woff2'} onChange={(next) => patchNested('customFonts', 'headingFormat', next)} options={[
              { value: 'woff2', label: 'WOFF2 (recommended)' }, { value: 'woff', label: 'WOFF' }, { value: 'truetype', label: 'TrueType (.ttf)' }, { value: 'opentype', label: 'OpenType (.otf)' },
            ]} />
          </Grid>
        )}
      </Grid>

      {/* Variable Font Axes */}
      {hasVariableFont && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>Variable Font Axes</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Detected variable font: {Object.keys(VARIABLE_FONT_PRESETS).filter((f) => value.fontFamily === f || value.headingFont === f).join(', ')}.
            Toggle axes below to fine-tune.
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(resolvedAxes).map(([tag, config]) => {
              const axisConfig = variableFontAxes[tag] || { ...config, value: config.default, enabled: false };
              const isEnabled = axisConfig.enabled !== false;
              return (
                <Grid item xs={12} key={tag}>
                  <Paper variant="outlined" sx={{ p: 1.5, opacity: isEnabled ? 1 : 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: isEnabled ? 1 : 0 }}>
                      <Chip
                        label={AXIS_LABELS[tag] || tag}
                        size="small"
                        color={isEnabled ? 'primary' : 'default'}
                        onClick={() => toggleAxis(tag, config)}
                        sx={{ fontWeight: 700, cursor: 'pointer' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {tag} ({config.min}–{config.max})
                      </Typography>
                      {isEnabled && (
                        <Typography variant="caption" fontWeight={700} sx={{ ml: 'auto' }}>
                          {axisConfig.value ?? config.default}
                        </Typography>
                      )}
                    </Box>
                    {isEnabled && (
                      <Slider
                        size="small"
                        value={axisConfig.value ?? config.default}
                        min={config.min}
                        max={config.max}
                        step={tag === 'wght' || tag === 'GRAD' ? 1 : 0.1}
                        onChange={(_, val) => updateAxisValue(tag, val)}
                        valueLabelDisplay="auto"
                      />
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
          <Grid item xs={12}>
            <Field
              label="Font Variation Settings (CSS)"
              value={buildVariationSettings()}
              helperText="Auto-generated from axes above. You can also edit manually."
              onChange={(next) => patch('fontVariationSettings', next)}
            />
          </Grid>
        </>
      )}
      {!hasVariableFont && (
        <>
          <Divider sx={{ my: 2 }} />
          <Grid item xs={12}>
            <Field label="Font Variation Settings" value={value.fontVariationSettings || ''} placeholder={'"opsz" 32, "wdth" 100'} onChange={(next) => patch('fontVariationSettings', next)} helperText="For variable fonts. Applied to storefront body text." />
          </Grid>
        </>
      )}

      {/* Fluid Typography Per-Level Controls */}
      {typographyScale.fluid !== false && typographyScale.preset === 'custom' && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>Fluid Typography Ranges</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Set min (mobile) and max (desktop) sizes in rem. The system auto-generates clamp() expressions.
          </Typography>
          <Grid container spacing={2}>
            {['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body1', 'body2'].map((level) => (
              <React.Fragment key={level}>
                <Grid item xs={12} sm={4}>
                  <Field
                    label={`${level.toUpperCase()} Min (rem)`}
                    value={fluidConfig[level + 'Min'] || ''}
                    placeholder={level.startsWith('h') ? '1.5' : '0.875'}
                    onChange={(next) => patchNested('typographyScale', 'fluidConfig', { ...fluidConfig, [level + 'Min']: next })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field
                    label={`${level.toUpperCase()} Max (rem)`}
                    value={fluidConfig[level + 'Max'] || ''}
                    placeholder={level.startsWith('h') ? '3' : '1'}
                    onChange={(next) => patchNested('typographyScale', 'fluidConfig', { ...fluidConfig, [level + 'Max']: next })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  {fluidConfig[level + 'Min'] && fluidConfig[level + 'Max'] && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">Generated:</Typography>
                      <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-all', color: 'primary.main' }}>
                        {generateClamp(fluidConfig[level + 'Min'], fluidConfig[level + 'Max'])}
                      </Typography>
                    </Box>
                  )}
                </Grid>
              </React.Fragment>
            ))}
            <Grid item xs={12} sm={6}>
              <Field label="Min Viewport Width (px)" value={fluidConfig.minVw || '320'} onChange={(next) => patchNested('typographyScale', 'fluidConfig', { ...fluidConfig, minVw: next })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field label="Max Viewport Width (px)" value={fluidConfig.maxVw || '1280'} onChange={(next) => patchNested('typographyScale', 'fluidConfig', { ...fluidConfig, maxVw: next })} />
            </Grid>
          </Grid>
        </>
      )}

      {/* Custom Scale Sizes */}
      {typographyScale.preset === 'custom' && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Custom Scale Sizes</Typography>
          <Grid container spacing={2}>
            {['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body1', 'body2'].map((token) => (
              <Grid item xs={12} sm={6} key={token}>
                <Field label={token.toUpperCase()} value={typographyScale[token] || ''} placeholder={token.startsWith('h') ? 'clamp(2rem, 5vw, 3rem)' : '1rem'} onChange={(next) => patchNested('typographyScale', token, next)} />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* Live Typography Preview */}
      <TypographyScalePreview
        typeScale={
          typographyScale.preset === 'custom'
            ? Object.fromEntries(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body1', 'body2'].map((k) => [k, typographyScale[k]]))
            : null
        }
        fontStacks={{ body: value.fontFamily, heading: value.headingFont || value.fontFamily }}
        themeSettings={value}
      />

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Mobile Overrides</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Field label="Mobile Primary" type="color" value={mobile.primaryColor || ''} onChange={(next) => patchNested('mobileOverrides', 'primaryColor', next)} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Field label="Mobile Background" type="color" value={mobile.backgroundColor || ''} onChange={(next) => patchNested('mobileOverrides', 'backgroundColor', next)} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Field label="Mobile Surface" type="color" value={mobile.surfaceColor || ''} onChange={(next) => patchNested('mobileOverrides', 'surfaceColor', next)} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Field label="Mobile Text" type="color" value={mobile.textColor || ''} onChange={(next) => patchNested('mobileOverrides', 'textColor', next)} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Field label="Mobile Body Size" value={mobile.bodyFontSize || ''} placeholder="0.95rem" onChange={(next) => patchNested('mobileOverrides', 'bodyFontSize', next)} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Field label="Mobile Heading Scale" value={mobile.headingScale || ''} placeholder="0.86" onChange={(next) => patchNested('mobileOverrides', 'headingScale', next)} helperText="Multiplier for heading sizes below 600px." />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Field label="Mobile Section Padding" value={mobile.sectionPadding || ''} placeholder="32px" onChange={(next) => patchNested('mobileOverrides', 'sectionPadding', next)} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Field label="Mobile Container Padding" value={mobile.containerPadding || ''} placeholder="16px" onChange={(next) => patchNested('mobileOverrides', 'containerPadding', next)} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default DesignTokensEditor;
