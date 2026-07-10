import { useContext, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Grid, Stack, Badge, IconButton,
  AppBar, Toolbar, ThemeProvider, CssBaseline, createTheme,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { SettingsContext } from '../../../context/ThemeContext';
import { buildStorefrontCssVariables, buildStorefrontTheme } from '../../../utils/theme';
import { getStoreName } from '../../../utils/store';
import SectionRenderer from '../../storefront/sections/SectionRenderer';
import StorefrontFooter from '../../layout/StorefrontFooter';
import api from '../../../services/api';
import { getProducts } from '../../../services/productService';
import { getCategories } from '../../../services/categoryService';
import MenuService from '../../../services/menuService';
import PageService from '../../../services/pageService';
import { useBrands } from '../../../context/BrandContext';
import { needsCategoryData, needsProductData } from '../../storefront/sections/sectionRegistry';
import { buildSectionRendererData } from '../../storefront/sections/sectionData';

const DEFAULT_ACTIONS_ORDER = ['search', 'cart', 'wishlist', 'account'];
// Code-split the dev mock renderers — they only matter inside the admin
// designer/preview, not in the customer-facing chunk. Importing eagerly
// added ~67 KB of dev mock data to the production bundle.
// We expose a hook that loads the renderer map on first use; before the
// dynamic import resolves we render an empty function for unknown types,
// so the first paint is unaffected. Admin routes are not in the LCP path.
const useMockRenderers = () => {
  const [renderers, setRenderers] = useState({});
  useEffect(() => {
    let cancelled = false;
    import('./previewMockPages')
      .then((m) => { if (!cancelled) setRenderers(m.SECTION_TYPE_TO_MOCK_RENDERER || {}); })
      .catch(() => { if (!cancelled) setRenderers({}); });
    return () => { cancelled = true; };
  }, []);
  return renderers;
};

const PREVIEW_WIDTHS = { desktop: '100%', tablet: 768, mobile: 375 };
const API_BUILDER_TIMEOUT_MS = 5000;

const PRODUCT_SOURCE_PARAMS = {
  newest: { sort: 'newest' },
  featured: { featured: true },
  bestSellers: { sort: 'best-selling' },
  sale: { sale: true },
  recommended: { sort: 'recommended' },
};

const num = (value, fallback = 8) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const CanvasInsertControl = ({ label = 'Add section here', onClick }) => (
  <Box
    sx={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: 1,
      px: { xs: 2, md: 4 },
      py: 1,
      bgcolor: 'background.default',
    }}
  >
    <Box sx={{ borderTop: '1px dashed', borderColor: 'divider' }} />
    <Button
      size="small"
      variant="contained"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      sx={{
        borderRadius: 999,
        bgcolor: 'grey.900',
        color: 'common.white',
        textTransform: 'none',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
        '&:hover': { bgcolor: 'grey.800' },
      }}
    >
      {label}
    </Button>
    <Box sx={{ borderTop: '1px dashed', borderColor: 'divider' }} />
  </Box>
);


const CanvasSectionShell = ({
  section,
  originalIndex,
  area,
  draggable = false,
  isDragging = false,
  isDropTarget = false,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  children,
}) => (
  <Box
    draggable={draggable}
    onDragStart={(event) => onDragStart?.(event, originalIndex, area)}
    onDragOver={(event) => onDragOver?.(event, originalIndex, area)}
    onDrop={(event) => onDrop?.(event, originalIndex, area)}
    onDragEnd={onDragEnd}
    sx={{
      position: 'relative',
      opacity: isDragging ? 0.55 : 1,
      outline: isDropTarget ? '3px solid #1976d2' : 'none',
      outlineOffset: isDropTarget ? '-3px' : 0,
      transition: 'outline-color 0.12s ease, opacity 0.12s ease',
    }}
  >
    {draggable && (
      <Box
        data-canvas-drag-handle="true"
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(section);
        }}
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 20,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.4,
          borderRadius: 999,
          bgcolor: 'rgba(15, 23, 42, 0.88)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 800,
          lineHeight: 1,
          cursor: 'grab',
          boxShadow: '0 8px 22px rgba(15, 23, 42, 0.25)',
          userSelect: 'none',
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 14 }} />
        Drag
      </Box>
    )}
    {children}
  </Box>
);

