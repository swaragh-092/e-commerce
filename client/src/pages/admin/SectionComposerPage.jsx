import { useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import {
  Box, Button, Card, Container, Divider, IconButton, Stack, Switch,
  Typography, CircularProgress, ToggleButtonGroup, ToggleButton,
  TextField, FormControl, InputLabel, Select, MenuItem, Paper, Chip, Breadcrumbs,
  Popover, List, ListItemButton, ListItemText, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import TabletMacIcon from '@mui/icons-material/TabletMac';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';

import { getSettingsGroup, updateSettingsBulk } from '../../services/settingsService';
import { useNotification } from '../../context/NotificationContext';
import { SettingsContext } from '../../context/ThemeContext';
import { getSectionLabel, SECTION_VARIANTS } from '../../components/storefront/sections/sectionRegistry';
import { createDefaultSection } from '../../utils/sectionPresets';
import AddSectionDialog from '../../components/admin/sections/AddSectionDialog';
import SaveAsTemplateDialog from '../../components/admin/themes/SaveAsTemplateDialog';
import StorefrontTemplatePreview from '../../components/admin/themes/StorefrontTemplatePreview';
import DesignerTreePanel from '../../components/admin/themes/designer/DesignerTreePanel';
import DesignerSectionEditor from '../../components/admin/themes/designer/DesignerSectionEditor';
import DesignerThemePanel from '../../components/admin/themes/designer/DesignerThemePanel';
import LiveStorefrontPreview from '../../components/admin/settings/LiveStorefrontPreview';
import CssVarsPanel from '../../components/admin/settings/CssVarsPanel';
import DesignTokensEditor from '../../components/admin/themes/DesignTokensEditor';
import CustomCssEditor from '../../components/admin/settings/CustomCssEditor';
import { ProductCardStyleEditor, CategoryCardStyleEditor, PromoCardStyleEditor, BrandCardStyleEditor, TrustCardStyleEditor, HeaderStyleEditor, FooterStyleEditor, CartItemStyleEditor, CheckoutBlockStyleEditor, FormControlStyleEditor, BadgeChipStyleEditor } from '../../components/admin/settings/CardStyleEditors';
import { ProductPageStyleEditor, CategoryPageStyleEditor, CatalogPageStyleEditor, BlogPageStyleEditor, BrandsPageStyleEditor, AccountPageStyleEditor } from '../../components/admin/settings/PageStyleEditors';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

const PRODUCT_SOURCES = [
  { value: 'featured', label: 'Featured' },
  { value: 'sale', label: 'On Sale' },
  { value: 'bestSellers', label: 'Best Sellers' },
  { value: 'newest', label: 'Newest' },
  { value: 'recommended', label: 'Recommended' },
];

const PREVIEW_WIDTHS = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

const DESIGNER_PAGES = [
  { value: 'home',      label: 'Home',       status: 'active', previewPath: '/',                icon: '🏠' },
  { value: 'product',   label: 'Product',    status: 'active', previewPath: '/products',        icon: '🛍️' },
  { value: 'category',  label: 'Category',   status: 'active', previewPath: '/category/all',    icon: '📂' },
  { value: 'collection', label: 'Collection', status: 'active', previewPath: '/products',       icon: '🗂️' },
  { value: 'search',    label: 'Search',     status: 'active', previewPath: '/search',          icon: '🔍' },
  { value: 'cart',      label: 'Cart',       status: 'active', previewPath: '/cart',            icon: '🛒' },
  { value: 'checkout',  label: 'Checkout',   status: 'active', previewPath: '/checkout',        icon: '💳' },
  { value: 'account',   label: 'Account',    status: 'active', previewPath: '/account',         icon: '👤' },
  { value: 'orders',    label: 'Orders',     status: 'active', previewPath: '/account/orders',  icon: '📦' },
  { value: 'wishlist',  label: 'Wishlist',   status: 'active', previewPath: '/wishlist',        icon: '❤️' },
  { value: 'brand',     label: 'Brands',     status: 'active', previewPath: '/brands',          icon: '🏷️' },
  { value: 'blog',      label: 'Blog',       status: 'active', previewPath: '/blogs',           icon: '📝' },
  { value: 'not-found', label: '404 Page',   status: 'active', previewPath: '/not-found-preview', icon: '⚠️' },
];


const DESIGNER_COMPONENTS = [
  { value: 'designTokens', label: 'Design Tokens', Editor: DesignTokensEditor },
  { value: 'productCard', label: 'Product Card', Editor: ProductCardStyleEditor },
  { value: 'categoryCard', label: 'Category Card', Editor: CategoryCardStyleEditor },
  { value: 'promoCard', label: 'Promo Banner', Editor: PromoCardStyleEditor },
  { value: 'brandCard', label: 'Brand Card', Editor: BrandCardStyleEditor },
  { value: 'trustCard', label: 'Trust Item', Editor: TrustCardStyleEditor },
  { value: 'headerLayout', label: 'Header Layout', Editor: HeaderStyleEditor },
  { value: 'announcementBar', label: 'Announcement Bar', Editor: HeaderStyleEditor },
  { value: 'headerLogo', label: 'Logo', Editor: HeaderStyleEditor },
  { value: 'headerMenu', label: 'Menu', Editor: HeaderStyleEditor },
  { value: 'headerActions', label: 'Search, Account & Cart', Editor: HeaderStyleEditor },
  { value: 'footer', label: 'Footer Settings', Editor: FooterStyleEditor },
  { value: 'cartItem', label: 'Cart Item Row', Editor: CartItemStyleEditor },
  { value: 'checkoutBlock', label: 'Checkout Blocks', Editor: CheckoutBlockStyleEditor },
  { value: 'formControl', label: 'Forms & Inputs', Editor: FormControlStyleEditor },
  { value: 'badgeChip', label: 'Badges & Chips', Editor: BadgeChipStyleEditor },
  { value: 'customCss', label: 'Advanced CSS', Editor: CustomCssEditor, requiresAdvanced: true },
];

const SECTION_COMPONENT_MAP = {
  'product-row': 'productCard',
  'featured-collection-grid': 'categoryCard',
  'category-shortcuts': 'categoryCard',
  'promo-banners': 'promoCard',
  'brand-showcase': 'brandCard',
  'hero-carousel': 'headerLayout',
  'value-props': 'trustCard',
  'trust-badges': 'trustCard',
};

const SectionComposerPage = () => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  
  // Unified FSM State for the designer panel view
  const [panelView, setPanelView] = useState({ mode: 'tree', sectionId: null, componentKey: null, blockKey: null, blockIndex: null });
  
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState({ index: null, area: 'template' });
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [themeSettings, setThemeSettings] = useState({});
  const [componentStyles, setComponentStyles] = useState({});
  const [navSettings, setNavSettings] = useState({});
  const [footerSettings, setFooterSettings] = useState({});
  const [announcementSettings, setAnnouncementSettings] = useState({});
  const [advancedSettings, setAdvancedSettings] = useState({ customCSS: '' });
  
  // Unified page style settings state
  const [pageSettings, setPageSettings] = useState({});

  // History state for Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Viewport mode state for live preview
  const [viewportMode, setViewportMode] = useState('desktop');
  const [previewRenderMode, setPreviewRenderMode] = useState('live');
  const [activePage, setActivePage] = useState('home');
  const [pagePickerAnchor, setPagePickerAnchor] = useState(null);
  const [pageSearch, setPageSearch] = useState('');

  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const canManageAdvancedSettings = hasPermission(PERMISSIONS.SETTINGS_ADVANCED);
  const { settings } = useContext(SettingsContext) || {};

  // FSM helper transitions
  const selectSection = (section) => {
    setPanelView({ mode: 'section-editor', sectionId: section?.id || null, componentKey: null, blockKey: null, blockIndex: null });
  };

  const focusBlock = (blockKey, blockIndex) => {
    setPanelView((prev) => ({ ...prev, blockKey, blockIndex }));
  };

  const clearBlockFocus = () => {
    setPanelView((prev) => ({ ...prev, blockKey: null, blockIndex: null }));
  };

  const handleInlineBlockFocus = (sectionId, blockKey, blockIndex) => {
    setPanelView({ mode: 'section-editor', sectionId, componentKey: null, blockKey, blockIndex });
  };

  const openComponentEditor = (componentKey) => {
    setPanelView({ mode: 'theme-settings', sectionId: null, componentKey, blockKey: null, blockIndex: null });
  };

  const backToTree = () => {
    setPanelView({ mode: 'tree', sectionId: null, componentKey: null, blockKey: null, blockIndex: null });
  };

  // Derived properties from active FSM state
  const editSection = panelView.mode === 'section-editor'
    ? sections.find((s) => s.id === panelView.sectionId) || null
    : null;

  const activeComponent = panelView.mode === 'theme-settings' ? panelView.componentKey : null;

  const getBlockLabel = (section, blockKey, blockIndex) => {
    if (!section || blockKey == null || blockIndex == null) return null;
    const blocks = section[blockKey];
    if (!Array.isArray(blocks) || !blocks[blockIndex]) return null;
    const block = blocks[blockIndex];
    return block.title || block.heading || block.name || block.author || block.kicker || `${blockKey} ${blockIndex + 1}`;
  };

  useEffect(() => {
    if (!settings) return;
    if (settings.theme)          setThemeSettings(settings.theme);
    if (settings.componentStyles) setComponentStyles(settings.componentStyles);
    if (settings.nav)            setNavSettings(settings.nav);
    if (settings.footer)         setFooterSettings(settings.footer);
    if (settings.announcement)   setAnnouncementSettings(settings.announcement);
    if (settings.advanced)       setAdvancedSettings({ customCSS: settings.advanced.customCSS || '' });
    // Load all per-page settings into the unified map
    const pgs = {};
    const pageKeys    = ['productPage', 'categoryPage', 'catalog', 'blogPage', 'brandsPage', 'accountPage', 'cartPage', 'checkoutPage', 'wishlistPage', 'searchPage', 'notFoundPage', 'ordersPage'];
    const pageMapKeys = ['product',    'category',     'collection', 'blog',   'brand',      'account',     'cart',     'checkout',     'wishlist',     'search',     'not-found',    'orders'];
    pageKeys.forEach((k, i) => { if (settings[k]) pgs[pageMapKeys[i]] = settings[k]; });
    setPageSettings(pgs);
  }, [settings]);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    try {
      const homepage = await getSettingsGroup('homepage');
      const initialSections = homepage?.sections || [];
      setSections(initialSections);
      setHistory([initialSections]);
      setHistoryIndex(0);
    } catch {
      notify('Failed to load homepage sections', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Map unified pageSettings back to their API groups
      const pageGroupMap = {
        product:     'productPage',
        category:    'categoryPage',
        collection:  'catalog',
        blog:        'blogPage',
        brand:       'brandsPage',
        account:     'accountPage',
        cart:        'cartPage',
        checkout:    'checkoutPage',
        wishlist:    'wishlistPage',
        search:      'searchPage',
        'not-found': 'notFoundPage',
        orders:      'ordersPage',
      };
      const pageEntries = Object.entries(pageSettings || {}).flatMap(([pg, vals]) =>
        Object.entries(vals || {}).map(([key, value]) => ({ key, value, group: pageGroupMap[pg] || pg }))
      );
      await updateSettingsBulk([
        { key: 'sections', value: sections, group: 'homepage' },
        ...Object.entries(themeSettings || {}).map(([key, value]) => ({ key, value, group: 'theme' })),
        ...Object.entries(componentStyles || {}).map(([key, value]) => ({ key, value, group: 'componentStyles' })),
        ...Object.entries(navSettings || {}).map(([key, value]) => ({ key, value, group: 'nav' })),
        ...Object.entries(footerSettings || {}).map(([key, value]) => ({ key, value, group: 'footer' })),
        ...Object.entries(announcementSettings || {}).map(([key, value]) => ({ key, value, group: 'announcement' })),
        ...(canManageAdvancedSettings ? Object.entries(advancedSettings || {}).map(([key, value]) => ({ key, value, group: 'advanced' })) : []),
        ...pageEntries,
      ]);
      notify('Store Designer changes saved', 'success');
      setDirty(false);
      // Reset history baseline to current state
      setHistory([sections]);
      setHistoryIndex(0);
    } catch {
      notify('Failed to save Store Designer changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const update = (next, skipHistory = false) => {
    setSections(next);
    setDirty(true);
    if (!skipHistory) {
      const nextHistory = history.slice(0, historyIndex + 1);
      setHistory([...nextHistory, next]);
      setHistoryIndex(nextHistory.length);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setSections(history[prevIndex]);
      setDirty(true);
      if (panelView.sectionId) {
        const active = history[prevIndex].find((s) => s.id === panelView.sectionId);
        if (!active) backToTree();
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setSections(history[nextIndex]);
      setDirty(true);
      if (panelView.sectionId) {
        const active = history[nextIndex].find((s) => s.id === panelView.sectionId);
        if (!active) backToTree();
      }
    }
  };

  const move = (index, dir, area = null) => {
    const next = [...sections];
    const current = next[index];
    if (!current) return;

    const belongsToArea = (section) => {
      if (!area) return true;
      return area === 'footer' ? section?.placement === 'footer' : section?.placement !== 'footer';
    };

    let target = index + dir;
    while (target >= 0 && target < next.length && !belongsToArea(next[target])) {
      target += dir;
    }
    if (target < 0 || target >= next.length || !belongsToArea(current)) return;

    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  const reorderSection = (fromIndex, insertIndex, area = null) => {
    const moving = sections[fromIndex];
    if (!moving) return;

    const belongsToArea = (section) => {
      if (!area) return true;
      return area === 'footer' ? section?.placement === 'footer' : section?.placement !== 'footer';
    };
    if (!belongsToArea(moving)) return;

    const areaIndexes = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => belongsToArea(section))
      .map(({ index }) => index);
    const minIndex = areaIndexes[0] ?? 0;
    const maxInsertIndex = (areaIndexes[areaIndexes.length - 1] ?? sections.length - 1) + 1;
    const boundedInsertIndex = Math.max(minIndex, Math.min(insertIndex, maxInsertIndex));
    const adjustedInsertIndex = fromIndex < boundedInsertIndex ? boundedInsertIndex - 1 : boundedInsertIndex;
    if (fromIndex === adjustedInsertIndex) return;

    const next = [...sections];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(adjustedInsertIndex, 0, removed);
    update(next);
    selectSection(removed);
  };

  const toggle = (index) => {
    const next = [...sections];
    next[index] = { ...next[index], enabled: !next[index].enabled };
    update(next);
  };

  const remove = (index) => {
    const removedId = sections[index]?.id;
    const next = sections.filter((_, i) => i !== index);
    update(next);
    if (removedId && panelView.sectionId === removedId) backToTree();
  };

  const duplicate = (section) => {
    const idx = sections.findIndex((s) => s.id === section.id);
    const copy = { ...section, id: `${section.type}-${Date.now()}` };
    const next = [...sections];
    next.splice(idx + 1, 0, copy);
    update(next);
  };

  const removeSectionById = (section) => {
    const index = sections.findIndex((item) => item.id === section?.id);
    if (index >= 0) remove(index);
  };

  const duplicateSection = (section) => {
    if (!section) return;
    const index = sections.findIndex((item) => item.id === section.id);
    const copy = {
      ...section,
      id: `${section.id || section.type}-copy-${Date.now()}`,
      title: section.title ? `${section.title} Copy` : section.title,
    };
    const next = [...sections];
    next.splice(index >= 0 ? index + 1 : next.length, 0, copy);
    update(next);
    selectSection(copy);
  };

  const handlePageSettingChange = (page, value) => {
    setPageSettings((current) => ({
      ...current,
      [page]: value,
    }));
    setDirty(true);
  };

  // Debounce live-preview updates from inline field edits. Color pickers
  // fire onChange on every mouse pixel inside the picker; without a debounce
  // the entire preview tree re-renders at 60+ fps while dragging, janking
  // the UI. The setDirty + sections update stay immediate so the editor
  // input remains responsive, but the downstream preview re-render is
  // coalesced to ~200ms.
  const livePreviewRef = useRef({ value: null, timer: null });
  const handleInlineFieldChange = (key, value) => {
    if (!panelView.sectionId) return;
    const next = sections.map((section) =>
      section.id === panelView.sectionId ? updateSectionField(section, key, value) : section
    );
    update(next, true);
  };

  const handleInlineFieldBlur = () => {
    // Commit the current state to the undo/redo history on input blur
    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, sections]);
    setHistoryIndex(nextHistory.length);
  };

  const updateSectionField = (section, key, value) => {
    if (!String(key).includes('.')) {
      return { ...section, [key]: value };
    }

    const parts = String(key).split('.').filter(Boolean);
    const next = { ...section };
    let cursor = next;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const nextPart = parts[index + 1];
      const shouldBeArray = nextPart !== undefined && /^\d+$/.test(nextPart);

      if (isLast) {
        cursor[part] = value;
        return;
      }

      const existing = cursor[part];
      cursor[part] = Array.isArray(existing)
        ? [...existing]
        : existing && typeof existing === 'object'
          ? { ...existing }
          : shouldBeArray
            ? []
            : {};
      cursor = cursor[part];
    });

    return next;
  };

  const handlePreviewFieldChange = (sectionId, key, value, seedPatch = null) => {
    const nextSections = sections.map((section) => {
      if (section.id !== sectionId) return section;
      const base = seedPatch && typeof seedPatch === 'object' ? { ...section, ...seedPatch } : section;
      return updateSectionField(base, key, value);
    });
    setSections(nextSections);
    setDirty(true);
    const updated = nextSections.find((section) => section.id === sectionId);
    if (updated) {
      setPanelView({ mode: 'section-editor', sectionId: updated.id, componentKey: null });
    }
  };

  const handlePreviewFieldCommit = (sectionId, key, value, seedPatch = null) => {
    const nextSections = sections.map((section) => {
      if (section.id !== sectionId) return section;
      const base = seedPatch && typeof seedPatch === 'object' ? { ...section, ...seedPatch } : section;
      return updateSectionField(base, key, value);
    });
    const updated = nextSections.find((section) => section.id === sectionId);
    if (!updated) return;
    update(nextSections);
    setPanelView({ mode: 'section-editor', sectionId: updated.id, componentKey: null });
  };

  const openAddSection = (index = sections.length, area = 'template') => {
    setAddTarget({ index, area });
    setAddOpen(true);
  };

  const handleAdd = (newSection) => {
    const insertIndex = Number.isInteger(addTarget.index) ? addTarget.index : sections.length;
    const nextSection = addTarget.area === 'footer' ? { ...newSection, placement: 'footer' } : { ...newSection, placement: undefined };
    const next = [...sections];
    next.splice(Math.max(0, Math.min(insertIndex, next.length)), 0, nextSection);
    update(next);
    selectSection(nextSection);
    setAddOpen(false);
    setAddTarget({ index: null, area: 'template' });
  };

  const applySmartPreset = () => {
    if (!editSection) return;
    const nextSection = {
      ...createDefaultSection(editSection.type, {
        id: editSection.id,
        variant: editSection.variant,
        title: editSection.title,
        sectionPresets: settings?.sectionPresets || {},
      }),
      enabled: editSection.enabled !== false,
    };
    update(sections.map((s) => (s.id === editSection.id ? nextSection : s)));
  };

  const handleComponentStyleChange = (componentName, nextValue) => {
    setComponentStyles((current) => ({
      ...(current || {}),
      [componentName]: nextValue,
    }));
    setDirty(true);
  };

  // Extract live block items from sections for demo content fallback
  const extractLiveItems = (sectionType, blockKey) => {
    const section = sections.find((s) => s.type === sectionType);
    return section?.[blockKey]?.length ? section[blockKey] : null;
  };

  // Construct mock packageData dynamically using active settings + current sections list
  const packageData = useMemo(() => {
    if (!settings) return null;
    return {
      meta: { name: settings.general?.storeName || 'Store' },
      design: { theme: themeSettings || settings.theme || {} },
      layout: {
        homepageSections: sections,
        announcementStyle: announcementSettings || {},
        footerStyle: footerSettings || {},
        nav: navSettings || {},
      },
      demoContent: {
        announcementText: announcementSettings?.text || '',
        heroSlides: extractLiveItems('hero-carousel', 'slides') || settings.homepage?.heroSlides || [],
        valueProps: extractLiveItems('value-props', 'items') || settings.homepage?.valueProps || [],
        promoBanners: extractLiveItems('promo-banners', 'items') || settings.homepage?.promoBanners || [],
        categoryTiles: extractLiveItems('category-shortcuts', 'items') || settings.homepage?.categoryTiles || [],
      },
      componentStyles: componentStyles || settings.componentStyles || {},
      sectionPresets: settings.sectionPresets || {},
      productPage: pageSettings.product || {},
      categoryPage: pageSettings.category || {},
      catalog: pageSettings.collection || {},
      blogPage: pageSettings.blog || {},
      brandsPage: pageSettings.brand || {},
      accountPage: pageSettings.account || {},
      cartPage: pageSettings.cart || {},
      checkoutPage: pageSettings.checkout || {},
      wishlistPage: pageSettings.wishlist || {},
      searchPage: pageSettings.search || {},
      notFoundPage: pageSettings['not-found'] || {},
      ordersPage: pageSettings.orders || {},
    };
  }, [settings, sections, themeSettings, componentStyles, navSettings, footerSettings, announcementSettings, pageSettings]);

  // Debounced live-preview derivation. The editor's local state updates
  // synchronously on every keystroke / color-picker pixel, but the
  // `livePreviewSettings` object that flows into StorefrontTemplatePreview
  // is recomputed on a 200ms idle. Without this, dragging a color picker
  // re-renders the entire 8-section preview tree 60+ times per second.
  const [livePreviewTick, setLivePreviewTick] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setLivePreviewTick((t) => t + 1), 200);
    return () => window.clearTimeout(timer);
  }, [settings, sections, themeSettings, componentStyles, navSettings, footerSettings, announcementSettings, pageSettings, advancedSettings, canManageAdvancedSettings]);

  const livePreviewSettings = useMemo(() => {
    if (!settings) return null;
    return {
      ...settings,
      theme: themeSettings || settings.theme || {},
      homepage: { ...(settings.homepage || {}), sections },
      componentStyles: componentStyles || settings.componentStyles || {},
      nav: navSettings || {},
      footer: footerSettings || {},
      announcement: announcementSettings || {},
      productPage: pageSettings.product || {},
      categoryPage: pageSettings.category || {},
      catalog: pageSettings.collection || {},
      blogPage: pageSettings.blog || {},
      brandsPage: pageSettings.brand || {},
      accountPage: pageSettings.account || {},
      cartPage: pageSettings.cart || {},
      checkoutPage: pageSettings.checkout || {},
      wishlistPage: pageSettings.wishlist || {},
      searchPage: pageSettings.search || {},
      notFoundPage: pageSettings['not-found'] || {},
      ordersPage: pageSettings.orders || {},
      advanced: canManageAdvancedSettings ? { ...(settings.advanced || {}), ...(advancedSettings || {}) } : settings.advanced || {},
    };
  // Depend on `livePreviewTick` so the memo re-runs only after the 200ms debounce.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, sections, themeSettings, componentStyles, navSettings, footerSettings, announcementSettings, pageSettings, advancedSettings, canManageAdvancedSettings, livePreviewTick]);

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 5, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Determine section types for conditional form controls
  const isProductRow = editSection?.type === 'product-row';
  const isCountdown = editSection?.type === 'countdown-sale';
  const isNewsletter = editSection?.type === 'newsletter-signup';
  const isHero = editSection?.type === 'hero-carousel';
  const hasCategories = editSection?.type === 'category-shortcuts' || editSection?.type === 'featured-collection-grid';
  const hasCtaLink = isCountdown || editSection?.type === 'editorial-image-text' || editSection?.type === 'promo-banners';
  const variants = editSection ? (SECTION_VARIANTS[editSection.type] || []) : [];
  const activeComponentConfig = DESIGNER_COMPONENTS.find((item) => item.value === activeComponent) || DESIGNER_COMPONENTS[0];
  const ActiveComponentEditor = activeComponentConfig.Editor;

  const editMappedComponent = editSection ? SECTION_COMPONENT_MAP[editSection.type] : null;
  const editMappedComponentLabel = editMappedComponent ? DESIGNER_COMPONENTS.find((item) => item.value === editMappedComponent)?.label : null;
  const activePageConfig = DESIGNER_PAGES.find((page) => page.value === activePage) || DESIGNER_PAGES[0];
  const activePageLabel = activePageConfig.label;
  const pagePickerOpen = Boolean(pagePickerAnchor);
  const pageSearchQuery = pageSearch.trim().toLowerCase();
  const filteredDesignerPages = pageSearchQuery
    ? DESIGNER_PAGES.filter((page) => {
      const haystack = [page.label, page.value, page.previewPath || ''].join(' ').toLowerCase();
      return haystack.includes(pageSearchQuery);
    })
    : DESIGNER_PAGES;
  const handleSelectDesignerPage = (page) => {
    if (page.status !== 'active') return;
    setActivePage(page.value);
    backToTree();
    setPagePickerAnchor(null);
    setPageSearch('');
  };
  const blockLabel = editSection ? getBlockLabel(editSection, panelView.blockKey, panelView.blockIndex) : null;
  const designerBreadcrumbs = activePage !== 'home'
    ? [activePageLabel, 'Page Layout']
    : editSection
      ? blockLabel
        ? [activePageLabel, 'Sections', getSectionLabel(editSection), blockLabel]
        : [activePageLabel, 'Sections', getSectionLabel(editSection)]
      : panelView.mode === 'theme-settings'
        ? [activePageLabel, 'Components', activeComponentConfig.label]
        : [activePageLabel, 'Sections'];


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', bgcolor: '#f6f6f7' }}>
      
      {/* Top Action Bar */}
      <Paper elevation={0} variant="outlined" sx={{ px: 1.5, py: 1, borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0, bgcolor: 'background.paper', zIndex: 10 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) auto minmax(220px, 1fr)', alignItems: 'center', gap: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={800} noWrap>
              Store Designer
            </Typography>
            <Chip label={dirty ? 'Unsaved' : 'Saved'} size="small" color={dirty ? 'warning' : 'success'} variant={dirty ? 'outlined' : 'filled'} sx={{ height: 22, fontWeight: 700 }} />
          </Stack>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', minWidth: 0 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={(event) => setPagePickerAnchor(event.currentTarget)}
              sx={{ minWidth: 190, justifyContent: 'space-between', textTransform: 'none', fontWeight: 700 }}
            >
              {activePageLabel}
              <Box component="span" sx={{ ml: 1, color: 'text.secondary' }}>v</Box>
            </Button>
            <Chip label={activePageConfig.status === 'active' ? 'Active' : 'Draft'} size="small" color="success" sx={{ height: 22, fontWeight: 700 }} />
            <Popover
              open={pagePickerOpen}
              anchorEl={pagePickerAnchor}
              onClose={() => setPagePickerAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
              PaperProps={{ sx: { width: 340, mt: 1, borderRadius: 1.5, overflow: 'hidden' } }}
            >
              <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <TextField
                  autoFocus
                  size="small"
                  fullWidth
                  placeholder="Search store pages"
                  value={pageSearch}
                  onChange={(event) => setPageSearch(event.target.value)}
                />
              </Box>
              <List dense disablePadding sx={{ maxHeight: 390, overflowY: 'auto', py: 0.5 }}>
                {filteredDesignerPages.map((page) => (
                  <ListItemButton
                    key={page.value}
                    selected={page.value === activePage}
                    disabled={page.status !== 'active'}
                    onClick={() => handleSelectDesignerPage(page)}
                    sx={{ px: 2, py: 1, gap: 1.5 }}
                  >
                    {page.icon && (
                      <Typography sx={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{page.icon}</Typography>
                    )}
                    <ListItemText
                      primary={page.label}
                      secondary={page.previewPath}
                      primaryTypographyProps={{ fontWeight: page.value === activePage ? 800 : 600, fontSize: '0.9rem' }}
                      secondaryTypographyProps={{ fontSize: '0.72rem' }}
                    />
                    {page.status !== 'active' && <Chip label="Soon" size="small" variant="outlined" />}
                  </ListItemButton>
                ))}
                {filteredDesignerPages.length === 0 && (
                  <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">No matching pages.</Typography>
                  </Box>
                )}
              </List>
            </Popover>
          </Box>

          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ justifyContent: 'flex-end', minWidth: 0 }}>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <IconButton size="small" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo">
              <UndoIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo">
              <RedoIcon fontSize="small" />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Button size="small" variant="text" onClick={() => setSaveTemplateOpen(true)}>Save as Template</Button>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => openAddSection(sections.length, 'template')}>Add Section</Button>
            <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={!dirty || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Stack>
        </Box>
      </Paper>

      <Box sx={{ px: 2, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Breadcrumbs aria-label="Store Designer location" separator="›" sx={{ fontSize: '0.78rem' }}>
          {designerBreadcrumbs.map((item, index) => {
            const isLast = index === designerBreadcrumbs.length - 1;
            const handleClick = () => {
              if (isLast) return;
              if (index === 0) {
                backToTree();
              } else if (designerBreadcrumbs.length === 4 && index === 2) {
                clearBlockFocus();
              } else {
                backToTree();
              }
            };
            return (
              <Typography
                key={`${item}-${index}`}
                variant="caption"
                color={isLast ? 'text.primary' : 'text.secondary'}
                fontWeight={isLast ? 800 : 600}
                onClick={handleClick}
                sx={isLast ? {} : { cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'primary.main' } }}
              >
                {item}
              </Typography>
            );
          })}
        </Breadcrumbs>
      </Box>

      {/* Main Designer Grid */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', bgcolor: '#f6f6f7' }}>
        
        {/* Left Sidebar: Controls & Settings */}
        <Box sx={{ width: 304, borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

          {editSection ? (
            <DesignerSectionEditor
              section={editSection}
              onBack={backToTree}
              onChange={handleInlineFieldChange}
              onBlur={handleInlineFieldBlur}
              onApplyPreset={applySmartPreset}
              onDuplicate={duplicateSection}
              onDelete={removeSectionById}
              onComponentEdit={openComponentEditor}
              activeBlockKey={panelView.blockKey}
              activeBlockIndex={panelView.blockIndex}
              onBlockFocus={focusBlock}
              mappedComponent={editMappedComponent}
              mappedComponentLabel={editMappedComponentLabel}
            />
          ) : panelView.mode === 'theme-settings' ? (
            <DesignerThemePanel
              activeComponent={activeComponent}
              onComponentSelect={(key) => setPanelView({ mode: 'theme-settings', sectionId: null, componentKey: key })}
              onBack={backToTree}
              themeSettings={themeSettings}
              componentStyles={componentStyles}
              navSettings={navSettings}
              announcementSettings={announcementSettings}
              footerSettings={footerSettings}
              advancedSettings={advancedSettings}
              onThemeSettingsChange={(value) => {
                setThemeSettings(value);
                setDirty(true);
              }}
              onComponentStyleChange={handleComponentStyleChange}
              onNavChange={(value) => {
                setNavSettings(value);
                setDirty(true);
              }}
              onAnnouncementChange={(value) => {
                setAnnouncementSettings(value);
                setDirty(true);
              }}
              onFooterChange={(value) => {
                setFooterSettings(value);
                setDirty(true);
              }}
              onAdvancedChange={(value) => {
                setAdvancedSettings(value);
                setDirty(true);
              }}
              canManageAdvancedSettings={canManageAdvancedSettings}
            />
          ) : (
            <DesignerTreePanel
              sections={sections}
              activePage={activePage}
              pageSettings={pageSettings}
              selectedSectionId={panelView.sectionId}
              onSectionClick={selectSection}
              onThemeSettingsClick={() => setPanelView({ mode: 'theme-settings', sectionId: null, componentKey: null })}
              onAddSection={openAddSection}
              onMoveSection={move}
              onToggleSection={toggle}
              onDeleteSection={remove}
              onPageSettingChange={handlePageSettingChange}
              onHeaderClick={() => openComponentEditor('headerLayout')}
              onHeaderPartClick={openComponentEditor}
              onFooterClick={() => openComponentEditor('footer')}
            />
          )}


        </Box>

        {/* Right Sidebar: Storefront Preview Container */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* Preview Toolbar */}
          <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Storefront Preview
              </Typography>
              <ToggleButtonGroup
                value={previewRenderMode}
                exclusive
                onChange={(_, v) => v && setPreviewRenderMode(v)}
                size="small"
              >
                <ToggleButton value="live" aria-label="Live storefront iframe">Live Storefront</ToggleButton>
                <ToggleButton value="mock" aria-label="Editable canvas preview">Editable Canvas</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <ToggleButtonGroup
              value={viewportMode}
              exclusive
              onChange={(_, v) => v && setViewportMode(v)}
              size="small"
            >
              <ToggleButton value="desktop" aria-label="Desktop" title="Desktop View"><DesktopWindowsIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="tablet" aria-label="Tablet" title="Tablet View"><TabletMacIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="mobile" aria-label="Mobile" title="Mobile View"><PhoneIphoneIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Preview Canvas Area */}
          <Box sx={{ flex: 1, p: viewportMode === 'desktop' ? 0 : 3, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', bgcolor: '#f6f6f7' }}>
            <Box
              sx={{
                width: PREVIEW_WIDTHS[viewportMode] || '100%',
                maxWidth: '100%',
                minHeight: '100%',
                bgcolor: 'background.paper',
                borderRadius: viewportMode === 'desktop' ? 0 : 3,
                boxShadow: viewportMode === 'desktop' ? 'none' : '0 18px 44px rgba(0, 0, 0, 0.12)',
                border: viewportMode === 'desktop' ? 'none' : '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                transition: 'width 0.2s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ width: '100%', overflowY: 'auto', maxHeight: 'calc(100vh - 210px)' }}>
                {previewRenderMode === 'live' ? (
                  livePreviewSettings && (
                    <LiveStorefrontPreview
                      settings={livePreviewSettings}
                      path={activePageConfig.previewPath || '/'}
                      reloadOnSettingsChange
                      device={viewportMode}
                      showToolbar={false}
                      frameHeight="calc(100vh - 210px)"
                    />
                  )
                ) : packageData && (
                  <StorefrontTemplatePreview
                    packageData={packageData}
                    mode={viewportMode}
                    activePage={activePage}
                    currentSettings={livePreviewSettings}
                    componentStyles={componentStyles}
                    selectedSectionId={panelView.sectionId}
                    onSelectSection={selectSection}
                    onSelectComponent={(component) => openComponentEditor(component)}
                    onInlineFieldChange={handlePreviewFieldChange}
                    onInlineFieldCommit={handlePreviewFieldCommit}
                    onInlineBlockFocus={handleInlineBlockFocus}
                    onAddSectionAt={(index, area) => openAddSection(index, area)}
                    onReorderSection={reorderSection}
                  />
                )}
              </Box>
            </Box>
          </Box>

        </Box>

      </Box>

      {/* Modals & Dialogs */}
      <AddSectionDialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setAddTarget({ index: null, area: 'template' });
        }}
        onAdd={handleAdd}
        existingIds={sections.map((s) => s.id)}
        insertLabel={addTarget.area === 'footer' ? 'Footer' : 'this template'}
        sectionPresets={settings?.sectionPresets || {}}
      />

      <SaveAsTemplateDialog
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        onSaved={() => notify('Template saved to library', 'success')}
      />

    </Box>
  );
};

export default SectionComposerPage;
