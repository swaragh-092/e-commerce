/**
 * CssVarsPanel.jsx
 *
 * Live CSS variable reference panel for the Advanced → Custom CSS section.
 *
 * Shows every --store-* token that ThemeContext injects on <html>, along with:
 *   - Current computed value (read from document.documentElement at render time)
 *   - Visual swatch for colour tokens
 *   - Click-to-copy the var() expression
 *   - Organised by category (colours, shape, shadow, typography, spacing, transitions)
 *   - Collapsible so it doesn't crowd the page when not needed
 */
import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Collapse,
  Chip,
  Tooltip,
  IconButton,
  Paper,
  Stack,
  Divider,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import CodeIcon from '@mui/icons-material/Code';

// ─── Token catalogue ──────────────────────────────────────────────────────────
// Groups with their display labels and the variables that belong to each.
// The order here is the order shown in the UI.

const TOKEN_GROUPS = [
  {
    id: 'brand',
    label: 'Brand Colours',
    emoji: '🎨',
    tokens: [
      { name: '--store-color-primary',            desc: 'Primary action colour' },
      { name: '--store-color-primary-dark',        desc: 'Darkened primary (hover states)' },
      { name: '--store-color-primary-light',       desc: 'Lightened primary (backgrounds)' },
      { name: '--store-color-on-primary',          desc: 'Text on primary background' },
      { name: '--store-color-secondary',           desc: 'Secondary / accent colour' },
      { name: '--store-color-secondary-dark',      desc: 'Darkened secondary' },
      { name: '--store-color-secondary-light',     desc: 'Lightened secondary' },
      { name: '--store-color-on-secondary',        desc: 'Text on secondary background' },
    ],
  },
  {
    id: 'surface',
    label: 'Surface & Text',
    emoji: '🖼️',
    tokens: [
      { name: '--store-color-background',          desc: 'Page background' },
      { name: '--store-color-surface',             desc: 'Card / panel surface' },
      { name: '--store-color-text',                desc: 'Primary text colour' },
      { name: '--store-color-text-muted',          desc: 'Secondary / muted text' },
      { name: '--store-color-on-surface',          desc: 'Text on surface' },
      { name: '--store-color-on-surface-secondary',desc: 'Secondary text on surface' },
      { name: '--store-color-divider',             desc: 'Divider / border colour' },
      { name: '--store-color-border',              desc: 'Border colour (alias of divider)' },
      { name: '--store-mobile-color-primary',      desc: 'Mobile primary override' },
      { name: '--store-mobile-color-background',   desc: 'Mobile background override' },
      { name: '--store-mobile-color-surface',      desc: 'Mobile surface override' },
      { name: '--store-mobile-color-text',         desc: 'Mobile text override' },
    ],
  },
  {
    id: 'state',
    label: 'State Colours',
    emoji: '🚦',
    tokens: [
      { name: '--store-color-error',    desc: 'Error / danger states' },
      { name: '--store-color-warning',  desc: 'Warning states' },
      { name: '--store-color-success',  desc: 'Success / positive states' },
      { name: '--store-color-info',     desc: 'Informational states' },
    ],
  },
  {
    id: 'shape',
    label: 'Shape & Radius',
    emoji: '⬜',
    tokens: [
      { name: '--store-radius-sm',      desc: 'Small radius (chips, badges)' },
      { name: '--store-radius',         desc: 'Base radius' },
      { name: '--store-radius-md',      desc: 'Medium radius (alias of base)' },
      { name: '--store-radius-lg',      desc: 'Large radius (cards)' },
      { name: '--store-radius-card',    desc: 'Card radius (alias of lg)' },
      { name: '--store-radius-xl',      desc: 'Extra-large radius (drawers, dialogs)' },
      { name: '--store-radius-full',    desc: 'Pill / full radius' },
      { name: '--store-radius-button',  desc: 'Button radius' },
      { name: '--store-radius-input',   desc: 'Input field radius' },
    ],
  },
  {
    id: 'shadow',
    label: 'Shadows',
    emoji: '🌑',
    tokens: [
      { name: '--store-shadow-soft',     desc: 'Subtle shadow (list items)' },
      { name: '--store-shadow-card',     desc: 'Card default shadow' },
      { name: '--store-shadow-medium',   desc: 'Medium elevation' },
      { name: '--store-shadow-strong',   desc: 'High elevation (modals)' },
      { name: '--store-shadow-hover',    desc: 'Card/button hover shadow' },
      { name: '--store-shadow-dropdown', desc: 'Dropdown / popover shadow' },
      { name: '--store-focus-ring',      desc: 'Keyboard focus ring (box-shadow)' },
      { name: '--store-overlay-dark',    desc: 'Dark overlay backdrop' },
    ],
  },
  {
    id: 'typography',
    label: 'Typography',
    emoji: '🔤',
    tokens: [
      { name: '--store-font-body',                desc: 'Body font stack' },
      { name: '--store-font-heading',             desc: 'Heading font stack' },
      { name: '--store-font-weight-body',         desc: 'Body font weight' },
      { name: '--store-font-weight-heading',      desc: 'Heading font weight' },
      { name: '--store-font-variation',           desc: 'Variable font axes' },
      { name: '--store-type-scale',               desc: 'Active typography scale' },
      { name: '--store-font-size-h1',             desc: 'Heading 1 size' },
      { name: '--store-font-size-h2',             desc: 'Heading 2 size' },
      { name: '--store-font-size-h3',             desc: 'Heading 3 size' },
      { name: '--store-font-size-body',           desc: 'Body text size' },
      { name: '--store-font-size-small',          desc: 'Small text size' },
      { name: '--store-line-height',              desc: 'Base line height' },
      { name: '--store-letter-spacing',           desc: 'Body letter spacing' },
      { name: '--store-heading-letter-spacing',   desc: 'Heading letter spacing' },
    ],
  },
  {
    id: 'spacing',
    label: 'Spacing',
    emoji: '📐',
    tokens: [
      { name: '--store-space-xs', desc: '4px' },
      { name: '--store-space-sm', desc: '8px' },
      { name: '--store-space-md', desc: '16px' },
      { name: '--store-space-lg', desc: '24px' },
      { name: '--store-space-xl', desc: '32px' },
      { name: '--store-mobile-section-padding', desc: 'Mobile section padding' },
      { name: '--store-mobile-container-padding', desc: 'Mobile container padding' },
    ],
  },
  {
    id: 'transition',
    label: 'Transitions',
    emoji: '⚡',
    tokens: [
      { name: '--store-transition-fast',   desc: '150ms ease (micro-interactions)' },
      { name: '--store-transition-normal', desc: '250ms ease (standard)' },
      { name: '--store-transition-base',   desc: '220ms ease (components)' },
      { name: '--store-transition-slow',   desc: '400ms ease (page-level)' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read the current computed value of a CSS custom property from <html>. */
const readVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '—';

/** Detect if a value looks like a colour. */
const isColour = (value) =>
  value.startsWith('#') ||
  value.startsWith('rgb') ||
  value.startsWith('hsl') ||
  value.startsWith('oklch');

// ─── TokenRow ─────────────────────────────────────────────────────────────────

const TokenRow = ({ name, desc }) => {
  const value   = readVar(name);
  const colour  = isColour(value);
  const varExpr = `var(${name})`;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(varExpr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [varExpr]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        alignItems: 'center',
        gap: 1,
        py: 0.6,
        px: 1.5,
        borderRadius: 1,
        '&:hover': { bgcolor: 'action.hover' },
        cursor: 'default',
      }}
    >
      {/* Name + description */}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.73rem',
            fontWeight: 600,
            color: 'text.primary',
            display: 'block',
          }}
        >
          {name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '0.68rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {value !== '—' ? value : desc}
        </Typography>
      </Box>

      {/* Colour swatch OR value chip */}
      {colour ? (
        <Tooltip title={value} arrow>
          <Box
            sx={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: value,
              border: '1.5px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          />
        </Tooltip>
      ) : (
        <Chip
          label={value.length > 22 ? value.slice(0, 22) + '…' : value}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.62rem', height: 20, fontFamily: 'monospace', maxWidth: 140 }}
        />
      )}

      {/* Copy button */}
      <Tooltip title={copied ? 'Copied!' : `Copy var(${name})`} arrow>
        <IconButton size="small" onClick={handleCopy} sx={{ p: 0.4 }}>
          {copied
            ? <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
            : <ContentCopyIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

// ─── TokenGroup ───────────────────────────────────────────────────────────────

const TokenGroup = ({ group }) => {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mb: 0.5 }}>
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderRadius: 1.5,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Typography sx={{ fontSize: '0.9rem' }}>{group.emoji}</Typography>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          {group.label}
        </Typography>
        <Chip
          label={group.tokens.length}
          size="small"
          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
        />
        <ExpandMoreIcon
          sx={{
            fontSize: 18,
            color: 'text.secondary',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 220ms ease',
          }}
        />
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ mt: 0.5, mb: 1 }}>
          {group.tokens.map((token) => (
            <TokenRow key={token.name} {...token} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

// ─── CssVarsPanel (public) ────────────────────────────────────────────────────

/**
 * Drop-in reference panel.
 *
 * Usage:
 *   import CssVarsPanel from './CssVarsPanel';
 *   <CssVarsPanel />
 *
 * No props needed — reads live values from document.documentElement.
 */
export default function CssVarsPanel() {
  const [open, setOpen] = useState(false);
  const totalTokens = TOKEN_GROUPS.reduce((n, g) => n + g.tokens.length, 0);

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2, mt: 1.5, overflow: 'hidden' }}
    >
      {/* Header / toggle */}
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
          cursor: 'pointer',
          userSelect: 'none',
          bgcolor: open ? 'action.selected' : 'action.hover',
          borderBottom: open ? '1px solid' : 'none',
          borderColor: 'divider',
          '&:hover': { bgcolor: 'action.selected' },
        }}
      >
        <CodeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            CSS Variable Reference
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {totalTokens} live tokens — click any row to copy <code>var(--store-…)</code>
          </Typography>
        </Box>
        <ExpandMoreIcon
          sx={{
            fontSize: 20,
            color: 'text.secondary',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 220ms ease',
          }}
        />
      </Box>

      {/* Token groups */}
      <Collapse in={open} unmountOnExit>
        <Box sx={{ p: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ px: 1.5, py: 1, flexWrap: 'wrap', gap: 0.75 }}
          >
            {TOKEN_GROUPS.map((g) => (
              <Chip
                key={g.id}
                label={`${g.emoji} ${g.label}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 22 }}
              />
            ))}
          </Stack>
          <Divider sx={{ mb: 0.5 }} />
          {TOKEN_GROUPS.map((group) => (
            <TokenGroup key={group.id} group={group} />
          ))}
          <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              All tokens are injected on <code>&lt;html&gt;</code> and update automatically when brand settings change.
              Use them in your Custom CSS above as <code>var(--store-color-primary)</code>.
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}
