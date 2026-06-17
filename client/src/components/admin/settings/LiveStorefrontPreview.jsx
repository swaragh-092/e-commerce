/**
 * LiveStorefrontPreview.jsx
 *
 * Renders a real iframe of the storefront using the admin's UNSAVED form values.
 *
 * How it works (same-origin, zero server changes):
 *  1. Admin form values are serialized and written to localStorage['storePreviewTheme'].
 *  2. The iframe loads /?previewMode=1.
 *  3. ThemeContext detects previewMode=1 and reads settings from localStorage['storePreviewTheme']
 *     instead of the API, giving an isolated preview without touching production data.
 *  4. Every time the form changes, we postMessage the updated preview data to the iframe,
 *     which applies the new CSS vars instantly (no reload needed for colours/fonts).
 *
 * Device frames:
 *   mobile  → 375px wide
 *   tablet  → 768px wide
 *   desktop → full width (capped at 1280px)
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Tooltip,
  IconButton,
  Chip,
} from '@mui/material';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import TabletIcon from '@mui/icons-material/Tablet';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { buildStorefrontCssVariables } from '../../../utils/theme';

// ─── Device configuration ─────────────────────────────────────────────────────

const DEVICES = {
  mobile:  { icon: <SmartphoneIcon fontSize="small" />,  label: 'Mobile',  width: 375,  height: 667 },
  tablet:  { icon: <TabletIcon fontSize="small" />,      label: 'Tablet',  width: 768,  height: 1024 },
  desktop: { icon: <DesktopWindowsIcon fontSize="small" />, label: 'Desktop', width: null, height: 600 },
};

// ─── localStorage bridge key ──────────────────────────────────────────────────

const PREVIEW_KEY = 'storePreviewTheme';

/**
 * Flatten the admin form (dot-notation keys) back into a nested settings object
 * that ThemeContext expects: { theme: { primaryColor, ... }, general: { ... }, ... }
 */
const formToNestedSettings = (form) => {
  const result = {};
  Object.entries(form || {}).forEach(([flatKey, value]) => {
    const [group, ...keyParts] = flatKey.split('.');
    if (!result[group]) result[group] = {};
    result[group][keyParts.join('.')] = value;
  });
  return result;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveStorefrontPreview({ form, settings, path = '/', reloadOnSettingsChange = false, reloadDelay = 450, device: controlledDevice, showToolbar = true, showStatusText = showToolbar, frameHeight }) {
  const iframeRef  = useRef(null);
  const lastSnapshotRef = useRef('');
  const [localDevice, setLocalDevice] = useState('desktop');
  const [iframeKey, setIframeKey] = useState(0); // bump to force iframe reload
  const [ready, setReady]       = useState(false);

  const device = controlledDevice || localDevice;
  const cfg = DEVICES[device] || DEVICES.desktop;

  // ── Write preview settings to localStorage whenever form/settings changes ─
  useEffect(() => {
    const nested = settings || formToNestedSettings(form);
    if (!nested || Object.keys(nested).length === 0) return;
    try {
      localStorage.setItem(PREVIEW_KEY, JSON.stringify(nested));
    } catch {
      // localStorage quota exceeded — degrade gracefully
    }

    // If iframe is already mounted, postMessage the new CSS vars so colours/fonts
    // update instantly without a full reload.
    const iframe = iframeRef.current;
    if (iframe && ready) {
      const vars = buildStorefrontCssVariables(nested, null);
      iframe.contentWindow?.postMessage(
        { type: 'PREVIEW_THEME_UPDATE', vars },
        window.location.origin,
      );
    }
  }, [form, settings, ready]);


  // Layout/page settings are read by the iframe at boot. When Store Designer
  // changes those values, reload after a short debounce so the real route picks
  // up the new localStorage snapshot without saving production settings.
  useEffect(() => {
    if (!reloadOnSettingsChange) return undefined;
    const nested = settings || formToNestedSettings(form);
    if (!nested || Object.keys(nested).length === 0) return undefined;

    let snapshot;
    try {
      snapshot = JSON.stringify({ path, settings: nested });
    } catch {
      return undefined;
    }

    if (!lastSnapshotRef.current) {
      lastSnapshotRef.current = snapshot;
      return undefined;
    }

    if (lastSnapshotRef.current === snapshot) return undefined;
    lastSnapshotRef.current = snapshot;

    const timer = window.setTimeout(() => {
      setReady(false);
      setIframeKey((k) => k + 1);
    }, reloadDelay);

    return () => window.clearTimeout(timer);
  }, [form, settings, path, reloadOnSettingsChange, reloadDelay]);

  // ── Cleanup: remove preview key when admin unmounts the panel ────────────
  useEffect(() => {
    return () => {
      localStorage.removeItem(PREVIEW_KEY);
    };
  }, []);

  const handleLoad = useCallback(() => {
    setReady(true);
    // Re-send current vars after iframe reload
    const nested = settings || formToNestedSettings(form);
    if (!nested || Object.keys(nested).length === 0) return;
    const vars = buildStorefrontCssVariables(nested, null);
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'PREVIEW_THEME_UPDATE', vars },
      window.location.origin,
    );
  }, [form, settings]);

  const handleRefresh = () => {
    setReady(false);
    setIframeKey((k) => k + 1);
  };

  const normalizedPath = path && path !== '/home' ? path : '/';
  const separator = normalizedPath.includes('?') ? '&' : '?';
  const iframeSrc = `${window.location.origin}${normalizedPath}${separator}previewMode=1`;

  // ── Outer container width ─────────────────────────────────────────────────
  const outerWidth   = cfg.width  ? `${cfg.width}px`  : '100%';
  const outerHeight  = frameHeight || `${cfg.height}px`;
  // Scale down if the device width is wider than the container (handled by CSS transform)
  const needsScale   = cfg.width !== null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* ── Toolbar ── */}
      {showToolbar && (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={device}
          onChange={(_, v) => v && setLocalDevice(v)}
        >
          {Object.entries(DEVICES).map(([key, d]) => (
            <Tooltip key={key} title={d.label} arrow>
              <ToggleButton value={key} sx={{ px: 1 }}>
                {d.icon}
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label="Live Preview"
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: '0.68rem', height: 22, fontWeight: 700 }}
          />
          <Tooltip title="Reload preview" arrow>
            <IconButton size="small" onClick={handleRefresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open storefront in new tab" arrow>
            <IconButton size="small" component="a" href={iframeSrc} target="_blank" rel="noopener">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      )}

      {/* ── Device frame ── */}
      <Box
        sx={{
          width: '100%',
          overflowX: 'auto',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {/* Inner frame — centred for mobile/tablet, full-width for desktop */}
        <Box
          sx={{
            mx: needsScale ? 'auto' : 0,
            width: outerWidth,
            maxWidth: needsScale ? outerWidth : '100%',
            height: outerHeight,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: needsScale ? 3 : 0,
            boxShadow: needsScale ? '0 4px 24px rgba(0,0,0,0.12)' : 'none',
            my: needsScale ? 1.5 : 0,
            transition: 'width 0.3s ease, height 0.3s ease',
          }}
        >
          {!ready && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'action.hover',
                zIndex: 1,
                borderRadius: 2,
              }}
            >
              <Typography variant="caption" color="text.secondary">Loading storefront…</Typography>
            </Box>
          )}
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={iframeSrc}
            title="Live storefront preview"
            onLoad={handleLoad}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              borderRadius: 'inherit',
            }}
          />
        </Box>
      </Box>

      {showStatusText && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          Colours and fonts update instantly. Layout changes refresh on next reload.
        </Typography>
      )}
    </Box>
  );
}