const extractArray = (res, count) => {
  if (!res || res.status !== 'fulfilled' || !res.value) return [];
  const val = res.value;
  if (Array.isArray(val)) return count ? val.slice(0, count) : val;
  if (val.data && Array.isArray(val.data)) return count ? val.data.slice(0, count) : val.data;
  if (val.data?.data && Array.isArray(val.data.data)) return count ? val.data.data.slice(0, count) : val.data.data;
  return [];
};

const firstArrayInObject = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const item of Object.values(value)) {
    if (Array.isArray(item)) return item;
    if (item?.rows && Array.isArray(item.rows)) return item.rows;
  }
  return [];
};

const getResultPayload = (res) => {
  if (!res || res.status !== 'fulfilled') return null;
  return res.value?.data?.data || res.value?.data || res.value || null;
};

const getMenuItemsFromPayload = (payload) => {
  if (!payload) return [];
  const menu = payload.menu || payload;
  return Array.isArray(menu.items) ? menu.items : [];
};

const getTopLinksFromPayload = (payload) => {
  const rows = Array.isArray(payload) ? payload : firstArrayInObject(payload);
  return rows.map((link, index) => ({
    id: link.id || link.slug || 'top-link-' + index,
    label: link.label || link.title || link.name || 'Page',
    url: link.url || (link.slug ? '/p/' + link.slug : '/'),
    targetType: 'page',
    placement: link.placement || 'center',
    sortOrder: link.sortOrder ?? index,
    children: link.children || [],
  }));
};

const splitFallbackMenuItems = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((label, index) => ({ id: 'fallback-menu-' + index, label, children: [] }));

const resolvePreviewHeaderItems = (navSettings, navigationData) => {
  const menuItems = getMenuItemsFromPayload(navigationData.headerMenu);
  if (menuItems.length) return menuItems;
  if (navigationData.topLinks.length) return navigationData.topLinks;
  return splitFallbackMenuItems(navSettings.menuItems);
};

const resolvePreviewCategoryLabels = (navigationData, scopedSettings, demoData) => {
  const categories = navigationData.categories.length ? navigationData.categories : (demoData.categoryTiles || scopedSettings.homepage?.categoryTiles || []);
  return categories
    .map((item) => item.name || item.title || item.label)
    .filter(Boolean)
    .slice(0, 8);
};

const extractDataSourceArray = (res, section, count) => {
  if (!res || res.status !== 'fulfilled' || !res.value) return [];
  const payload = res.value.data?.data || res.value.data || res.value;
  const apiData = payload?.data || payload;
  const key = section.dataSourceBlock || section.dataSourceKey || section.id;
  const direct = apiData?.[key] || apiData?.products || apiData?.categories || apiData?.brands;
  const rows = firstArrayInObject(direct).length ? firstArrayInObject(direct) : firstArrayInObject(apiData);
  return count ? rows.slice(0, count) : rows;
};

const fetchPreviewProducts = (section) => {
  if (section.dataSourceSlug) {
    return api.get('/api-builder/public/' + section.dataSourceSlug, { timeout: API_BUILDER_TIMEOUT_MS });
  }
  return getProducts(getProductParams(section));
};

const getProductParams = (section) => ({
  ...(PRODUCT_SOURCE_PARAMS[section.source] || {}),
  ...(section.query || {}),
  limit: num(section.count, 8),
  status: 'published',
});

