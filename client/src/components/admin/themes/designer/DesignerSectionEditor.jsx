import StaffPicksEditor from './StaffPicksEditor';
import ComposedHeroEditor from './ComposedHeroEditor';
import { isValidPromoLink } from '../../../../utils/urls';
import { useState, useEffect, useRef } from 'react';
import {
  Box, Stack, Typography, IconButton, Button, Divider,
  TextField, FormControl, InputLabel, Select, MenuItem, InputAdornment,
  ToggleButtonGroup, ToggleButton, Switch, FormControlLabel,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import PaletteIcon from '@mui/icons-material/Palette';
import DevicesIcon from '@mui/icons-material/Devices';
import TuneIcon from '@mui/icons-material/Tune';
import StorageIcon from '@mui/icons-material/Storage';
import { SECTION_VARIANTS, getSectionLabel } from '../../../storefront/sections/sectionRegistry';
import { SHADOW_PRESETS, WIDTH_PRESETS } from '../../../storefront/sections/SectionFallback';
import { useFeature } from '../../../../hooks/useSettings';
import useHeroCategories from '../../../../hooks/useHeroCategories';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { getSaleLabels } from '../../../../services/adminService';
import { galleryService } from '../../../../services/galleryService';
import MediaPicker from '../../../common/MediaPicker';
import { getMediaUrl } from '../../../../utils/media';
import { HexColorField } from './DesignSchemaFields';
import { usesProductRowSource } from '../../../../utils/productRowSources';

import productRow from '../../../../../../shared/product-row.json';

const featureRequirementField = {
  key: 'requiresFeatureFlag', label: 'Show when feature is enabled', type: 'select',
  options: [
    { value: '', label: 'Always' }, { value: 'pricing', label: 'Pricing' },
    { value: 'cart', label: 'Cart' }, { value: 'checkout', label: 'Checkout' },
    { value: 'payments', label: 'Payments' }, { value: 'shipping', label: 'Shipping' },
  ],
};

export const BLOCK_FIELD_PRESETS = {
  'hero-carousel': {
    key: 'slides',
    title: 'Slides',
    addLabel: 'Add Slide',
    label: (item, index) => item?.title || item?.heading || `Slide ${index + 1}`,
    create: () => ({ eyebrow: 'New arrival', title: 'Fresh arrivals are here', subtitle: 'Discover new products selected for your next shop.', buttonText: 'Shop now', buttonLink: '/products', secondaryButtonText: '', secondaryButtonLink: '', image: '', position: 'center', color: '#ffffff' }),
    fields: [
      { key: 'eyebrow', label: 'Eyebrow' },
      { key: 'title', label: 'Heading' },
      { key: 'subtitle', label: 'Text', multiline: true },
      { key: 'buttonText', label: 'Button Label' },
      { key: 'buttonLink', label: 'Button Link' },
      { key: 'secondaryButtonText', label: 'Secondary Button Label' },
      { key: 'secondaryButtonLink', label: 'Secondary Button Link' },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'position', label: 'Image Focus', type: 'select', options: [
        { value: 'center', label: 'Center' },
        { value: 'top', label: 'Top' },
        { value: 'bottom', label: 'Bottom' },
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ] },
      { key: 'color', label: 'Text Color', type: 'color' },
    ],
  },
  'promo-banners': {
    key: 'items',
    title: 'Promo Blocks',
    addLabel: 'Add Promo',
    label: (item, index) => item?.title || `Promo ${index + 1}`,
    create: () => ({ kicker: 'Offer', title: 'Promo headline', subtitle: 'Describe this offer.', ctaText: 'Shop now', link: '/products', color: '#ffffff', accentColor: '#1976d2' }),
    fields: [
      { key: 'kicker', label: 'Kicker' },
      { key: 'title', label: 'Heading' },
      { key: 'subtitle', label: 'Text', multiline: true },
      { key: 'ctaText', label: 'Button Label' },
      { key: 'link', label: 'Button Link' },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'color', label: 'Background', type: 'color' },
      { key: 'accentColor', label: 'Accent', type: 'color' },
    ],
  },
  'value-props': {
    key: 'items',
    title: 'Value Prop Blocks',
    addLabel: 'Add Value Prop',
    label: (item, index) => item?.title || `Value prop ${index + 1}`,
    create: () => ({ title: 'Fast delivery', text: 'Tracked shipping on every order.', icon: 'shipping', image: '', backgroundColor: '', accentColor: '' }),
    fields: [
      { key: 'title', label: 'Heading' },
      { key: 'text', label: 'Text', multiline: true },
      { key: 'icon', label: 'Icon Name' },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'backgroundColor', label: 'Background', type: 'color' },
      { key: 'accentColor', label: 'Accent', type: 'color' },
      featureRequirementField,
    ],
  },
  'trust-badges': {
    key: 'items',
    title: 'Trust Blocks',
    addLabel: 'Add Trust Block',
    label: (item, index) => item?.title || `Trust block ${index + 1}`,
    create: () => ({ title: 'Secure checkout', text: 'Encrypted checkout from cart to confirmation.', icon: 'secure', image: '', backgroundColor: '', accentColor: '' }),
    fields: [
      { key: 'title', label: 'Heading' },
      { key: 'text', label: 'Text', multiline: true },
      { key: 'icon', label: 'Icon Name' },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'backgroundColor', label: 'Background', type: 'color' },
      { key: 'accentColor', label: 'Accent', type: 'color' },
      featureRequirementField,
    ],
  },
  testimonials: {
    key: 'items',
    title: 'Testimonial Blocks',
    addLabel: 'Add Testimonial',
    label: (item, index) => item?.title || item?.author || `Testimonial ${index + 1}`,
    create: () => ({ title: 'Great experience', text: 'Add the customer quote here.', author: 'Customer name', role: 'Verified buyer' }),
    fields: [
      { key: 'title', label: 'Headline' },
      { key: 'text', label: 'Quote', multiline: true },
      { key: 'author', label: 'Author' },
      { key: 'role', label: 'Role' },
      { key: 'image', label: 'Image', type: 'image' },
    ],
  },
  faq: {
    key: 'items',
    title: 'FAQ Blocks',
    addLabel: 'Add Question',
    label: (item, index) => item?.title || `Question ${index + 1}`,
    create: () => ({ title: 'Question title', text: 'Answer text.' }),
    fields: [
      { key: 'title', label: 'Question' },
      { key: 'text', label: 'Answer', multiline: true },
    ],
  },
  'logo-cloud': {
    key: 'items',
    title: 'Logo Blocks',
    addLabel: 'Add Logo',
    label: (item, index) => item?.title || `Logo ${index + 1}`,
    create: () => ({ title: 'Partner', image: '', link: '' }),
    fields: [
      { key: 'title', label: 'Name' },
      { key: 'image', label: 'Logo', type: 'image' },
      { key: 'link', label: 'Link URL' },
    ],
  },
  'category-shortcuts': {
    key: 'items',
    title: 'Category Tiles',
    addLabel: 'Add Tile',
    label: (item, index) => item?.title || `Tile ${index + 1}`,
    create: () => ({ title: 'Collection', subtitle: 'Short description', link: '/products', image: '' }),
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'subtitle', label: 'Subtitle' },
      { key: 'link', label: 'Link URL' },
      { key: 'image', label: 'Image', type: 'image' },
    ],
  },
  'featured-collection-grid': {
    key: 'items',
    title: 'Collection Tiles',
    addLabel: 'Add Collection',
    label: (item, index) => item?.title || `Collection ${index + 1}`,
    create: () => ({ title: 'Featured collection', subtitle: 'Short description', link: '/products', image: '' }),
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'subtitle', label: 'Subtitle' },
      { key: 'link', label: 'Link URL' },
      { key: 'image', label: 'Image', type: 'image' },
    ],
  },
  'brand-showcase': {
    key: 'items',
    title: 'Brand Blocks',
    addLabel: 'Add Brand',
    label: (item, index) => item?.title || item?.name || `Brand ${index + 1}`,
    create: () => ({ title: 'Brand name', subtitle: '', link: '/brands', image: '' }),
    fields: [
      { key: 'title', label: 'Name' },
      { key: 'subtitle', label: 'Subtitle' },
      { key: 'link', label: 'Link URL' },
      { key: 'image', label: 'Image', type: 'image' },
    ],
  },
};

