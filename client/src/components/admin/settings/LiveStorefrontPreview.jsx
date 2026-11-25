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
 *  4. The iframe receives the latest draft settings when it loads and whenever they change.
 *
 * Device frames:
 *   mobile  → 375px wide
 *   tablet  → 768px wide
 *   desktop → full width (capped at 1280px)
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  Box,
  Button,
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

export default function LiveStorefrontPreview({ form, settings, path = '/', device: controlledDevice, showToolbar = true, showStatusText = showToolbar, frameHeight, onSelectSection, onSelectComponent, onInsertSection, onInsertBlock, onSelectBlock, selectedSectionId, selectedBlockId, selectedComponent, inspectorActions }) {
  const iframeRef  = useRef(null);
  const inspectorCleanup = useRef(() => {});
  const selectionCallbacks = useRef({ onSelectSection, onSelectComponent, onInsertSection, onInsertBlock, onSelectBlock, selectedSectionId, selectedBlockId });
  selectionCallbacks.current = { onSelectSection, onSelectComponent, onInsertSection, onInsertBlock, onSelectBlock, inspectorActions };
  const actionSignature = JSON.stringify(inspectorActions?.map(({ label, disabled }) => [label, disabled]));
  const canInsertSection = Boolean(onInsertSection);
  const canInsertBlock = Boolean(onInsertBlock);
  const inspecting = Boolean(onSelectSection || onSelectComponent || onInsertSection || onInsertBlock || onSelectBlock);

  const attachInspector = useCallback(() => {
    inspectorCleanup.current();
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.head || !inspecting) return;
    const style = doc.createElement('style');
    style.textContent = '[data-store-section]:hover,[data-store-component]:hover,[data-store-block]:hover{outline:2px solid #4f46e5;outline-offset:-2px;cursor:pointer}[data-designer-selected]{outline:2px solid #4f46e5!important;outline-offset:-2px}';
    style.textContent += '[data-designer-actions]{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;flex-wrap:wrap;justify-content:center;width:max-content;max-width:calc(100% - 24px);gap:6px;padding:6px;background:#fff;color:#1f2937;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 4px 16px #0003}[data-designer-actions] button{font:inherit;font-size:13px;min-height:36px;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:inherit;cursor:pointer}[data-designer-actions] button:disabled{opacity:.5;cursor:default}';
    const insertionSelectors = [
      canInsertSection && '[data-store-add-section]',
      canInsertBlock && '[data-store-add-block]',
    ].filter(Boolean);
    if (insertionSelectors.length) {
      style.textContent += `${insertionSelectors.join(',')}{display:block!important;margin:8px auto;padding:5px 12px;border:1px dashed #4f46e5;border-radius:6px;background:white;color:#3730a3;cursor:pointer;font:inherit}`;
    }
    doc.head.appendChild(style);
    let highlighted;
    let slideRequested = false;
    let slideFrame;
    const toolbar = doc.createElement('div');
    toolbar.dataset.designerActions = '';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Preview selection actions');
    selectionCallbacks.current.inspectorActions?.forEach(({ label, disabled }, index) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = Boolean(disabled);
      button.addEventListener('click', () => selectionCallbacks.current.inspectorActions?.[index]?.onClick());
      toolbar.appendChild(button);
    });
    const find = (attribute, value, predicate = () => true) => value == null ? undefined
      : [...doc.querySelectorAll(`[${attribute}]`)].find((node) => node.getAttribute(attribute) === String(value) && predicate(node));
    const syncSelection = () => {
      const block = find('data-store-block', selectedBlockId, (node) => node.dataset.storeOwner === String(selectedSectionId));
      const section = find('data-store-section', selectedSectionId);
      const slide = /^field:slides:(\d+)$/.exec(selectedBlockId || '');
      if (section && slide && !slideRequested && doc.defaultView) {
        slideRequested = true;
        slideFrame = doc.defaultView.requestAnimationFrame(() => {
          doc.dispatchEvent(new doc.defaultView.CustomEvent('designer-select-hero-slide', {
            detail: { sectionId: selectedSectionId, slideIndex: Number(slide[1]) },
          }));
        });
      }
      const target = block || section || find('data-store-component', selectedComponent);
      if (highlighted === target) return;
      highlighted?.removeAttribute('data-designer-selected');
      highlighted = target;
      target?.setAttribute('data-designer-selected', '');
      target?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      if (target && toolbar.childElementCount && (!selectedBlockId || block)) doc.body.appendChild(toolbar);
      else toolbar.remove();
    };
    syncSelection();
    const observer = new MutationObserver(syncSelection);
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['data-store-section', 'data-store-block', 'data-store-owner', 'data-store-component'] });
    const select = (event) => {
      if (event.target?.closest?.('[data-designer-actions]')) return;
      const target = event.target?.closest?.('[data-store-add-section],[data-store-add-block],[data-store-block],[data-store-section],[data-store-component]');
      // Edit mode must not follow links or submit storefront forms.
      event.preventDefault();
      event.stopPropagation();
      if (!target) return;
      if (target.dataset.storeAddSection) selectionCallbacks.current.onInsertSection?.(target.dataset.storeAddSection, target.dataset.storeAnchor);
      else if (target.dataset.storeAddBlock) selectionCallbacks.current.onInsertBlock?.(target.dataset.storeOwner, target.dataset.storeAddBlock, target.dataset.storeAnchor);
      else if (target.dataset.storeBlock && target.dataset.storeOwner) selectionCallbacks.current.onSelectBlock?.(target.dataset.storeOwner, target.dataset.storeBlock);
      else if (target.dataset.storeSection) selectionCallbacks.current.onSelectSection?.(target.dataset.storeSection);
      else selectionCallbacks.current.onSelectComponent?.(target.dataset.storeComponent);
    };
    doc.addEventListener('click', select, true);
    doc.addEventListener('submit', select, true);
    inspectorCleanup.current = () => {
      doc.removeEventListener('click', select, true);
      doc.removeEventListener('submit', select, true);
      style.remove();
      observer.disconnect();
      if (slideFrame != null) doc.defaultView?.cancelAnimationFrame(slideFrame);
      if (slideRequested && doc.defaultView) {
        doc.dispatchEvent(new doc.defaultView.CustomEvent('designer-select-hero-slide', {
          detail: { sectionId: selectedSectionId, slideIndex: null },
        }));
      }
      toolbar.remove();
      highlighted?.removeAttribute('data-designer-selected');
    };
  }, [inspecting, canInsertSection, canInsertBlock, selectedSectionId, selectedBlockId, selectedComponent, actionSignature]);

  useEffect(() => {
    attachInspector();
    return () => inspectorCleanup.current();
  }, [attachInspector]);
  const [localDevice, setLocalDevice] = useState('desktop');
  const [iframeKey, setIframeKey] = useState(() => Date.now()); // cache-bust each preview load
  const [ready, setReady]       = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  useEffect(() => {
    setLoadTimedOut(false);
    if (ready) return undefined;
    const timer = window.setTimeout(() => setLoadTimedOut(true), 10000);
    return () => window.clearTimeout(timer);
  }, [ready, iframeKey, path]);

  const device = controlledDevice || localDevice;
  const cfg = DEVICES[device] || DEVICES.desktop;

  const syncSettings = useCallback(() => {
    const nested = settings || formToNestedSettings(form);
    if (!Object.keys(nested).length) return;

    try {
      localStorage.setItem(PREVIEW_KEY, JSON.stringify(nested));
    } catch {
      // The iframe can still receive settings through postMessage.
    }
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'PREVIEW_SETTINGS_UPDATE', settings: nested },
      window.location.origin,
    );
  }, [form, settings]);

  useEffect(syncSettings, [syncSettings]);

  useEffect(() => () => {
    try {
      localStorage.removeItem(PREVIEW_KEY);
    } catch {
      // Storage is optional for the embedded preview.
    }
  }, []);

  const handleLoad = () => {
    syncSettings();
    attachInspector();
    setReady(true);
  };

  const handleRefresh = () => {
    setReady(false);
    setIframeKey((k) => k + 1);
  };

  const normalizedPath = path && path !== '/home' ? path : '/';
  const previewUrl = new URL(normalizedPath, window.location.origin);
  previewUrl.searchParams.set('previewMode', '1');
  previewUrl.searchParams.set('designerPreview', String(iframeKey));
  const iframeSrc = previewUrl.toString();

  // ── Outer container width ─────────────────────────────────────────────────
  const outerWidth   = cfg.width  ? `${cfg.width}px`  : '100%';
  const outerHeight  = frameHeight || `${cfg.height}px`;
  // Scale down if the device width is wider than the container (handled by CSS transform)
  const needsScale   = cfg.width !== null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: frameHeight === '100%' ? '100%' : undefined, minHeight: 0 }}>
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
          overflowX: 'hidden',
          flex: frameHeight === '100%' ? 1 : undefined,
          minHeight: 0,
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
            maxWidth: '100%',
            height: outerHeight,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: needsScale ? 3 : 0,
            boxShadow: needsScale ? '0 4px 24px rgba(0,0,0,0.12)' : 'none',
            my: needsScale && frameHeight !== '100%' ? 1.5 : 0,
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
              <Box sx={{ p: 2, textAlign: 'center', maxWidth: 320 }}>
                <Typography variant="body2" color="text.secondary">
                  {loadTimedOut ? 'The preview is taking longer than expected.' : 'Loading storefront…'}
                </Typography>
                {loadTimedOut && <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
                  <Button size="small" variant="outlined" onClick={handleRefresh}>Retry preview</Button>
                  <Button size="small" component="a" href={iframeSrc} target="_blank" rel="noopener noreferrer">Open preview</Button>
                </Box>}
              </Box>
            </Box>
          )}
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={iframeSrc}
            title="Storefront design preview"
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
          Draft design changes update in the preview as you edit.
        </Typography>
      )}
    </Box>
  );
}