const getPageSections = (settingsObj, activePg, defaultLayoutSections) => {
  if (activePg === 'home') {
    return settingsObj?.homepage?.sections || defaultLayoutSections || [];
  }
  if (activePg === 'product') {
    return settingsObj?.productPage?.sections || [
      { id: 'prod-info',    type: 'product-info',    enabled: true },
      { id: 'prod-trust',   type: 'value-props',     enabled: true },
      { id: 'prod-reviews', type: 'product-reviews', enabled: true },
      { id: 'prod-row',     type: 'product-row',     enabled: true, title: 'You May Also Like', source: 'featured', count: 3 },
      { id: 'prod-recent',  type: 'recently-viewed', enabled: true },
    ];
  }
  if (activePg === 'category') {
    return settingsObj?.categoryPage?.sections || [
      { id: 'cat-header',   type: 'category-header',   enabled: true },
      { id: 'cat-products', type: 'category-products', enabled: true },
      { id: 'cat-recent',   type: 'recently-viewed',   enabled: true },
    ];
  }
  if (activePg === 'collection') {
    return settingsObj?.catalog?.sections || [
      { id: 'catalog-header',   type: 'catalog-header',   enabled: true },
      { id: 'catalog-products', type: 'catalog-products', enabled: true },
      { id: 'catalog-recent',   type: 'recently-viewed',  enabled: true },
    ];
  }
  if (activePg === 'brand') {
    return settingsObj?.brandsPage?.sections || [
      { id: 'brands-header', type: 'brands-header', enabled: true },
      { id: 'brands-list',   type: 'brands-list',   enabled: true },
    ];
  }
  if (activePg === 'blog') {
    return settingsObj?.blogPage?.sections || [
      { id: 'blog-header', type: 'blog-header', enabled: true },
      { id: 'blog-posts',  type: 'blog-posts',  enabled: true },
    ];
  }
  if (activePg === 'account') {
    return settingsObj?.accountPage?.sections || [
      { id: 'account-main', type: 'account-main', enabled: true },
    ];
  }
  if (activePg === 'cart') {
    return settingsObj?.cartPage?.sections || [
      { id: 'cart-main',   type: 'cart-main',       enabled: true },
      { id: 'cart-recent', type: 'recently-viewed', enabled: true },
    ];
  }
  if (activePg === 'checkout') {
    return settingsObj?.checkoutPage?.sections || [
      { id: 'checkout-main', type: 'checkout-main', enabled: true },
    ];
  }
  if (activePg === 'wishlist') {
    return settingsObj?.wishlistPage?.sections || [
      { id: 'wishlist-main', type: 'wishlist-main', enabled: true },
    ];
  }
  if (activePg === 'search') {
    return settingsObj?.searchPage?.sections || [
      { id: 'search-main', type: 'search-main', enabled: true },
    ];
  }
  if (activePg === 'not-found') {
    return settingsObj?.notFoundPage?.sections || [
      { id: 'not-found-main', type: 'not-found-main', enabled: true },
    ];
  }
  if (activePg === 'orders') {
    return settingsObj?.ordersPage?.sections || [
      { id: 'orders-main', type: 'orders-main', enabled: true },
    ];
  }
  return [];
};

// ─── Main Component ──────────────────────────────────────────────────────────

