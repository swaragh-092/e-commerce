import { useRef, useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { getSectionLabel, isHeroSection } from './sectionRegistry';
import MediaPicker from '../../common/MediaPicker';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';

export const UnsupportedSection = ({ section, mode = 'live' }) => (
  <Box
    role="status"
    sx={{
      p: 2,
      border: '1px dashed',
      borderColor: 'warning.main',
      borderRadius: 2,
      bgcolor: 'warning.50',
    }}
  >
    <Typography variant="subtitle2" fontWeight={900}>Unsupported template section</Typography>
    <Typography variant={mode === 'preview' ? 'caption' : 'body2'} color="text.secondary">
      {getSectionLabel(section)} is registered in the template package but has no {mode} renderer yet.
    </Typography>
  </Box>
);

const spacingValue = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = Number(value);
  if (!Number.isNaN(numberValue)) return `${numberValue}px`;
  return value;
};

const cssUrl = (value) => {
  if (!value) return undefined;
  const trimmed = String(value).trim().replace(/^['"]|['"]$/g, '');
  return `url("${trimmed}")`;
};

export const SHADOW_PRESETS = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(15, 23, 42, 0.06)',
  md: '0 4px 6px -1px rgba(15, 23, 42, 0.10), 0 2px 4px -2px rgba(15, 23, 42, 0.06)',
  lg: '0 10px 15px -3px rgba(15, 23, 42, 0.10), 0 4px 6px -4px rgba(15, 23, 42, 0.05)',
  xl: '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
  '2xl': '0 25px 50px -12px rgba(15, 23, 42, 0.30)',
  inner: 'inset 0 2px 4px 0 rgba(15, 23, 42, 0.06)',
};

export const WIDTH_PRESETS = [
  { value: 'container', label: 'Container (default)', maxWidth: 'xl' },
  { value: 'narrow', label: 'Narrow', maxWidth: 'md' },
  { value: 'full', label: 'Full width', maxWidth: null },
  { value: 'custom', label: 'Custom', maxWidth: null },
];

export const sectionWrapperSx = (section = {}) => {
  const sx = {};

  const mt = spacingValue(section.marginTop);
  if (mt !== undefined) sx.mt = mt;
  const mb = spacingValue(section.marginBottom);
  if (mb !== undefined) sx.mb = mb;
  const ml = spacingValue(section.marginLeft);
  if (ml !== undefined) sx.ml = ml;
  const mr = spacingValue(section.marginRight);
  if (mr !== undefined) sx.mr = mr;

  if (section.backgroundColor) sx.bgcolor = section.backgroundColor;
  const bgUrl = cssUrl(section.backgroundImage);
  if (bgUrl) sx.backgroundImage = bgUrl;
  if (section.backgroundSize) sx.backgroundSize = section.backgroundSize;
  if (section.backgroundPosition) sx.backgroundPosition = section.backgroundPosition;
  if (section.backgroundRepeat) sx.backgroundRepeat = section.backgroundRepeat;
  if (section.backgroundAttachment) sx.backgroundAttachment = section.backgroundAttachment;

  if (section.borderStyle && section.borderStyle !== 'none') {
    sx.borderStyle = section.borderStyle;
    const bw = spacingValue(section.borderWidth);
    if (bw !== undefined) sx.borderWidth = bw;
    if (section.borderColor) sx.borderColor = section.borderColor;
  }

  const radius = spacingValue(section.borderRadius);
  if (radius !== undefined) sx.borderRadius = radius;

  if (section.boxShadow && SHADOW_PRESETS[section.boxShadow]) {
    sx.boxShadow = SHADOW_PRESETS[section.boxShadow];
  }

  if (section.minHeight) {
    const mh = spacingValue(section.minHeight);
    if (mh !== undefined) sx.minHeight = mh;
  }

  if (section.maxWidth) {
    const w = spacingValue(section.maxWidth);
    if (w !== undefined) sx.maxWidth = w;
  }

  return sx;
};

export const sectionContentSx = (section = {}, defaultPadding = {}) => {
  const sx = { ...defaultPadding };

  const align = section.textAlign || section.alignment;
  if (align) sx.textAlign = align;

  const pt = spacingValue(section.paddingTop);
  if (pt !== undefined) sx.pt = pt;
  const pb = spacingValue(section.paddingBottom);
  if (pb !== undefined) sx.pb = pb;
  const pl = spacingValue(section.paddingLeft);
  if (pl !== undefined) sx.pl = pl;
  const pr = spacingValue(section.paddingRight);
  if (pr !== undefined) sx.pr = pr;

  if (section.verticalAlign) {
    sx.display = 'flex';
    sx.flexDirection = 'column';
    sx.justifyContent =
      section.verticalAlign === 'top' ? 'flex-start'
      : section.verticalAlign === 'bottom' ? 'flex-end'
      : 'center';
  }

  return sx;
};

export const sectionLayoutSx = sectionContentSx;

export const resolveSectionMaxWidth = (section = {}) => {
  const mode = section.widthMode || 'container';
  if (mode === 'full') return null;
  if (mode === 'custom') {
    if (section.customMaxWidth) return spacingValue(section.customMaxWidth) || section.customMaxWidth;
    return 'xl';
  }
  const preset = WIDTH_PRESETS.find((p) => p.value === mode);
  return preset ? preset.maxWidth : 'xl';
};


export const CanvasEditableText = ({
  section,
  field,
  children,
  preview = false,
  onInlineFieldChange,
  onInlineFieldCommit,
  onInlineBlockFocus,
  component = Typography,
  seedPatch,
  sx,
  ...props
}) => {
  const Component = component;
  const editable = preview && Boolean(onInlineFieldCommit || onInlineFieldChange) && section?.id;
  const initialTextRef = useRef('');
  const cancelledRef = useRef(false);

  if (!editable) {
    return typeof Component === 'string'
      ? <Component {...props}>{children}</Component>
      : <Component sx={sx} {...props}>{children}</Component>;
  }

  const stop = (event) => event.stopPropagation();
  const blockMatch = String(field || '').match(/^([^.]*)\.(\d+)\./);
  const focusBlock = () => {
    if (!blockMatch) return;
    onInlineBlockFocus?.(section.id, blockMatch[1], Number(blockMatch[2]));
  };
  const commit = (event) => {
    stop(event);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const nextText = event.currentTarget.textContent || '';
    if (nextText !== initialTextRef.current) {
      if (onInlineFieldCommit) {
        onInlineFieldCommit(section.id, field, nextText, seedPatch, initialTextRef.current);
      } else {
        onInlineFieldChange?.(section.id, field, nextText, seedPatch);
      }
    }
  };

  return (
    <Component
      contentEditable
      suppressContentEditableWarning
      tabIndex={0}
      onClick={(event) => {
        stop(event);
        focusBlock();
      }}
      onMouseDown={(event) => {
        stop(event);
        focusBlock();
      }}
      onFocus={(event) => {
        stop(event);
        initialTextRef.current = event.currentTarget.textContent || '';
        cancelledRef.current = false;
      }}
      onInput={stop}
      onKeyDown={(event) => {
        stop(event);
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelledRef.current = true;
          event.currentTarget.textContent = initialTextRef.current;
          event.currentTarget.blur();
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onBlur={commit}
      {...(typeof Component === 'string' ? {} : {
        sx: {
          minWidth: 24,
          borderRadius: 0.5,
          outline: '1px solid transparent',
          cursor: 'text',
          '&:hover': { outlineColor: 'primary.main' },
          '&:focus': { outlineColor: 'primary.main', bgcolor: 'rgba(25, 118, 210, 0.06)' },
          ...sx,
        },
      })}
      {...props}
    >
      {children}
    </Component>
  );
};

export const CanvasEditableImage = ({
  section,
  field,
  children,
  preview = false,
  onInlineFieldChange,
  onInlineFieldCommit,
  onInlineBlockFocus,
  seedPatch,
  sx,
  ...props
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const editable = preview && Boolean(onInlineFieldCommit || onInlineFieldChange) && section?.id;

  if (!editable) {
    return <Box sx={sx} {...props}>{children}</Box>;
  }

  const stop = (event) => event.stopPropagation();
  const blockMatch = String(field || '').match(/^([^.]*)\.(\d+)\./);
  const focusBlock = () => {
    if (!blockMatch) return;
    onInlineBlockFocus?.(section.id, blockMatch[1], Number(blockMatch[2]));
  };

  const handleSelect = (media) => {
    const selected = Array.isArray(media) ? media[0] : media;
    if (!selected?.url) return;
    if (onInlineFieldCommit) {
      onInlineFieldCommit(section.id, field, selected.url, seedPatch);
    } else {
      onInlineFieldChange?.(section.id, field, selected.url, seedPatch);
    }
    setPickerOpen(false);
  };

  return (
    <Box
      onClick={(event) => {
        stop(event);
        focusBlock();
        setPickerOpen(true);
      }}
      onMouseDown={(event) => {
        stop(event);
        focusBlock();
      }}
      sx={{
        position: 'relative',
        cursor: 'pointer',
        '&:hover .image-edit-overlay': {
          opacity: 1,
        },
        ...sx,
      }}
      {...props}
    >
      {children}
      <Box
        className="image-edit-overlay"
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(15, 23, 42, 0.55)',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.2s ease',
          zIndex: 5,
          gap: 0.5,
          pointerEvents: 'none',
        }}
      >
        <PhotoCameraIcon sx={{ fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }} />
        <Typography
          variant="caption"
          fontWeight={900}
          sx={{
            textTransform: 'uppercase',
            fontSize: '0.68rem',
            letterSpacing: '0.05em',
            textShadow: '0 2px 4px rgba(0,0,0,0.25)',
          }}
        >
          Change Image
        </Typography>
      </Box>
      {pickerOpen && (
        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleSelect}
          title="Select Image"
        />
      )}
    </Box>
  );
};

export const SectionFrame = ({ section, index = 0, children, preview = false, selected = false, onSelect, onInlineFieldChange, onInlineFieldCommit }) => {
  const isHero = isHeroSection(section);
  const isFirstNonHero = index === 0;
  const defaultPadding = preview
    ? { py: 2.5 }
    : (isFirstNonHero ? { pt: { xs: 5, md: 7 }, pb: { xs: 2, md: 3 } } : { py: { xs: 2, md: 3 } });

  const wrapperExtraSx = sectionWrapperSx(section);
  const contentExtraSx = sectionContentSx(section, isHero ? {} : defaultPadding);
  const maxWidth = resolveSectionMaxWidth(section);
  const isFullWidth = maxWidth === null;
  const anchorId = section.anchorId;
  const customClassName = section.customClassName;
  const wrapperKey = section.id || index;

  const wrapperSx = {
    ...(anchorId ? { id: anchorId } : {}),
    ...wrapperExtraSx,
    ...(isFullWidth ? contentExtraSx : {}),
  };

  const canSelect = preview && typeof onSelect === 'function';
  const sectionLabel = getSectionLabel(section);
  const selectionLabel = selected ? `Editing ${sectionLabel}` : `${sectionLabel} (Click to edit)`;
  const previewInteractionSx = canSelect ? {
    position: 'relative',
    cursor: 'pointer',
    outline: selected ? '3px solid' : 'none',
    outlineColor: selected ? 'primary.main' : 'transparent',
    outlineOffset: isFullWidth || isHero ? '-2px' : '2px',
    '&::after': selected ? {
      content: `"${selectionLabel}"`,
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'primary.main',
      color: 'primary.contrastText',
      pointerEvents: 'none',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '0.7rem',
      fontWeight: 'bold',
      zIndex: 10,
    } : undefined,
    '&:hover': {
      outline: selected ? '3px solid' : '2px dashed',
      outlineColor: 'primary.main',
      outlineOffset: isFullWidth || isHero ? '-2px' : '2px',
    },
    '&:focus-visible': {
      outline: '3px solid',
      outlineColor: 'primary.main',
      outlineOffset: isFullWidth || isHero ? '-2px' : '2px',
    },
    '&:hover::after': !selected ? {
      content: `"${selectionLabel}"`,
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'primary.main',
      color: 'primary.contrastText',
      pointerEvents: 'none',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '0.7rem',
      fontWeight: 'bold',
      zIndex: 10,
    } : undefined,
  } : {};

  const mergedWrapperSx = { ...wrapperSx, ...previewInteractionSx };
  const selectionProps = canSelect ? {
    role: 'group',
    tabIndex: 0,
    'aria-label': `Edit ${sectionLabel} section`,
    'aria-current': selected ? 'true' : undefined,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    },
  } : {};

  if (isHero || isFullWidth) {
    return (
      <Box
        key={wrapperKey}
        className={customClassName || undefined}
        onClick={canSelect ? onSelect : undefined}
        {...selectionProps}
        sx={mergedWrapperSx}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box
      className={customClassName || undefined}
      onClick={canSelect ? onSelect : undefined}
      {...selectionProps}
      sx={mergedWrapperSx}
    >
      <Container
        key={wrapperKey}
        maxWidth={maxWidth}
        sx={contentExtraSx}
      >
        {children}
      </Container>
    </Box>
  );
};
