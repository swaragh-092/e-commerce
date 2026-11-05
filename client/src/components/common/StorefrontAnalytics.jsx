import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings';

const normalizeGoogleId = (value) => /^G-[A-Z0-9]+$/.test(String(value || '').trim().toUpperCase())
  ? String(value).trim().toUpperCase() : '';
const normalizePixelId = (value) => /^\d+$/.test(String(value || '').trim()) ? String(value).trim() : '';

// Keep initialization across layout remounts and hot reloads. Each destination
// remembers its last navigation, so repeated React effects cannot count it twice.
const getTrackerState = () => {
  window.__storefrontAnalytics ||= {
    googleIds: new Set(), pixelIds: new Set(), googlePages: new Map(), pixelPages: new Map(),
  };
  return window.__storefrontAnalytics;
};

const ensureScript = (kind, src, existingPrefix) => {
  if (Array.from(document.scripts).some((script) => kind === 'meta'
    ? /^https:\/\/connect\.facebook\.net\/[^/]+\/fbevents\.js(?:\?|$)/.test(script.src)
    : script.src.startsWith(existingPrefix))) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  script.dataset.storeTracker = kind;
  script.onerror = () => script.remove();
  document.head.appendChild(script);
};

const trackPage = ({ googleId, pixelId, navigation, pathname }) => {
  const state = getTrackerState();
  const pageLocation = `${window.location.origin}${pathname}`;

  if (googleId) {
    window[`ga-disable-${googleId}`] = false;
    window.dataLayer ||= [];
    window.gtag ||= function gtag() { window.dataLayer.push(arguments); };
    if (!state.googleIds.has(googleId)) {
      if (!state.googleIds.size) window.gtag('js', new Date());
      window.gtag('config', googleId, { send_page_view: false });
      state.googleIds.add(googleId);
    }
    ensureScript('google', `https://www.googletagmanager.com/gtag/js?id=${googleId}`, 'https://www.googletagmanager.com/gtag/js');
    if (state.googlePages.get(googleId)?.navigation !== navigation) {
      const previousPage = state.googlePages.get(googleId)?.location;
      window.gtag('event', 'page_view', {
        send_to: googleId,
        page_location: pageLocation,
        page_title: document.title,
        ...(previousPage ? { page_referrer: previousPage } : {}),
      });
      state.googlePages.set(googleId, { navigation, location: pageLocation });
    }
  }

  if (pixelId) {
    if (!window.fbq) {
      const fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(Array.from(arguments));
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq ||= fbq;
    }
    if (!state.pixelIds.has(pixelId)) {
      window.fbq('set', 'autoConfig', false, pixelId);
      window.fbq('init', pixelId);
      state.pixelIds.add(pixelId);
    }
    ensureScript('meta', 'https://connect.facebook.net/en_US/fbevents.js', 'https://connect.facebook.net/');
    if (state.pixelPages.get(pixelId) !== navigation) {
      window.fbq('trackSingle', pixelId, 'PageView');
      state.pixelPages.set(pixelId, navigation);
    }
  }
};

export default function StorefrontAnalytics() {
  const { settings } = useSettings();
  const location = useLocation();
  const preview = useRef(new URLSearchParams(location.search).get('previewMode') === '1' || window.self !== window.top);
  const isPreview = preview.current || new URLSearchParams(location.search).get('previewMode') === '1';
  const googleId = normalizeGoogleId(settings?.seo?.googleAnalyticsId);
  const pixelId = normalizePixelId(settings?.seo?.facebookPixelId);
  const isAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  useEffect(() => {
    if (isPreview || isAdmin || (!googleId && !pixelId)) return undefined;
    const timer = window.setTimeout(() => trackPage({
      googleId, pixelId,
      navigation: `${location.key}:${location.pathname}`,
      pathname: location.pathname,
    }), 0);
    return () => {
      window.clearTimeout(timer);
      if (googleId) window[`ga-disable-${googleId}`] = true;
    };
  }, [googleId, pixelId, isPreview, isAdmin, location.key, location.pathname]);

  return null;
}