const StorefrontTemplatePreview = ({ packageData, mode = "desktop", currentSettings, componentStyles: liveComponentStyles, selectedSectionId, onSelectSection, onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus, onAddSectionAt, onReorderSection, activePage = "home", compareMode = false }) => {
  const design = packageData?.design?.theme || {};
  const layout = packageData?.layout || {};
  const demo = packageData?.demoContent || {};
  const parentSettingsContext = useContext(SettingsContext) || {};
  const mockRenderers = useMockRenderers();
  const sections = useMemo(() => {
    return getPageSections(currentSettings || parentSettingsContext.settings, activePage, layout.homepageSections);
  }, [layout.homepageSections, activePage, currentSettings, parentSettingsContext.settings]);
  const { brands: contextBrands = [], loading: brandsLoading = false } = useBrands();
  const [resolvedData, setResolvedData] = useState({ categories: [], products: {} });
  const [navigationData, setNavigationData] = useState({ headerMenu: null, topLinks: [], categories: [] });
  const [dataLoading, setDataLoading] = useState(false);
  const [dragState, setDragState] = useState(null);

  const previewTheme = useMemo(() => createTheme(buildStorefrontTheme(design)), [design]);

  const width = PREVIEW_WIDTHS[mode] || '100%';
  const visibleSections = useMemo(() => sections.filter((section) => section.enabled !== false), [sections]);
  const productSections = useMemo(() => visibleSections.filter((section) => needsProductData(section) || section.type === 'product-info'), [visibleSections]);
  const needsCategories = useMemo(() => visibleSections.some((section) => needsCategoryData(section)), [visibleSections]);

  useEffect(() => {
    let cancelled = false;
    const fetchNavigationData = async () => {
      const [headerMenuResult, topLinksResult, categoriesResult] = await Promise.allSettled([
        MenuService.getPublicMenu('header'),
        PageService.getPublicPages('top'),
        getCategories(),
      ]);
      if (cancelled) return;
      setNavigationData({
        headerMenu: getResultPayload(headerMenuResult),
        topLinks: getTopLinksFromPayload(getResultPayload(topLinksResult)),
        categories: extractArray(categoriesResult),
      });
    };
    fetchNavigationData().catch((err) => {
      console.error('[StorefrontTemplatePreview] Navigation fetch failed:', err);
      if (!cancelled) setNavigationData({ headerMenu: null, topLinks: [], categories: [] });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchPreviewData = async () => {
      if (!productSections.length && !needsCategories) {
        setResolvedData({ categories: [], products: {} });
        setDataLoading(false);
        return;
      }
      setDataLoading(true);
      const productFetches = productSections.map((section) => fetchPreviewProducts(section));
      const categoryFetch = needsCategories ? getCategories() : Promise.resolve(null);
      const results = await Promise.allSettled([...productFetches, categoryFetch]);
      if (cancelled) return;
      const productResults = results.slice(0, productFetches.length);
      const categoryResult = results[productFetches.length];
      const products = {};
      productSections.forEach((section, index) => {
        products[section.id] = section.dataSourceSlug
          ? extractDataSourceArray(productResults[index], section, num(section.count, 8))
          : extractArray(productResults[index], num(section.count, 8));
      });
      setResolvedData({ products, categories: extractArray(categoryResult) });
      setDataLoading(false);
    };
    fetchPreviewData().catch(() => {
      if (!cancelled) {
        setResolvedData({ categories: [], products: {} });
        setDataLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [needsCategories, productSections]);

  const buildSectionData = (section, demoData, settingsSnapshot = null) => {
    const baseData = buildSectionRendererData({
      section,
      homepage: settingsSnapshot?.homepage || {},
      demoContent: demoData,
      resolvedData,
      brands: contextBrands,
      loading: dataLoading,
      brandsLoading,
    });

    const scopedSettings = {
      ...(parentSettingsContext.settings || {}),
      componentStyles: liveComponentStyles || packageData?.componentStyles || parentSettingsContext.settings?.componentStyles || {},
      ...(settingsSnapshot || {}),
    };

    const mockRenderer = mockRenderers[section.type];
    if (mockRenderer) {
      baseData.render = () => mockRenderer(scopedSettings, {
        section,
        products: resolvedData.products?.[section.id] || [],
        onSelectSection,
        onSelectComponent,
      });
    }

    return baseData;
  };

  const previewContent = (themeObj, sectionList, demoData, label, styleLayout = layout, settingsSnapshot = null) => {
    const announcementStyle = styleLayout.announcementStyle || {};
    const navStyle = styleLayout.nav || {};
    const scopedSettings = {
      ...(parentSettingsContext.settings || {}),
      componentStyles: liveComponentStyles || packageData?.componentStyles || parentSettingsContext.settings?.componentStyles || {},
      ...(settingsSnapshot || {}),
    };
    const cssVariables = buildStorefrontCssVariables(scopedSettings.theme || scopedSettings);
    const scopedContext = {
      ...parentSettingsContext,
      settings: scopedSettings,
    };

    const announcementSettings = { ...(scopedSettings.announcement || {}), ...announcementStyle };
    const navSettings = { ...(scopedSettings.nav || {}), ...navStyle };
    const storeName = navSettings.logoText || getStoreName(scopedSettings) || packageData?.meta?.name || 'Store';
    const logoUrl = navSettings.logoUrl || scopedSettings.logo?.main || '';
    const headerStyle = scopedSettings.theme?.headerStyle || 'gradient';
    const headerItems = resolvePreviewHeaderItems(navSettings, navigationData);
    const actionsOrder = Array.isArray(navSettings.actionsOrder) && navSettings.actionsOrder.length
      ? [...new Set([...navSettings.actionsOrder, ...DEFAULT_ACTIONS_ORDER])].filter((key) => DEFAULT_ACTIONS_ORDER.includes(key))
      : DEFAULT_ACTIONS_ORDER;
    const categoryLabels = resolvePreviewCategoryLabels(navigationData, scopedSettings, demoData);
    const announcementText = announcementSettings.text || demoData.announcementText;
    const showAnnouncement = announcementText && announcementSettings.enabled !== false && announcementSettings.enabled !== 'false';
    const sectionRows = sectionList.map((section, originalIndex) => ({ section, originalIndex }));
    const templateSectionRows = sectionRows.filter(({ section }) => section.enabled !== false && section.placement !== 'footer');
    const footerSectionRows = sectionRows.filter(({ section }) => section.enabled !== false && section.placement === 'footer');
    const firstFooterIndex = sectionList.findIndex((section) => section.placement === 'footer');
    const footerStartIndex = firstFooterIndex === -1 ? sectionList.length : firstFooterIndex;
    const canvasDragEnabled = Boolean(onReorderSection) && !compareMode;

    const getDropPosition = (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      return event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
    };
    const handleCanvasDragStart = (event, fromIndex, area) => {
      if (!canvasDragEnabled) return;
      if (!event.target.closest('[data-canvas-drag-handle="true"]')) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      setDragState({ fromIndex, overIndex: fromIndex, overPosition: 'before', area });
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(fromIndex));
    };
    const handleCanvasDragOver = (event, overIndex, area) => {
      if (!canvasDragEnabled || !dragState || dragState.area !== area) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      const overPosition = getDropPosition(event);
      if (dragState.overIndex !== overIndex || dragState.overPosition !== overPosition) {
        setDragState((current) => current ? { ...current, overIndex, overPosition } : current);
      }
    };
    const handleCanvasDrop = (event, toIndex, area) => {
      if (!canvasDragEnabled || !dragState || dragState.area !== area) return;
      event.preventDefault();
      event.stopPropagation();
      const insertIndex = getDropPosition(event) === 'after' ? toIndex + 1 : toIndex;
      onReorderSection?.(dragState.fromIndex, insertIndex, area);
      setDragState(null);
    };
    const handleCanvasDragEnd = () => setDragState(null);

    return (
    <SettingsContext.Provider value={scopedContext}>
      <ThemeProvider theme={themeObj}>
        <CssBaseline enableColorScheme />
        <Box style={cssVariables} sx={{ bgcolor: 'background.default', minHeight: 400, overflow: 'hidden' }}>
        {/* Announcement Bar */}
        {showAnnouncement && (
          <Box
            onClick={() => onSelectComponent?.('announcementBar')}
            sx={{
              bgcolor: announcementSettings.bgColor || 'primary.dark',
              color: announcementSettings.fgColor || '#fff',
              py: 0.75,
              px: 2,
              textAlign: 'center',
              cursor: onSelectComponent ? 'pointer' : 'default',
              position: 'relative',
              '&:hover': onSelectComponent ? { outline: '2px dashed #1976d2', outlineOffset: '-2px' } : undefined,
            }}
          >
            <Typography variant="body2" fontWeight={600}>{announcementText}</Typography>
          </Box>
        )}
        {/* Header */}
        <AppBar
          position="static"
          elevation={0}
          onClick={() => onSelectComponent?.('headerLayout')}
          sx={{
            background: (theme) => {
              if (navSettings.bgColor) return navSettings.bgColor;
              if (headerStyle === 'solid') return theme.palette.primary.main;
              if (headerStyle === 'glass') return theme.palette.background.paper + 'e8';
              return 'linear-gradient(135deg, ' + theme.palette.primary.dark + ' 0%, ' + theme.palette.primary.main + ' 58%, ' + theme.palette.secondary.dark + ' 100%)';
            },
            color: navSettings.fgColor || (headerStyle === 'glass' ? 'text.primary' : '#fff'),
            backdropFilter: headerStyle === 'glass' ? 'blur(14px)' : 'none',
            borderBottom: headerStyle === 'glass' ? '1px solid' : '1px solid rgba(255,255,255,0.16)',
            borderColor: headerStyle === 'glass' ? 'divider' : 'rgba(255,255,255,0.16)',
            cursor: onSelectComponent ? 'pointer' : 'default',
            position: 'relative',
            borderRadius: 0,
            '&:hover': onSelectComponent ? { outline: '2px dashed #ffffff', outlineOffset: '-2px' } : undefined,
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, gap: 2 }}>
            <Box
              onClick={(event) => { event.stopPropagation(); onSelectComponent?.('headerLogo'); }}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, minWidth: 0, cursor: onSelectComponent ? 'pointer' : 'default', px: 0.5, borderRadius: 1, '&:hover': onSelectComponent ? { outline: '2px dashed #ffffff' } : undefined }}
            >
              {logoUrl ? (
                <Box component="img" src={logoUrl} alt={storeName} sx={{ maxWidth: navSettings.logoMaxWidth || 140, maxHeight: 36, objectFit: 'contain' }} />
              ) : null}
              {navSettings.showStoreName !== false && (
                <Typography variant="h6" fontWeight={700} color="inherit" noWrap sx={{ maxWidth: 180 }}>{storeName}</Typography>
              )}
            </Box>
            {navSettings.showMenu !== false && (
              <Stack
                component="nav"
                direction="row"
                spacing={0.75}
                onClick={(event) => { event.stopPropagation(); onSelectComponent?.('headerMenu'); }}
                sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', minWidth: 120, flexShrink: 1, overflowX: 'auto', cursor: onSelectComponent ? 'pointer' : 'default', borderRadius: 1, '&:hover': onSelectComponent ? { outline: '2px dashed #ffffff' } : undefined }}
              >
                {headerItems.slice(0, 7).map((item, index) => (
                  <Button key={item.id || item.label || index} color="inherit" size="small" endIcon={item.children?.length ? <ExpandMoreIcon fontSize="small" /> : undefined} sx={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: 'auto', px: 1.25 }}>
                    {item.label}
                  </Button>
                ))}
              </Stack>
            )}
            <Box sx={{ flexGrow: 1, minWidth: 8 }} />
            {navSettings.showSearch !== false && (
              <Box
                onClick={(event) => { event.stopPropagation(); onSelectComponent?.('headerActions'); }}
                sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, width: { md: 200, lg: 320 }, px: 1.5, py: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.16)', color: 'inherit', cursor: onSelectComponent ? 'pointer' : 'default', '&:hover': onSelectComponent ? { outline: '2px dashed #ffffff' } : undefined }}
              >
                <SearchIcon fontSize="small" />
                <Typography variant="body2" sx={{ opacity: 0.9 }} noWrap>Search products...</Typography>
              </Box>
            )}
            <Stack
              direction="row"
              spacing={0.5}
              onClick={(event) => { event.stopPropagation(); onSelectComponent?.('headerActions'); }}
              sx={{ alignItems: 'center', cursor: onSelectComponent ? 'pointer' : 'default', borderRadius: 1, '&:hover': onSelectComponent ? { outline: '2px dashed #ffffff' } : undefined }}
            >
              <IconButton color="inherit" size="small"><WbSunnyIcon /></IconButton>
              {actionsOrder.map((actionKey) => {
                if (actionKey === 'cart' && navSettings.showCart !== false) {
                  return <IconButton key="cart" color="inherit" size="small"><Badge badgeContent={0} color="error"><ShoppingCartIcon /></Badge></IconButton>;
                }
                if (actionKey === 'wishlist' && navSettings.showWishlist === true) {
                  return <IconButton key="wishlist" color="inherit" size="small"><Badge badgeContent={0} color="error"><FavoriteBorderIcon /></Badge></IconButton>;
                }
                if (actionKey === 'account' && navSettings.showAccount !== false) {
                  return <IconButton key="account" color="inherit" size="small"><AccountCircleIcon /></IconButton>;
                }
                return null;
              })}
            </Stack>
          </Toolbar>
          {navSettings.showCategoryBar === true && categoryLabels.length > 0 && (
            <Box
              onClick={(event) => { event.stopPropagation(); onSelectComponent?.('headerMenu'); }}
              sx={{ px: 2, py: 1, display: 'flex', gap: 2.5, justifyContent: 'center', flexWrap: 'wrap', bgcolor: 'rgba(0,0,0,0.12)', cursor: onSelectComponent ? 'pointer' : 'default', '&:hover': onSelectComponent ? { outline: '2px dashed #ffffff', outlineOffset: '-2px' } : undefined }}
            >
              {categoryLabels.map((item) => (
                <Typography key={item} variant="body2" fontWeight={700}>{item}</Typography>
              ))}
            </Box>
          )}
        </AppBar>
        
        {/* Page Content */}
        {onAddSectionAt && (
          <CanvasInsertControl onClick={() => onAddSectionAt(0, 'template')} />
        )}

        {templateSectionRows.map(({ section, originalIndex }, i) => (
          <CanvasSectionShell
            key={section.id || originalIndex}
            section={section}
            originalIndex={originalIndex}
            area="template"
            draggable={canvasDragEnabled}
            isDragging={dragState?.fromIndex === originalIndex}
            isDropTarget={dragState?.area === 'template' && dragState?.overIndex === originalIndex && dragState?.fromIndex !== originalIndex}
            onSelect={onSelectSection}
            onDragStart={handleCanvasDragStart}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onDragEnd={handleCanvasDragEnd}
          >
            <SectionRenderer
              section={section}
              mode={onSelectSection ? 'preview' : 'live'}
              data={buildSectionData(section, demoData, settingsSnapshot)}
              index={i}
              selected={selectedSectionId === section.id}
              onSelect={() => onSelectSection?.(section)}
              onSelectComponent={onSelectComponent}
              onInlineFieldChange={onInlineFieldChange}
              onInlineFieldCommit={onInlineFieldCommit}
              onInlineBlockFocus={onInlineBlockFocus}
            />
            {onAddSectionAt && (
              <CanvasInsertControl onClick={() => onAddSectionAt(originalIndex + 1, 'template')} />
            )}
          </CanvasSectionShell>
        ))}


        {onAddSectionAt && (
          <CanvasInsertControl
            label={footerSectionRows.length ? 'Add footer section here' : 'Add section to Footer'}
            onClick={() => onAddSectionAt(footerStartIndex, 'footer')}
          />
        )}

        {footerSectionRows.map(({ section, originalIndex }, i) => (
          <CanvasSectionShell
            key={section.id || `footer-${originalIndex}`}
            section={section}
            originalIndex={originalIndex}
            area="footer"
            draggable={canvasDragEnabled}
            isDragging={dragState?.fromIndex === originalIndex}
            isDropTarget={dragState?.area === 'footer' && dragState?.overIndex === originalIndex && dragState?.fromIndex !== originalIndex}
            onSelect={onSelectSection}
            onDragStart={handleCanvasDragStart}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onDragEnd={handleCanvasDragEnd}
          >
            <SectionRenderer
              section={section}
              mode={onSelectSection ? 'preview' : 'live'}
              data={buildSectionData(section, demoData, settingsSnapshot)}
              index={templateSectionRows.length + i}
              selected={selectedSectionId === section.id}
              onSelect={() => onSelectSection?.(section)}
              onSelectComponent={onSelectComponent}
              onInlineFieldChange={onInlineFieldChange}
              onInlineFieldCommit={onInlineFieldCommit}
              onInlineBlockFocus={onInlineBlockFocus}
            />
            {onAddSectionAt && (
              <CanvasInsertControl label="Add footer section here" onClick={() => onAddSectionAt(originalIndex + 1, 'footer')} />
            )}
          </CanvasSectionShell>
        ))}

        {/* Footer */}
        <Box
          onClick={() => onSelectComponent?.('footer')}
          sx={{
            position: 'relative',
            cursor: onSelectComponent ? 'pointer' : 'default',
            '&:hover': onSelectComponent ? { outline: '2px dashed #1976d2', outlineOffset: '-2px' } : undefined,
            '&:hover::after': onSelectComponent ? {
              content: '"Footer (Click to edit)"',
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'primary.main',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 'bold',
              zIndex: 10,
              whiteSpace: 'nowrap',
            } : undefined,
          }}
        >
          <StorefrontFooter />
        </Box>
        </Box>
      </ThemeProvider>
    </SettingsContext.Provider>
    );
  };

  // Comparison mode: side by side
  const templateSettings = {
    theme: design,
    componentStyles: packageData?.componentStyles || {},
    nav: layout.nav || {},
    footer: layout.footerStyle || {},
    announcement: { ...(layout.announcementStyle || {}), text: demo.announcementText || '' },
    homepage: {
      sections,
      heroSlides: demo.heroSlides || [],
      valueProps: demo.valueProps || [],
      promoBanners: demo.promoBanners || [],
    },
    productPage: packageData?.productPage || {},
    categoryPage: packageData?.categoryPage || {},
    catalog: packageData?.catalog || {},
    blogPage: packageData?.blogPage || {},
    brandsPage: packageData?.brandsPage || {},
    accountPage: packageData?.accountPage || {},
  };

  if (compareMode && currentSettings) {
    const currentTheme = createTheme(buildStorefrontTheme(currentSettings.theme || {}));
    const currentSections = getPageSections(currentSettings, activePage, sections);
    const currentDemo = {
      announcementText: currentSettings.announcement?.text || '',
      heroSlides: currentSettings.homepage?.heroSlides || [],
      valueProps: currentSettings.homepage?.valueProps || [],
      promoBanners: currentSettings.homepage?.promoBanners || [],
    };
    const currentLayout = {
      announcementStyle: currentSettings.announcement || {},
      footerStyle: currentSettings.footer || {},
    };

    return (
      <Box sx={{ display: 'flex', gap: 1, overflow: 'auto' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" fontWeight={700} sx={{ display: 'block', textAlign: 'center', py: 0.5, bgcolor: 'action.hover' }}>Current</Typography>
          {previewContent(currentTheme, currentSections, currentDemo, 'Current', currentLayout, currentSettings)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" fontWeight={700} sx={{ display: 'block', textAlign: 'center', py: 0.5, bgcolor: 'action.hover' }}>Template</Typography>
          {previewContent(previewTheme, sections, demo, 'Template', layout, templateSettings)}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ width, mx: 'auto', transition: 'width 0.3s ease', overflow: 'hidden', border: mode !== 'desktop' ? '1px solid' : 'none', borderColor: 'divider', borderRadius: mode !== 'desktop' ? 2 : 0 }}>
      {previewContent(previewTheme, sections, demo, 'Preview', layout, templateSettings)}
    </Box>
  );
};

export default StorefrontTemplatePreview;
