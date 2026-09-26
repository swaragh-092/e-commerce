import { useState, useEffect } from 'react';
import {
  Box, Stack, Typography, IconButton, Button, Chip, Divider,
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
import { SECTION_VARIANTS } from '../../../storefront/sections/sectionRegistry';
import { SHADOW_PRESETS, WIDTH_PRESETS } from '../../../storefront/sections/SectionFallback';
import MediaPicker from '../../../common/MediaPicker';
import { getMediaUrl } from '../../../../utils/media';

const PRODUCT_SOURCES = [
  { value: 'featured', label: 'Featured' },
  { value: 'sale', label: 'On Sale' },
  { value: 'bestSellers', label: 'Best Sellers' },
  { value: 'newest', label: 'Newest' },
  { value: 'recommended', label: 'Recommended' },
];


const BLOCK_FIELD_PRESETS = {
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

const FieldGroup = ({ label, icon, defaultOpen = true, children }) => (
  <Accordion
    defaultExpanded={defaultOpen}
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
  </Accordion>
);


const BlockListEditor = ({ section, schema, onChange, onBlur, onBlockFocus, activeBlockKey, activeBlockIndex }) => {
  const blocks = Array.isArray(section?.[schema.key]) ? section[schema.key] : [];
  const [expandedIndex, setExpandedIndex] = useState(0);

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
    <FieldGroup label={schema.title} defaultOpen={activeBlockKey === schema.key} icon={<TextFieldsIcon sx={{ fontSize: 15 }} />}>
      {blocks.length ? (
        blocks.map((block, index) => (
          <Accordion
            key={`${schema.key}-${index}`}
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
                      value={block?.[field.key] || ''}
                      onChange={(value) => updateField(index, field.key, value)}
                      onBlur={onBlur}
                    />
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
                      size="small"
                      fullWidth
                      multiline={Boolean(field.multiline)}
                      rows={field.multiline ? 2 : undefined}
                      InputLabelProps={field.type === 'color' ? { shrink: true } : undefined}
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
        ))
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          No local blocks yet. Add one to override demo/fallback content for this section.
        </Typography>
      )}
      <Button size="small" variant="outlined" onClick={() => { updateBlocks([...blocks, schema.create()]); setExpandedIndex(blocks.length); onBlockFocus?.(schema.key, blocks.length); }} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
        {schema.addLabel}
      </Button>
    </FieldGroup>
  );
};

const DesignerSectionEditor = ({
  section,
  onBack,
  onChange,
  onBlur,
  onApplyPreset,
  onDuplicate,
  onDelete,
  onComponentEdit,
  activeBlockKey,
  activeBlockIndex,
  mappedComponent,
  mappedComponentLabel,
  onBlockFocus,
}) => {
  if (!section) return null;

  const variants = SECTION_VARIANTS[section.type] || [];
  const isProductRow  = section.type === 'product-row';
  const isCountdown   = section.type === 'countdown-sale';
  const isNewsletter  = section.type === 'newsletter-signup';
  const isHero        = section.type === 'hero-carousel';
  const isEditorial   = section.type === 'editorial-image-text';
  const hasCategories = has('category-shortcuts', 'featured-collection-grid')(section);
  const hasCtaLink    = isCountdown || has('editorial-image-text', 'promo-banners')(section);
  const blockSchema   = BLOCK_FIELD_PRESETS[section.type];

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
        <IconButton size="small" onClick={onBack} sx={{ flexShrink: 0 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ fontSize: '0.88rem' }}>
            {section.title || section.type}
          </Typography>
          <Chip label={section.type} size="small" variant="outlined"
            sx={{ height: 17, fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0.2, mt: 0.25 }} />
        </Box>
        <IconButton size="small" title="Duplicate" onClick={() => onDuplicate(section)}>
          <ContentCopyIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <IconButton size="small" color="error" title="Delete" onClick={() => onDelete(section)}>
          <DeleteIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>

      {/* Quick actions */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            fullWidth
            startIcon={<AutoFixHighIcon sx={{ fontSize: 14 }} />}
            onClick={onApplyPreset}
            sx={{ fontSize: '0.75rem', py: 0.5 }}
          >
            Smart Preset
          </Button>
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
      </Box>

      <Divider />

      {/* Scrollable form */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        <Stack spacing={1.5}>

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

          {/* ── CONTENT (skip for pure system sections) ── */}
          {!isSystemSection && (
          <FieldGroup label="Content" defaultOpen icon={<TextFieldsIcon sx={{ fontSize: 15 }} />}>
            <TextField
              label="Title"
              value={section.title || ''}
              onChange={(e) => onChange('title', e.target.value)}
              onBlur={onBlur}
              size="small"
              fullWidth
            />
            <TextField
              label="Subtitle"
              value={section.subtitle || ''}
              onChange={(e) => onChange('subtitle', e.target.value)}
              onBlur={onBlur}
              size="small"
              fullWidth
            />

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

          {blockSchema && !isSystemSection && (
            <BlockListEditor section={section} schema={blockSchema} onChange={onChange} onBlur={onBlur} onBlockFocus={onBlockFocus} activeBlockKey={activeBlockKey} activeBlockIndex={activeBlockIndex} />
          )}

          {/* ── LAYOUT ── */}
          <FieldGroup label="Layout" defaultOpen={false} icon={<ViewQuiltIcon sx={{ fontSize: 15 }} />}>
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

            {variants.length > 0 && (
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
          <FieldGroup
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
          </FieldGroup>

          {/* ── ADVANCED ── */}
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

          {/* ── DATA SOURCE (product-row / category sections) ── */}
          {(isProductRow || hasCategories) && (
            <FieldGroup label="Content source" icon={<StorageIcon sx={{ fontSize: 15 }} />} defaultOpen={false}>
              {isProductRow && (
                <>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Product Source</InputLabel>
                    <Select
                      value={section.source || 'featured'}
                      label="Product Source"
                      onChange={(e) => { onChange('source', e.target.value); onBlur(); }}
                    >
                      {PRODUCT_SOURCES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Count"
                    type="number"
                    value={section.count || 8}
                    onChange={(e) => onChange('count', parseInt(e.target.value) || 8)}
                    onBlur={onBlur}
                    size="small"
                    fullWidth
                    inputProps={{ min: 1, max: 24 }}
                  />
                  <TextField
                    label="View All Link"
                    value={section.viewAllLink || ''}
                    onChange={(e) => onChange('viewAllLink', e.target.value)}
                    onBlur={onBlur}
                    size="small"
                    fullWidth
                    placeholder="/products?featured=true"
                  />
                </>
              )}
              {hasCategories && (
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