// Section type flags
const is = (type) => (section) => section?.type === type;
const has = (...types) => (section) => types.includes(section?.type);

const ImageField = ({ label, value, onChange, onBlur, placeholder = 'Image URL...' }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const src = value ? getMediaUrl(value) : '';

  const handleSelect = (media) => {
    const selected = Array.isArray(media) ? media[0] : media;
    if (!selected?.url) return;
    onChange(selected.url);
    onBlur?.();
    setPickerOpen(false);
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label={label}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          size="small"
          fullWidth
          placeholder={placeholder}
          InputProps={{
            startAdornment: src ? (
              <InputAdornment position="start">
                <Box component="img" src={src} alt="" sx={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />
              </InputAdornment>
            ) : (
              <InputAdornment position="start">
                <ImageIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <Button size="small" variant="outlined" onClick={() => setPickerOpen(true)} sx={{ height: 40, flexShrink: 0, textTransform: 'none' }}>
          Pick
        </Button>
      </Stack>
      {src && (
        <Box sx={{ mt: 1, borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', height: 92 }}>
          <Box component="img" src={src} alt={label} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </Box>
      )}
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelect} title={'Select ' + label} />
    </Box>
  );
};

const FieldGroup = ({ label, icon, defaultOpen = true, openForBlock, children }) => {
  const [expanded, setExpanded] = useState(defaultOpen);
  useEffect(() => {
    if (openForBlock != null) setExpanded(true);
  }, [openForBlock]);

  return <Accordion
    expanded={expanded}
    onChange={(_, next) => setExpanded(next)}
    disableGutters
    elevation={0}
    sx={{
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: '8px !important',
      '&:before': { display: 'none' },
      overflow: 'hidden',
    }}
  >
    <AccordionSummary
      expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
      sx={{ px: 1.5, py: 0.25, minHeight: 38, '& .MuiAccordionSummary-content': { my: 0.5, gap: 1, alignItems: 'center' } }}
    >
      {icon && <Box sx={{ color: 'text.secondary', fontSize: 15, display: 'flex' }}>{icon}</Box>}
      <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>{label}</Typography>
    </AccordionSummary>
    <AccordionDetails sx={{ px: 1.5, pb: 2, pt: 0.5 }}>
      <Stack spacing={1.5}>{children}</Stack>
    </AccordionDetails>
  </Accordion>;
};

function CatalogSelectionPicker({ source, selected, onChange }) {
  const curated = Array.isArray(selected);
  const { categories: records, status } = useHeroCategories(curated, source);
  const isBrand = source === 'brand';
  const options = records.filter(({ slug }) => !selected?.includes(slug));
  return <>
    <TextField select size="small" label={isBrand ? 'Brand source' : 'Category source'} value={curated ? 'selected' : 'default'}
      onChange={(event) => onChange(event.target.value === 'selected' ? [] : undefined)}>
      <MenuItem value="default">{isBrand ? 'Use automatic brands' : 'Use existing tiles or automatic categories'}</MenuItem>
      <MenuItem value="selected">{isBrand ? 'Choose brands' : 'Choose categories'}</MenuItem>
    </TextField>
    {curated && <>
      <TextField select size="small" label={isBrand ? 'Add brand' : 'Add category'} value="" disabled={status !== 'ready' || !options.length || selected.length >= (isBrand ? 24 : 16)}
        helperText={status === 'error' ? `${isBrand ? 'Brands' : 'Categories'} could not be loaded.` : undefined}
        onChange={(event) => onChange([...selected, event.target.value])}>
        <MenuItem value="" disabled>{isBrand ? 'Choose a brand' : 'Choose a category'}</MenuItem>
        {options.map(({ slug, label, name }) => <MenuItem key={slug} value={slug}>{label || name}</MenuItem>)}
      </TextField>
      {selected.map((slug, index) => {
        const record = records.find((item) => item.slug === slug);
        const label = record?.label || record?.name || slug;
        const move = (direction) => {
          const next = [...selected];
          const target = index + direction;
          [next[index], next[target]] = [next[target], next[index]];
          onChange(next);
        };
        return <Stack key={slug} direction="row" alignItems="center">
          <Typography variant="body2" sx={{ flex: 1 }}>{label}{status === 'ready' && !record ? ' (unavailable)' : ''}</Typography>
          <IconButton size="small" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => move(-1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label={`Move ${label} down`} disabled={index === selected.length - 1} onClick={() => move(1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label={`Remove ${label}`} onClick={() => onChange(selected.filter((value) => value !== slug))}><DeleteIcon fontSize="small" /></IconButton>
        </Stack>;
      })}
    </>}
  </>;
}

function ProductRowBrandFilter({ brand, enabled, onChange }) {
  const { categories: brands, status } = useHeroCategories(enabled, 'brand');
  const unavailable = brand && !brands.some(({ slug }) => slug === brand);
  return <TextField select size="small" label="Filter by brand" value={brand || ''}
    helperText={enabled ? (status === 'error' ? 'Brands could not be loaded.' : undefined) : 'Brands are disabled in store settings.'}
    onChange={(event) => onChange(event.target.value)}>
    <MenuItem value="">All brands</MenuItem>
    {unavailable && <MenuItem value={brand} disabled>{brand}{status === 'ready' ? ' (unavailable)' : ''}</MenuItem>}
    {brands.map(({ slug, name }) => <MenuItem key={slug} value={slug}>{name}</MenuItem>)}
  </TextField>;
}


const BlockListEditor = ({
  section,
  schema,
  inheritedBlocks = [],
  onChange,
  onBlur,
  onBlockFocus,
  activeBlockKey,
  activeBlockIndex,
}) => {
  const isCustomized = Array.isArray(section?.[schema.key]);
  const blocks = isCustomized ? section[schema.key] : [];
  const effectiveInherited = Array.isArray(inheritedBlocks) && inheritedBlocks.length > 0
    ? inheritedBlocks
    : [];
  const [expandedIndex, setExpandedIndex] = useState(0);
  const focusedBlockRef = useRef(null);
  const hasBlockFocus = activeBlockKey === schema.key && Number.isInteger(activeBlockIndex);

  useEffect(() => {
    if (hasBlockFocus) focusedBlockRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeBlockIndex, hasBlockFocus]);

  useEffect(() => {
    if (activeBlockKey === schema.key && Number.isInteger(activeBlockIndex) && activeBlockIndex >= 0 && activeBlockIndex < blocks.length) {
      setExpandedIndex(activeBlockIndex);
      return;
    }
    if (blocks.length === 0) {
      setExpandedIndex(0);
    } else if (expandedIndex >= blocks.length) {
      setExpandedIndex(blocks.length - 1);
    }
  }, [activeBlockIndex, activeBlockKey, blocks.length, expandedIndex, schema.key]);

  const updateBlocks = (nextBlocks) => {
    onChange(schema.key, nextBlocks);
    onBlur?.();
  };
  const updateField = (index, key, value) => {
    onChange(`${schema.key}.${index}.${key}`, value);
  };
  const moveBlock = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    updateBlocks(next);
    setExpandedIndex(target);
    onBlockFocus?.(schema.key, target);
  };

  const handleAccordionChange = (index) => (_event, isExpanded) => {
    if (isExpanded) {
      setExpandedIndex(index);
      onBlockFocus?.(schema.key, index);
    }
  };

  return (
    <FieldGroup label={schema.title} openForBlock={hasBlockFocus ? activeBlockIndex : undefined} icon={<TextFieldsIcon sx={{ fontSize: 15 }} />}>
      {!isCustomized ? (
        <Stack spacing={1.5}>
          <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', border: '1px dashed', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
              This section is currently using default store content{effectiveInherited.length > 0 ? ` (${effectiveInherited.length} items active)` : ''}.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {effectiveInherited.length > 0 && (
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  const cloned = effectiveInherited.map((item) => ({ ...item }));
                  updateBlocks(cloned);
                  setExpandedIndex(0);
                  onBlockFocus?.(schema.key, 0);
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Customize existing content
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                updateBlocks([schema.create()]);
                setExpandedIndex(0);
                onBlockFocus?.(schema.key, 0);
              }}
              sx={{ textTransform: 'none' }}
            >
              {schema.addLabel}
            </Button>
          </Stack>
        </Stack>
      ) : blocks.length > 0 ? (
        <Stack spacing={1.5}>
          {blocks.map((block, index) => (
            <Accordion
              key={`${schema.key}-${index}`}
              ref={hasBlockFocus && activeBlockIndex === index ? focusedBlockRef : undefined}
              expanded={expandedIndex === index}
              onChange={handleAccordionChange(index)}
              disableGutters
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' }, overflow: 'hidden' }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ px: 1.25, minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5, minWidth: 0 } }}>
                <Typography variant="caption" fontWeight={800} noWrap>{schema.label(block, index)}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 1.25, pb: 1.5, pt: 0 }}>
                <Stack spacing={1.25}>
                  {schema.fields.map((field) => (
                    field.type === 'image' ? (
                      <ImageField
                        key={field.key}
                        label={field.label}
                        type={field.type || 'text'}
                        value={block?.[field.key] || ''}
                        onChange={(value) => updateField(index, field.key, value)}
                        onBlur={onBlur}
                      />
                    ) : field.type === 'color' ? (
                      <HexColorField key={field.key} label={field.label} value={block?.[field.key] || ''} allowEmpty
                        onChange={(value) => updateField(index, field.key, value)} onBlur={onBlur} />
                    ) : field.type === 'select' ? (
                      <FormControl key={field.key} size="small" fullWidth>
                        <InputLabel>{field.label}</InputLabel>
                        <Select
                          label={field.label}
                          value={block?.[field.key] || ''}
                          onChange={(event) => updateField(index, field.key, event.target.value)}
                          onBlur={onBlur}
                        >
                          {(field.options || []).map((option) => (
                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField
                        key={field.key}
                        label={field.label}
                        type={field.type || 'text'}
                        value={block?.[field.key] || ''}
                        onChange={(event) => updateField(index, field.key, event.target.value)}
                        onBlur={onBlur}
                        error={schema.title === 'Promo Blocks' && field.key === 'link' && !isValidPromoLink(block?.link)}
                        helperText={schema.title === 'Promo Blocks' && field.key === 'link'
                          ? 'Use a store path starting with / or an HTTP or HTTPS URL.'
                          : schema.key === 'slides' && field.key === 'title'
                          ? !String(block?.title || '').trim()
                            ? 'An empty heading uses the default hero heading.'
                            : block.title.length > 120 ? `${block.title.length} characters. Aim for 120 or fewer to fit smaller screens.` : undefined
                          : undefined}
                        size="small"
                        fullWidth
                        multiline={Boolean(field.multiline)}
                        rows={field.multiline ? 2 : undefined}
                      />
                    )
                  ))}
                  <Stack direction="row" spacing={0.75}>
                    <Button size="small" variant="outlined" disabled={index === 0} onClick={() => moveBlock(index, -1)}>Move Up</Button>
                    <Button size="small" variant="outlined" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)}>Move Down</Button>
                    <Box sx={{ flex: 1 }} />
                    <IconButton size="small" color="error" title="Delete block" onClick={() => {
                      const nextBlocks = blocks.filter((_, blockIndex) => blockIndex !== index);
                      updateBlocks(nextBlocks);
                      const nextIndex = Math.min(index, Math.max(0, nextBlocks.length - 1));
                      setExpandedIndex(nextIndex);
                      if (nextBlocks.length > 0) onBlockFocus?.(schema.key, nextIndex);
                    }}>
                      <DeleteIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                updateBlocks([...blocks, schema.create()]);
                setExpandedIndex(blocks.length);
                onBlockFocus?.(schema.key, blocks.length);
              }}
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
            >
              {schema.addLabel}
            </Button>
            <Button
              size="small"
              variant="text"
              color="secondary"
              onClick={() => updateBlocks(undefined)}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Reset to default content
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'warning.50', border: '1px dashed', borderColor: 'warning.main' }}>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, display: 'block' }}>
              No blocks in this section. This section will render empty on the storefront.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                updateBlocks([schema.create()]);
                setExpandedIndex(0);
                onBlockFocus?.(schema.key, 0);
              }}
              sx={{ textTransform: 'none' }}
            >
              {schema.addLabel}
            </Button>
            <Button
              size="small"
              variant="text"
              color="secondary"
              onClick={() => updateBlocks(undefined)}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Reset to default content
            </Button>
          </Stack>
        </Stack>
      )}
    </FieldGroup>
  );
};

const GalleryAlbumField = ({ slug, onChange, onBlur }) => {
  const enabled = useFeature('gallery');
  const [albums, setAlbums] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    galleryService.listPublic()
      .then(({ data }) => { if (!cancelled) setAlbums(data); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [enabled]);

  if (!enabled) return <Typography color="text.secondary">Enable Gallery in Features to select an album.</Typography>;
  if (failed) return <Typography color="error" role="alert">Could not load albums. Reopen this section to retry.</Typography>;
  if (!albums) return <Typography color="text.secondary" role="status">Loading albums…</Typography>;

  return (
    <TextField
      select
      label="Gallery album"
      size="small"
      fullWidth
      value={slug || ''}
      onChange={(event) => {
        onChange('gallerySlug', event.target.value || undefined);
        onBlur();
      }}
      helperText={albums.length ? 'Images follow the order saved in Gallery.' : 'Create and activate an album in Catalog → Gallery.'}
    >
      <MenuItem value="">Choose an album</MenuItem>
      {slug && !albums.some((album) => album.slug === slug) && <MenuItem value={slug} disabled>Unavailable album</MenuItem>}
      {albums.map((album) => <MenuItem key={album.id} value={album.slug}>{album.title}</MenuItem>)}
    </TextField>
  );
};

const CampaignLabelSelect = ({ value, onChange }) => {
  const [labels, setLabels] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    getSaleLabels().then(({ data }) => {
      if (active) setLabels(data?.data || []);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);

  return (
    <TextField
      select fullWidth size="small" label="Sale label" value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      helperText={failed ? 'Could not load sale labels.' : 'Show only active deals with this label.'}
      error={failed}
    >
      <MenuItem value="">All sale products</MenuItem>
      {value && !labels?.some((label) => label.id === value) && (
        <MenuItem value={value} disabled>{labels ? 'Unavailable sale label' : value}</MenuItem>
      )}
      {labels?.map((label) => (
        <MenuItem key={label.id} value={label.id} disabled={label.isActive === false}>
          {label.text || label.label || label.name || label.id}
        </MenuItem>
      ))}
    </TextField>
  );
};

const DesignerSectionEditor = ({
  allowSharedPlacement,
  pageSection,
  brandsEnabled,
  categoryPage,
  section,
  inheritedBlocks = [],
  onBack,
  onBackToSection,
  activeBlockLabel,
  onChange,
  onBlur,
  onApplyPreset,
  onDuplicate,
  onDelete,
  onComponentEdit,
  activeBlockKey,
  activeBlockIndex,
  blockInsertion,
  mappedComponent,
  mappedComponentLabel,
  onBlockFocus,
}) => {
  const formRef = useRef(null);
  if (!section) return null;

  const variants = SECTION_VARIANTS[section.type] || [];
  const isProductRow  = section.type === 'product-row';
  const isRecentlyViewed = section.type === 'recently-viewed';
  const isCountdown   = section.type === 'countdown-sale';
  const isNewsletter  = section.type === 'newsletter-signup';
  const isHero        = section.type === 'hero-carousel';
  const isEditorial   = section.type === 'editorial-image-text';
  const hasCategories = has('category-shortcuts', 'featured-collection-grid')(section);
  const curatedCategories = section.type === 'category-shortcuts' && Array.isArray(section.selectedCategorySlugs);
  const isBrandShowcase = section.type === 'brand-showcase';
  const curatedBrands = isBrandShowcase && Array.isArray(section.selectedBrandSlugs);
  const hasCtaLink    = isCountdown || has('editorial-image-text', 'promo-banners')(section);
  const blockSchema   = BLOCK_FIELD_PRESETS[section.type];
  const productLayout = section.variant || section.layout || (pageSection && isProductRow ? productRow.defaults.layout : 'grid');
  const sectionName = section.title || getSectionLabel(section);

  // System page section flags — these sections have no editable blocks but do have layout options
  const isCheckoutMain  = section.type === 'checkout-main';
  const isWishlistMain  = section.type === 'wishlist-main';
  const isSearchMain    = section.type === 'search-main';
  const isNotFoundMain  = section.type === 'not-found-main';
  const isOrdersMain    = section.type === 'orders-main';
  const isCartMain      = section.type === 'cart-main';
  const isSystemSection = isCheckoutMain || isWishlistMain || isSearchMain || isNotFoundMain || isOrdersMain || isCartMain;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Panel Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <IconButton size="small" aria-label={activeBlockLabel ? 'Back to section settings' : 'Close section settings'}
          onClick={activeBlockLabel ? () => {
            onBackToSection?.();
            formRef.current?.scrollTo?.({ top: 0 });
          } : onBack} sx={{ flexShrink: 0 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ fontSize: '0.88rem' }}>
            {activeBlockLabel || sectionName}
          </Typography>
          {(activeBlockLabel || sectionName !== getSectionLabel(section)) && (
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {activeBlockLabel ? sectionName : getSectionLabel(section)}
            </Typography>
          )}
        </Box>
        {onDuplicate && !activeBlockLabel && (
          <IconButton size="small" title="Duplicate" onClick={() => onDuplicate(section)}>
            <ContentCopyIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
        {onDelete && !activeBlockLabel && (
          <IconButton size="small" color="error" title="Delete" onClick={() => onDelete(section)}>
            <DeleteIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </Box>

      {/* Quick actions */}
      {!activeBlockLabel && (onApplyPreset || mappedComponent) && <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1}>
          {onApplyPreset && <Button
            size="small"
            variant="outlined"
            fullWidth
            startIcon={<AutoFixHighIcon sx={{ fontSize: 14 }} />}
            onClick={onApplyPreset}
            sx={{ fontSize: '0.75rem', py: 0.5 }}
          >
            Smart Preset
          </Button>}
          {mappedComponent && (
            <Button
              size="small"
              variant="text"
              fullWidth
              onClick={() => onComponentEdit(mappedComponent)}
              sx={{ fontSize: '0.72rem', py: 0.5, textTransform: 'none', color: 'primary.main' }}
            >
              Edit {mappedComponentLabel} →
            </Button>
          )}
        </Stack>
      </Box>}

      {/* Scrollable form */}
      <Box ref={formRef} sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        <Stack spacing={1.5}>

          {(onDelete || onDuplicate) && (
            <FieldGroup label="Visibility" icon={<DevicesIcon sx={{ fontSize: 15 }} />}>
              {[
                ['enabled', 'Show section', section.enabled !== false],
                ['hideOnMobile', 'Hide on mobile', section.hideOnMobile === true],
                ['hideOnDesktop', 'Hide on desktop', section.hideOnDesktop === true],
              ].map(([key, label, checked]) => (
                <FormControlLabel key={key} label={label} labelPlacement="start" sx={{ m: 0, justifyContent: 'space-between' }}
                  control={<Switch size="small" checked={checked} inputProps={{ role: 'switch' }} onChange={(event) => {
                    onChange(key, key === 'enabled' ? event.target.checked : (event.target.checked || undefined));
                    onBlur();
                  }} />}
                />
              ))}
            </FieldGroup>
          )}
          {/* ── DATA SOURCE (product-row / category sections) ── */}
          {(isProductRow || isRecentlyViewed || hasCategories || isBrandShowcase) && (
            <FieldGroup label="Content source" icon={<StorageIcon sx={{ fontSize: 15 }} />} defaultOpen={isProductRow || section.type === 'category-shortcuts' || isBrandShowcase}>
              {section.type === 'category-shortcuts' && (
                <CatalogSelectionPicker source="category" selected={section.selectedCategorySlugs}
                  onChange={(value) => { onChange('selectedCategorySlugs', value); onBlur(); }} />
              )}
              {isBrandShowcase && (
                <CatalogSelectionPicker source="brand" selected={section.selectedBrandSlugs}
                  onChange={(value) => { onChange('selectedBrandSlugs', value); onBlur(); }} />
              )}
              {(isProductRow || isRecentlyViewed) && (
                <>
                  {isProductRow && <FormControl size="small" fullWidth>
                    <InputLabel>Product Source</InputLabel>
                    <Select
                      value={section.source || productRow.defaults.source}
                      label="Product Source"
                      onChange={(event) => {
                        const source = event.target.value;
                        onChange('source', source);
                        if (source === 'staffPicks' && section.viewAllLink?.startsWith('/products?')) {
                          onChange('viewAllLink', '');
                        }
                        if (source === 'trending' && section.viewAllLink === '/products?featured=true') {
                          onChange('viewAllLink', '/products?sort=trending');
                        }
                        onBlur();
                      }}
                    >
                      {Object.entries(productRow.sources).map(([value, source]) => <MenuItem key={value} value={value}>{source.label}</MenuItem>)}
                    </Select>
                  </FormControl>}
                  {isProductRow && section.source !== 'staffPicks' && usesProductRowSource(section) &&
                    (brandsEnabled || section.query?.brand) && (
                      <ProductRowBrandFilter brand={section.query?.brand} enabled={brandsEnabled}
                        onChange={(brand) => {
                          const query = { ...section.query };
                          if (brand) query.brand = brand;
                          else delete query.brand;
                          onChange('query', Object.keys(query).length ? query : undefined);
                          onBlur();
                        }} />
                    )}
                  {isProductRow && (
                    <TextField select label="Product layout" size="small" value={productLayout}
                      onChange={(event) => { onChange('variant', event.target.value); onBlur(); }}>
                      <MenuItem value="carousel">Carousel</MenuItem>
                      <MenuItem value="grid">Grid</MenuItem>
                      <MenuItem value="grid-compact">Compact grid</MenuItem>
                    </TextField>
                  )}
                  {isProductRow && section.source === 'sale' && (
                    <CampaignLabelSelect value={section.saleLabel} onChange={(value) => {
                      onChange('saleLabel', value);
                      onBlur();
                    }} />
                  )}
                  {isProductRow && section.source === 'staffPicks' && (
                    <StaffPicksEditor ids={section.productIds || []} onChange={(ids) => {
                      onChange('productIds', ids);
                      onBlur();
                    }} />
                  )}
                  <TextField
                    label="Count"
                    type="number"
                    disabled={section.source === 'staffPicks'}
                    value={section.source === 'staffPicks' ? section.productIds?.length || 0 : section.count || productRow.defaults.count}
                    onChange={(e) => onChange('count', Math.min(isRecentlyViewed ? 12 : productRow.limits.editorMaxCount, Math.max(productRow.limits.minCount, parseInt(e.target.value) || productRow.defaults.count)))}
                    onBlur={onBlur}
                    size="small"
                    fullWidth
                    inputProps={{ min: productRow.limits.minCount, max: isRecentlyViewed ? 12 : productRow.limits.editorMaxCount }}
                  />
                  {isProductRow && productLayout !== 'carousel' && (
                    <FormControlLabel label="Carousel on mobile" labelPlacement="start" sx={{ m: 0, justifyContent: 'space-between' }}
                      control={<Switch size="small" checked={section.mobileCarousel === true} inputProps={{ role: 'switch' }}
                        onChange={(event) => { onChange('mobileCarousel', event.target.checked || undefined); onBlur(); }} />}
                    />
                  )}
                  {isProductRow && productLayout !== 'carousel' && (
                    [
                      ['columnsMobile', 'Mobile columns', productRow.responsiveColumns.mobile],
                      ['columnsTablet', 'Tablet columns', productRow.responsiveColumns.tablet],
                      ['columnsDesktop', 'Desktop columns', [2, 3, 4, 6]],
                    ].filter(([key]) => key !== 'columnsMobile' || !section.mobileCarousel).map(([key, label, options]) => (
                      <TextField key={key} select size="small" label={label} value={section[key] ?? ''}
                        onChange={(event) => { onChange(key, event.target.value || undefined); onBlur(); }}>
                        <MenuItem value="">Use layout default</MenuItem>
                        {options.map((columns) => <MenuItem key={columns} value={columns}>{columns}</MenuItem>)}
                      </TextField>
                    ))
                  )}
                  {isProductRow && productLayout !== 'carousel' && [
                    ['horizontalGap', 'Horizontal gap'],
                    ['verticalGap', 'Vertical gap'],
                  ].map(([key, label]) => (
                    <TextField key={key} size="small" type="number" label={label} value={section[key] ?? ''}
                      placeholder="Layout default"
                      inputProps={{ min: 0, max: productRow.gridGapMax, step: 1 }}
                      InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
                      onChange={(event) => {
                        const input = event.target.value;
                        const pixels = Number(input);
                        if (input === '') onChange(key, undefined);
                        else if (Number.isInteger(pixels) && pixels >= 0 && pixels <= productRow.gridGapMax) onChange(key, pixels);
                      }}
                      onBlur={onBlur}
                    />
                  ))}
                  {isProductRow && !(section.source === 'sale' && section.saleLabel) && <TextField
                    label="View All Link"
                    value={section.viewAllLink || ''}
                    onChange={(e) => onChange('viewAllLink', e.target.value)}
                    onBlur={onBlur}
                    size="small"
                    fullWidth
                    placeholder="/products?featured=true"
                  />}
                </>
              )}
              {hasCategories && !curatedCategories && (
                <TextField
                  label="Count"
                  type="number"
                  value={section.count || 10}
                  onChange={(e) => onChange('count', parseInt(e.target.value) || 10)}
                  onBlur={onBlur}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1, max: 16 }}
                />
              )}
            </FieldGroup>
          )}

          {pageSection && (
            <TextField select size="small" label="Position on page" value={section.pagePosition || 'below'}
              onChange={(event) => onChange('pagePosition', event.target.value)}>
              <MenuItem value="above">Above page content</MenuItem>
              <MenuItem value="below">Below page content</MenuItem>
            </TextField>
          )}
          {pageSection && categoryPage && isProductRow && section.source !== 'staffPicks' && (
            <TextField select size="small" label="Product scope" value={section.productScope || 'category'}
              onChange={(event) => onChange('productScope', event.target.value)}>
              <MenuItem value="category">This category</MenuItem>
              <MenuItem value="store">Entire store</MenuItem>
            </TextField>
          )}
          {allowSharedPlacement && section.type === 'composed-hero' && (
            <TextField select size="small" label="Placement" value={section.placement || 'content'}
              onChange={(event) => {
                onChange('placement', event.target.value === 'content' ? undefined : event.target.value);
                onBlur();
              }}>
              <MenuItem value="content">Home page</MenuItem>
              <MenuItem value="header">Shared header</MenuItem>
              <MenuItem value="footer">Shared footer</MenuItem>
            </TextField>
          )}

          {['composed-hero', 'product-info', 'editorial-image-text'].includes(section.type) && (
            <ComposedHeroEditor
              productInformation={section.type === 'product-info'}
              orderedDetails={section.type === 'product-info' && Array.isArray(section.detailsBlockOrder)}
              insertion={blockInsertion}
              blocks={section.heroBlocks}
              activeId={activeBlockKey === 'heroBlocks' ? activeBlockIndex : null}
              onChange={(blocks, insertion) => insertion ? onChange('heroBlocks', blocks, insertion) : onChange('heroBlocks', blocks)}
              onCommit={onBlur}
              onFocus={(id) => onBlockFocus?.('heroBlocks', id)}
              ImageField={ImageField}
            />
          )}

          {/* ── SYSTEM SECTION INFO + OPTIONS ── */}
          {isSystemSection && (
            <FieldGroup label="Page Section Options" defaultOpen>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6 }}>
                This is a system section. Layout and content options are in
                <strong> Page Settings</strong> (the accordion above the section list).
                Changes here apply section-level overrides.
              </Typography>

              {isSearchMain && (
                <>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Grid Columns</InputLabel>
                    <Select
                      value={section.gridColumns || 4}
                      label="Grid Columns"
                      onChange={(e) => { onChange('gridColumns', Number(e.target.value)); onBlur(); }}
                    >
                      <MenuItem value={2}>2 columns</MenuItem>
                      <MenuItem value={3}>3 columns</MenuItem>
                      <MenuItem value={4}>4 columns</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="No Results Message"
                    value={section.noResultsMessage || ''}
                    onChange={(e) => onChange('noResultsMessage', e.target.value)}
                    onBlur={onBlur}
                    size="small" fullWidth multiline rows={2}
                    placeholder="No products found for your search."
                  />
                </>
              )}

              {isNotFoundMain && (
                <>
                  <TextField
                    label="Headline"
                    value={section.headline || ''}
                    onChange={(e) => onChange('headline', e.target.value)}
                    onBlur={onBlur}
                    size="small" fullWidth
                    placeholder="Page Not Found"
                  />
                  <TextField
                    label="Sub-text"
                    value={section.subtext || ''}
                    onChange={(e) => onChange('subtext', e.target.value)}
                    onBlur={onBlur}
                    size="small" fullWidth multiline rows={2}
                    placeholder="Sorry, the page you're looking for doesn't exist."
                  />
                  <TextField
                    label="Primary CTA Label"
                    value={section.cta1Label || ''}
                    onChange={(e) => onChange('cta1Label', e.target.value)}
                    onBlur={onBlur}
                    size="small" fullWidth
                    placeholder="Browse Products"
                  />
                  <TextField
                    label="Primary CTA Link"
                    value={section.cta1Link || ''}
                    onChange={(e) => onChange('cta1Link', e.target.value)}
                    onBlur={onBlur}
                    size="small" fullWidth
                    placeholder="/products"
                  />
                </>
              )}

              {isOrdersMain && (
                <TextField
                  label="Empty State Headline"
                  value={section.emptyHeadline || ''}
                  onChange={(e) => onChange('emptyHeadline', e.target.value)}
                  onBlur={onBlur}
                  size="small" fullWidth
                  placeholder="You haven't placed any orders yet"
                />
              )}

              {isCartMain && (
                <TextField
                  label="Empty Cart Headline"
                  value={section.emptyHeadline || ''}
                  onChange={(e) => onChange('emptyHeadline', e.target.value)}
                  onBlur={onBlur}
                  size="small" fullWidth
                  placeholder="Your cart is empty"
                />
              )}

              {isCheckoutMain && (
                <TextField
                  label="Place Order Button Label"
                  value={section.placeOrderLabel || ''}
                  onChange={(e) => onChange('placeOrderLabel', e.target.value)}
                  onBlur={onBlur}
                  size="small" fullWidth
                  placeholder="Place Order"
                />
              )}
            </FieldGroup>
          )}

          {['tag-showcase', 'gallery-grid'].includes(section.type) && (
            <MerchandisingSourceControls section={section} onChange={onChange} onBlur={onBlur} />
          )}

          {/* ── CONTENT (skip for pure system sections) ── */}
          {!isSystemSection && (
          <FieldGroup label={isHero ? "Section Info" : "Content"} defaultOpen icon={<TextFieldsIcon sx={{ fontSize: 15 }} />}>
            <TextField
              label={isHero ? "Section Name" : "Title"}
              value={section.title || ''}
              onChange={(e) => onChange('title', e.target.value)}
              onBlur={onBlur}
              size="small"
              fullWidth
              helperText={isHero ? "Name shown in the designer sidebar. Slide headings are configured under Slides below." : undefined}
            />
            {!isHero && (
              <TextField
                label="Subtitle"
                value={section.subtitle || ''}
                onChange={(e) => onChange('subtitle', e.target.value)}
                onBlur={onBlur}
                size="small"
                fullWidth
              />
            )}

            {isNewsletter && (
              <TextField
                label="Button Text"
                value={section.ctaText || ''}
                onChange={(e) => onChange('ctaText', e.target.value)}
                onBlur={onBlur}
                size="small"
                fullWidth
                placeholder="Subscribe"
              />
            )}

            {section.type === 'gallery' && (
              <GalleryAlbumField slug={section.gallerySlug} onChange={onChange} onBlur={onBlur} />
            )}

            {isCountdown && (
              <>
                <TextField
                  label="End Date & Time"
                  type="datetime-local"
                  value={section.endDate ? section.endDate.slice(0, 16) : ''}
                  onChange={(e) => {
                    const isoVal = e.target.value ? new Date(e.target.value).toISOString() : '';
                    onChange('endDate', isoVal);
                  }}
                  onBlur={onBlur}
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  helperText="Countdown auto-hides after this date"
                />
                <TextField
                  label="CTA Link"
                  value={section.ctaLink || ''}
                  onChange={(e) => onChange('ctaLink', e.target.value)}
                  onBlur={onBlur}
                  size="small"
                  fullWidth
                  placeholder="/products?onSale=true"
                />
                <TextField
                  label="CTA Text"
                  value={section.ctaText || ''}
                  onChange={(e) => onChange('ctaText', e.target.value)}
                  onBlur={onBlur}
                  size="small"
                  fullWidth
                  placeholder="Shop Sale"
                />
              </>
            )}

            {isEditorial && (
              <>
                <TextField
                  label="Eyebrow"
                  value={section.eyebrow || ''}
                  onChange={(e) => onChange('eyebrow', e.target.value)}
                  onBlur={onBlur}
                  size="small"
                  fullWidth
                  placeholder="Brand story"
                />
                <ImageField
                  label="Editorial image"
                  value={section.image || ''}
                  onChange={(value) => onChange('image', value)}
                  onBlur={onBlur}
                />
                <FormControl size="small" fullWidth>
                  <InputLabel>Image Focus</InputLabel>
                  <Select
                    value={section.imageFocus || 'center'}
                    label="Image Focus"
                    onChange={(e) => { onChange('imageFocus', e.target.value); onBlur(); }}
                  >
                    <MenuItem value="center">Center</MenuItem>
                    <MenuItem value="top">Top</MenuItem>
                    <MenuItem value="bottom">Bottom</MenuItem>
                    <MenuItem value="left">Left</MenuItem>
                    <MenuItem value="right">Right</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}

            {hasCtaLink && !isCountdown && (
              <>
                <TextField
                  label="CTA Link"
                  value={section.ctaLink || ''}
                  onChange={(e) => onChange('ctaLink', e.target.value)}
                  onBlur={onBlur}
                  size="small"
                  fullWidth
                  placeholder="/products?featured=true"
                  error={section.type === 'promo-banners' && !isValidPromoLink(section.ctaLink)}
                  helperText={section.type === 'promo-banners' ? 'Use a store path starting with / or an HTTP or HTTPS URL.' : undefined}
                />
                <TextField
                  label="CTA Text"
                  value={section.ctaText || ''}
                  onChange={(e) => onChange('ctaText', e.target.value)}
                  onBlur={onBlur}
                  size="small"
                  fullWidth
                  placeholder="Shop Now"
                />
              </>
            )}
          </FieldGroup>
          )}

          {blockSchema && !isSystemSection && !curatedCategories && !curatedBrands && (
            <BlockListEditor
              section={section}
              schema={blockSchema}
              inheritedBlocks={inheritedBlocks}
              onChange={onChange}
              onBlur={onBlur}
              onBlockFocus={onBlockFocus}
              activeBlockKey={activeBlockKey}
              activeBlockIndex={activeBlockIndex}
            />
          )}

          {/* ── LAYOUT ── */}
          <FieldGroup label="Layout" defaultOpen={isProductRow} icon={<ViewQuiltIcon sx={{ fontSize: 15 }} />}>
            {isRecentlyViewed && (
              <TextField select label="Product layout" size="small" value={section.variant || section.layout || 'carousel'}
                onChange={(e) => { onChange('variant', e.target.value); onBlur(); }}>
                <MenuItem value="carousel">Carousel</MenuItem>
                <MenuItem value="grid">Grid</MenuItem>
                <MenuItem value="grid-compact">Compact grid</MenuItem>
              </TextField>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                Text Alignment
              </Typography>
              <ToggleButtonGroup
                value={section.textAlign || 'left'}
                exclusive
                fullWidth
                size="small"
                onChange={(_, value) => {
                  if (!value) return;
                  onChange('textAlign', value);
                  onBlur();
                }}
              >
                <ToggleButton value="left">Left</ToggleButton>
                <ToggleButton value="center">Centre</ToggleButton>
                <ToggleButton value="right">Right</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                Vertical Alignment
              </Typography>
              <ToggleButtonGroup
                value={section.verticalAlign || 'top'}
                exclusive
                fullWidth
                size="small"
                onChange={(_, value) => {
                  if (!value) return;
                  onChange('verticalAlign', value);
                  onBlur();
                }}
              >
                <ToggleButton value="top">Top</ToggleButton>
                <ToggleButton value="center">Middle</ToggleButton>
                <ToggleButton value="bottom">Bottom</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <FormControl size="small" fullWidth>
              <InputLabel>Content Width</InputLabel>
              <Select
                value={section.widthMode || 'container'}
                label="Content Width"
                onChange={(e) => { onChange('widthMode', e.target.value); onBlur(); }}
              >
                {WIDTH_PRESETS.map((preset) => (
                  <MenuItem key={preset.value} value={preset.value}>{preset.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {section.widthMode === 'custom' && (
              <TextField
                label="Custom Max Width (px)"
                type="number"
                value={section.customMaxWidth || ''}
                onChange={(e) => onChange('customMaxWidth', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                onBlur={onBlur}
                size="small"
                fullWidth
                inputProps={{ min: 320, max: 3840, step: 10 }}
                helperText="Width of the inner content container (background still extends to full viewport)"
              />
            )}

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                Padding (px)
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1}>
                  <TextField label="Top" type="number" value={section.paddingTop ?? 0}
                    onChange={(e) => onChange('paddingTop', parseInt(e.target.value, 10) || 0)}
                    onBlur={onBlur} size="small" fullWidth inputProps={{ min: 0, max: 240 }} />
                  <TextField label="Bottom" type="number" value={section.paddingBottom ?? 0}
                    onChange={(e) => onChange('paddingBottom', parseInt(e.target.value, 10) || 0)}
                    onBlur={onBlur} size="small" fullWidth inputProps={{ min: 0, max: 240 }} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField label="Left" type="number" value={section.paddingLeft ?? 0}
                    onChange={(e) => onChange('paddingLeft', parseInt(e.target.value, 10) || 0)}
                    onBlur={onBlur} size="small" fullWidth inputProps={{ min: 0, max: 240 }} />
                  <TextField label="Right" type="number" value={section.paddingRight ?? 0}
                    onChange={(e) => onChange('paddingRight', parseInt(e.target.value, 10) || 0)}
                    onBlur={onBlur} size="small" fullWidth inputProps={{ min: 0, max: 240 }} />
                </Stack>
              </Stack>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                Margin (px)
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1}>
                  <TextField label="Top" type="number" value={section.marginTop ?? 0}
                    onChange={(e) => onChange('marginTop', parseInt(e.target.value, 10) || 0)}
                    onBlur={onBlur} size="small" fullWidth inputProps={{ min: -240, max: 240 }} />
                  <TextField label="Bottom" type="number" value={section.marginBottom ?? 0}
                    onChange={(e) => onChange('marginBottom', parseInt(e.target.value, 10) || 0)}
                    onBlur={onBlur} size="small" fullWidth inputProps={{ min: -240, max: 240 }} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField label="Left" type="number" value={section.marginLeft ?? 0}
                    onChange={(e) => onChange('marginLeft', parseInt(e.target.value, 10) || 0)}
                    onBlur={onBlur} size="small" fullWidth inputProps={{ min: -240, max: 240 }} />
                  <TextField label="Right" type="number" value={section.marginRight ?? 0}
                    onChange={(e) => onChange('marginRight', parseInt(e.target.value, 10) || 0)}
                    onBlur={onBlur} size="small" fullWidth inputProps={{ min: -240, max: 240 }} />
                </Stack>
              </Stack>
            </Box>

            <TextField
              label="Minimum Height (px)"
              type="number"
              value={section.minHeight ?? ''}
              onChange={(e) => onChange('minHeight', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
              onBlur={onBlur}
              size="small"
              fullWidth
              inputProps={{ min: 0, max: 1200, step: 10 }}
              helperText="Optional. Useful for hero / banner sections"
            />
          </FieldGroup>

          {/* ── APPEARANCE ── */}
          <FieldGroup label="Style" defaultOpen={false} icon={<PaletteIcon sx={{ fontSize: 15 }} />}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Background
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Colour"
                type="color"
                value={section.backgroundColor || '#ffffff'}
                onChange={(e) => onChange('backgroundColor', e.target.value)}
                onBlur={onBlur}
                size="small"
                sx={{ width: 130, flexShrink: 0 }}
                InputLabelProps={{ shrink: true }}
              />
              <Button
                size="small"
                variant="text"
                onClick={() => { onChange('backgroundColor', undefined); onBlur(); }}
                sx={{ textTransform: 'none', fontSize: '0.7rem', color: 'text.secondary' }}
                disabled={!section.backgroundColor}
              >
                Clear
              </Button>
            </Stack>
            <ImageField
              label="Background Image"
              value={section.backgroundImage || ''}
              onChange={(value) => onChange('backgroundImage', value)}
              onBlur={onBlur}
            />
            {section.backgroundImage && (
              <Stack spacing={1}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Size</InputLabel>
                  <Select
                    value={section.backgroundSize || 'cover'}
                    label="Size"
                    onChange={(e) => { onChange('backgroundSize', e.target.value); onBlur(); }}
                  >
                    <MenuItem value="cover">Cover (fill)</MenuItem>
                    <MenuItem value="contain">Contain (fit)</MenuItem>
                    <MenuItem value="auto">Actual size</MenuItem>
                    <MenuItem value="100% 100%">Stretch</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Position</InputLabel>
                  <Select
                    value={section.backgroundPosition || 'center'}
                    label="Position"
                    onChange={(e) => { onChange('backgroundPosition', e.target.value); onBlur(); }}
                  >
                    <MenuItem value="center">Center</MenuItem>
                    <MenuItem value="top">Top</MenuItem>
                    <MenuItem value="bottom">Bottom</MenuItem>
                    <MenuItem value="left">Left</MenuItem>
                    <MenuItem value="right">Right</MenuItem>
                    <MenuItem value="top left">Top Left</MenuItem>
                    <MenuItem value="top right">Top Right</MenuItem>
                    <MenuItem value="bottom left">Bottom Left</MenuItem>
                    <MenuItem value="bottom right">Bottom Right</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Repeat</InputLabel>
                  <Select
                    value={section.backgroundRepeat || 'no-repeat'}
                    label="Repeat"
                    onChange={(e) => { onChange('backgroundRepeat', e.target.value); onBlur(); }}
                  >
                    <MenuItem value="no-repeat">No repeat</MenuItem>
                    <MenuItem value="repeat">Tile (both)</MenuItem>
                    <MenuItem value="repeat-x">Tile (horizontal)</MenuItem>
                    <MenuItem value="repeat-y">Tile (vertical)</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Scroll behaviour</InputLabel>
                  <Select
                    value={section.backgroundAttachment || 'scroll'}
                    label="Scroll behaviour"
                    onChange={(e) => { onChange('backgroundAttachment', e.target.value); onBlur(); }}
                  >
                    <MenuItem value="scroll">Scroll with page</MenuItem>
                    <MenuItem value="fixed">Parallax (fixed)</MenuItem>
                    <MenuItem value="local">Local</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}

            <Divider sx={{ my: 0.5 }} />

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Border
            </Typography>
            <FormControl size="small" fullWidth>
              <InputLabel>Style</InputLabel>
              <Select
                value={section.borderStyle || 'none'}
                label="Style"
                onChange={(e) => { onChange('borderStyle', e.target.value); onBlur(); }}
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="solid">Solid</MenuItem>
                <MenuItem value="dashed">Dashed</MenuItem>
                <MenuItem value="dotted">Dotted</MenuItem>
                <MenuItem value="double">Double</MenuItem>
              </Select>
            </FormControl>
            {section.borderStyle && section.borderStyle !== 'none' && (
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Width (px)"
                  type="number"
                  value={section.borderWidth ?? 1}
                  onChange={(e) => onChange('borderWidth', parseInt(e.target.value, 10) || 0)}
                  onBlur={onBlur}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, max: 24 }}
                />
                <TextField
                  label="Colour"
                  type="color"
                  value={section.borderColor || '#e0e0e0'}
                  onChange={(e) => onChange('borderColor', e.target.value)}
                  onBlur={onBlur}
                  size="small"
                  sx={{ width: 130, flexShrink: 0 }}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            )}
            <TextField
              label="Border Radius (px)"
              type="number"
              value={section.borderRadius ?? 0}
              onChange={(e) => onChange('borderRadius', parseInt(e.target.value, 10) || 0)}
              onBlur={onBlur}
              size="small"
              fullWidth
              inputProps={{ min: 0, max: 96 }}
              helperText="Rounds all four corners. 0 = square."
            />

            <Divider sx={{ my: 0.5 }} />

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Shadow
            </Typography>
            <FormControl size="small" fullWidth>
              <InputLabel>Box Shadow</InputLabel>
              <Select
                value={section.boxShadow || 'none'}
                label="Box Shadow"
                onChange={(e) => { onChange('boxShadow', e.target.value); onBlur(); }}
              >
                <MenuItem value="none">None</MenuItem>
                {Object.keys(SHADOW_PRESETS).filter((k) => k !== 'none').map((key) => (
                  <MenuItem key={key} value={key}>{key}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {variants.length > 0 && !isProductRow && !isRecentlyViewed && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <FormControl size="small" fullWidth>
                  <InputLabel>Variant Style</InputLabel>
                  <Select
                    value={section.variant || ''}
                    label="Variant Style"
                    onChange={(e) => { onChange('variant', e.target.value); onBlur(); }}
                  >
                    <MenuItem value="">Default</MenuItem>
                    {variants.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </>
            )}
          </FieldGroup>

          {/* ── RESPONSIVE ── */}
          {!(onDelete || onDuplicate) && <FieldGroup
            label="Responsive"
            icon={<DevicesIcon sx={{ fontSize: 15 }} />}
            defaultOpen={false}
          >
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={section.hideOnMobile === true}
                  onChange={(e) => { onChange('hideOnMobile', e.target.checked || undefined); onBlur(); }}
                />
              }
              label={<Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Hide on mobile</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={section.hideOnDesktop === true}
                  onChange={(e) => { onChange('hideOnDesktop', e.target.checked || undefined); onBlur(); }}
                />
              }
              label={<Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Hide on desktop</Typography>}
            />
          </FieldGroup>}

          {/* ── ADVANCED ── */}
          {['category-shortcuts', 'brand-showcase', 'value-props', 'trust-badges'].includes(section.type) && (
            <FieldGroup label="Grid columns">
              <TextField select size="small" fullWidth label="Desktop columns" value={section.columnsDesktop ?? ''}
                onChange={(event) => {
                  onChange('columnsDesktop', event.target.value || undefined);
                  onBlur();
                }}>
                <MenuItem value="">Use layout default</MenuItem>
                {[2, 3, 4, 6].map((columns) => <MenuItem key={columns} value={columns}>{columns}</MenuItem>)}
              </TextField>
            </FieldGroup>
          )}
          {section.type === 'catalog-explorer' && (
            <FieldGroup label="Catalog filters and layout" defaultOpen>
              {[
                ['showCategory', 'Show category filter'],
                ['showBrand', 'Show brand filter'],
                ['showSort', 'Show sorting'],
              ].map(([key, label]) => (
                <FormControlLabel key={key} label={label} control={<Switch
                  checked={section.catalogFilters?.[key] !== false}
                  onChange={(event) => {
                    onChange('catalogFilters', { ...section.catalogFilters, [key]: event.target.checked });
                    onBlur();
                  }}
                />} />
              ))}
              {[
                ['columnsDesktop', 'Desktop columns', 4, [2, 3, 4, 6]],
                ['pageSize', 'Products per page', 8, [4, 6, 8, 12, 16, 24]],
                ['defaultSort', 'Default sort', 'newest', ['newest', 'name_asc', 'price_asc', 'price_desc']],
              ].map(([key, label, fallback, options]) => (
                <TextField key={key} select size="small" fullWidth label={label}
                  value={section.catalogFilters?.[key] ?? fallback}
                  onChange={(event) => {
                    onChange('catalogFilters', { ...section.catalogFilters, [key]: event.target.value });
                    onBlur();
                  }}>
                  {[...new Set([...options, section.catalogFilters?.[key]].filter((value) => value != null))].map((value) => (
                    <MenuItem key={value} value={value}>
                      {{ newest: 'Newest', name_asc: 'Name A to Z', price_asc: 'Price low to high', price_desc: 'Price high to low' }[value] || value}
                    </MenuItem>
                  ))}
                </TextField>
              ))}
            </FieldGroup>
          )}
          <FieldGroup label="Advanced" icon={<TuneIcon sx={{ fontSize: 15 }} />} defaultOpen={false}>
            <TextField
              label="Anchor ID"
              value={section.anchorId || ''}
              onChange={(e) => onChange('anchorId', e.target.value || undefined)}
              onBlur={onBlur}
              size="small"
              fullWidth
              placeholder="e.g. summer-sale"
              helperText="Lets you link to this section with #anchor-id"
            />
            <TextField
              label="Custom CSS Class"
              value={section.customClassName || ''}
              onChange={(e) => onChange('customClassName', e.target.value || undefined)}
              onBlur={onBlur}
              size="small"
              fullWidth
              placeholder="my-section-class"
              helperText="Add custom classes for advanced styling"
            />
          </FieldGroup>

          {/* ── CAROUSEL settings ── */}
          {isHero && (
            <FieldGroup label="Carousel behavior" defaultOpen={false}>
              <TextField
                label="Auto-play interval (ms)"
                type="number"
                value={section.interval || 6500}
                onChange={(e) => onChange('interval', parseInt(e.target.value) || 6500)}
                onBlur={onBlur}
                size="small"
                fullWidth
                inputProps={{ min: 1000, max: 30000, step: 500 }}
                helperText="6500ms = 6.5 seconds between slides"
              />
            </FieldGroup>
          )}

        </Stack>
      </Box>
    </Box>
  );
};

export default DesignerSectionEditor;
