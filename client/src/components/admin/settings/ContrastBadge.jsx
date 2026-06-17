/**
 * ContrastBadge.jsx
 *
 * Shows a WCAG contrast badge next to a colour field in the admin settings.
 * Receives the foreground + background hex values, computes the ratio,
 * and renders a colour-coded chip with the AA/AAA verdict.
 *
 * Usage:
 *   <ContrastBadge foreground={primaryColor} background={backgroundColor} label="Primary / BG" />
 */
import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { evaluateContrast } from '../../../utils/accessibility';

// ─── Level → visual config ────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  AAA: {
    color:    'success',
    icon:     <CheckCircleOutlineIcon fontSize="inherit" />,
    tooltip:  (r) => `AAA — ${r.toFixed(2)}:1 contrast ratio. Excellent legibility for all users, including those with low vision.`,
  },
  AA: {
    color:    'success',
    icon:     <CheckCircleOutlineIcon fontSize="inherit" />,
    tooltip:  (r) => `AA — ${r.toFixed(2)}:1 contrast ratio. Meets WCAG 2.1 minimum for normal-sized text. Compliant.`,
  },
  'AA Large': {
    color:    'warning',
    icon:     <WarningAmberIcon fontSize="inherit" />,
    tooltip:  (r) => `AA Large — ${r.toFixed(2)}:1. Passes for large text (≥18pt or bold ≥14pt) and UI components, but fails for normal body text.`,
  },
  Fail: {
    color:    'error',
    icon:     <ErrorOutlineIcon fontSize="inherit" />,
    tooltip:  (r) => `Fail — ${r.toFixed(2)}:1 contrast ratio. Does not meet WCAG 2.1 AA minimum (4.5:1 required for normal text). Consider adjusting this colour.`,
  },
  'N/A': {
    color:    'default',
    icon:     null,
    tooltip:  () => 'Enter valid hex colours to check contrast.',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContrastBadge({ foreground, background, label, sx }) {
  const result = evaluateContrast(foreground, background);
  const cfg    = LEVEL_CONFIG[result.level] ?? LEVEL_CONFIG['N/A'];

  return (
    <Tooltip
      title={
        <Box>
          {label && <Typography variant="caption" display="block" sx={{ mb: 0.5, fontWeight: 700 }}>{label}</Typography>}
          <Typography variant="caption" display="block">
            {cfg.tooltip(result.ratio ?? 0)}
          </Typography>
        </Box>
      }
      arrow
    >
      <Chip
        size="small"
        icon={cfg.icon}
        label={result.ratio !== null ? `${result.level} ${result.ratio.toFixed(1)}:1` : result.level}
        color={cfg.color}
        variant={result.level === 'Fail' ? 'filled' : 'outlined'}
        sx={{
          fontSize: '0.68rem',
          height: 22,
          cursor: 'help',
          fontWeight: 700,
          ...sx,
        }}
      />
    </Tooltip>
  );
}

// ─── Theme-level contrast panel ───────────────────────────────────────────────

/**
 * ThemeContrastPanel
 *
 * Renders a compact grid of all critical colour pairs for the active theme.
 * Embed this inside the Brand Colors section of the settings panel.
 */
export function ThemeContrastPanel({ primaryColor, secondaryColor, backgroundColor, textColor }) {
  const pairs = [
    { label: 'Text / Background',      fg: textColor,      bg: backgroundColor },
    { label: 'Primary / Background',   fg: primaryColor,   bg: backgroundColor },
    { label: 'White / Primary',        fg: '#ffffff',      bg: primaryColor },
    { label: 'Secondary / Background', fg: secondaryColor, bg: backgroundColor },
  ];

  // Overall score: count pairs that are at least AA
  const passing = pairs.filter(({ fg, bg }) => evaluateContrast(fg, bg).aa).length;
  const score   = Math.round((passing / pairs.length) * 100);

  const scoreColor = score === 100 ? 'success.main' : score >= 75 ? 'warning.main' : 'error.main';

  return (
    <Box
      sx={{
        mt: 2,
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'action.hover',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Accessibility — WCAG 2.1
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography variant="caption" fontWeight={800} color={scoreColor}>
            {passing}/{pairs.length} pairs passing AA
          </Typography>
        </Box>
      </Box>

      {/* Pair rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {pairs.map(({ label, fg, bg }) => (
          <Box
            key={label}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            {/* Colour preview swatches */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 14, height: 14, borderRadius: '50%',
                  bgcolor: fg, border: '1px solid', borderColor: 'divider', flexShrink: 0,
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>on</Typography>
              <Box
                sx={{
                  width: 14, height: 14, borderRadius: '50%',
                  bgcolor: bg, border: '1px solid', borderColor: 'divider', flexShrink: 0,
                }}
              />
              <Typography variant="caption" sx={{ fontSize: '0.72rem' }}>{label}</Typography>
            </Box>

            {/* Badge */}
            <ContrastBadge foreground={fg} background={bg} label={label} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
