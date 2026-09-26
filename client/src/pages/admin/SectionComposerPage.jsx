import { useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import {
  Box, Button, Card, Container, Divider, IconButton, Stack, Switch,
  Typography, CircularProgress, ToggleButtonGroup, ToggleButton,
  TextField, FormControl, InputLabel, Select, MenuItem, Paper, Chip, Breadcrumbs,
  Popover, List, ListItemButton, ListItemText, Grid, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import HistoryIcon from '@mui/icons-material/History';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import TabletMacIcon from '@mui/icons-material/TabletMac';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import CollectionsBookmarkOutlinedIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useSearchParams } from 'react-router-dom';

import { getDesignDraft, getDesignState, getDesignVersions, getSettingsGroup, publishDesignDraft, restoreDesignVersion, saveDesignDraft } from '../../services/settingsService';
import { useNotification } from '../../context/NotificationContext';
import { SettingsContext } from '../../context/ThemeContext';
import { getSectionLabel, SECTION_VARIANTS } from '../../components/storefront/sections/sectionRegistry';
import { createDefaultSection } from '../../utils/sectionPresets';
import AddSectionDialog from '../../components/admin/sections/AddSectionDialog';
import SaveAsTemplateDialog from '../../components/admin/themes/SaveAsTemplateDialog';
import DesignVersionHistoryDialog from '../../components/admin/themes/DesignVersionHistoryDialog';
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
import { DESIGN_COMPONENT_REGISTRY, DESIGN_PAGE_REGISTRY, getDesignResetTarget, getDesignSource } from '../../utils/designRegistry';

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

const PAGE_ICON_BY_KEY = {
  home: <HomeOutlinedIcon fontSize="small" />,
  product: <ShoppingBagOutlinedIcon fontSize="small" />,
  category: <CategoryOutlinedIcon fontSize="small" />,
  collection: <CollectionsBookmarkOutlinedIcon fontSize="small" />,
  search: <SearchOutlinedIcon fontSize="small" />,
  cart: <ShoppingCartOutlinedIcon fontSize="small" />,
  checkout: <CreditCardOutlinedIcon fontSize="small" />,
  account: <PersonOutlineOutlinedIcon fontSize="small" />,
  orders: <Inventory2OutlinedIcon fontSize="small" />,
  wishlist: <FavoriteBorderOutlinedIcon fontSize="small" />,
  brand: <LocalOfferOutlinedIcon fontSize="small" />,
  blog: <ArticleOutlinedIcon fontSize="small" />,
  'not-found': <ErrorOutlineIcon fontSize="small" />,
};

const COMPONENT_EDITOR_BY_KEY = {
  designTokens: DesignTokensEditor,
  productCard: ProductCardStyleEditor,
  categoryCard: CategoryCardStyleEditor,
  promoCard: PromoCardStyleEditor,
  brandCard: BrandCardStyleEditor,
  trustCard: TrustCardStyleEditor,
  headerLayout: HeaderStyleEditor,
  announcementBar: HeaderStyleEditor,
  headerLogo: HeaderStyleEditor,
  headerMenu: HeaderStyleEditor,
  headerActions: HeaderStyleEditor,
  footer: FooterStyleEditor,
  cartItem: CartItemStyleEditor,
  checkoutBlock: CheckoutBlockStyleEditor,
  formControl: FormControlStyleEditor,
  badgeChip: BadgeChipStyleEditor,
  customCss: CustomCssEditor,
};

// The registry owns labels, routes, statuses, and permissions. This page
// only attaches the existing preview icons and editor components.
const DESIGNER_PAGES = DESIGN_PAGE_REGISTRY.map((page) => ({
  ...page,
  value: page.key,
  icon: PAGE_ICON_BY_KEY[page.key],
}));

const DESIGNER_COMPONENTS = DESIGN_COMPONENT_REGISTRY.map((component) => ({
  ...component,
  value: component.key,
  Editor: COMPONENT_EDITOR_BY_KEY[component.key],
}));

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

const DESIGNER_PAGE_GROUP_MAP = {
  product: 'productPage',
  category: 'categoryPage',
  collection: 'catalog',
  blog: 'blogPage',
  brand: 'brandsPage',
  account: 'accountPage',
  cart: 'cartPage',
  checkout: 'checkoutPage',
  wishlist: 'wishlistPage',
  search: 'searchPage',
  'not-found': 'notFoundPage',
  orders: 'ordersPage',
};

const SectionComposerPage = () => {
  const [searchParams] = useSearchParams();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftDeletes, setDraftDeletes] = useState([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [designVersions, setDesignVersions] = useState([]);
  const [pendingVersion, setPendingVersion] = useState(null);
  const [restoringVersionId, setRestoringVersionId] = useState(null);
  const draftHydratedRef = useRef(false);
  
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
  const [designSources, setDesignSources] = useState({});
  const [designDefaults, setDesignDefaults] = useState({});
  const [resettingDesign, setResettingDesign] = useState(false);
  
  // Unified page style settings state
  const [pageSettings, setPageSettings] = useState({});

  // History state for Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Viewport mode state for live preview
  const [viewportMode, setViewportMode] = useState('desktop');
  // The editor canvas is the primary selection surface. The live route remains
  // available as a read-only verification view.
  const [previewRenderMode, setPreviewRenderMode] = useState('mock');
  const [activePage, setActivePage] = useState('home');
  const [pagePickerAnchor, setPagePickerAnchor] = useState(null);
  const [pageSearch, setPageSearch] = useState('');

  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const canManageAdvancedSettings = hasPermission(PERMISSIONS.SETTINGS_ADVANCED);
  const { settings, refreshSettings } = useContext(SettingsContext) || {};

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
    if (draftHydratedRef.current) return;
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

  // Compatibility links from System Settings can open the relevant page or
  // inspector without creating a second editor surface.
  useEffect(() => {
    const requestedPage = searchParams.get('page');
    const requestedComponent = searchParams.get('component');
    if (requestedPage && DESIGNER_PAGES.some((page) => page.value === requestedPage && page.status === 'active')) {
      setActivePage(requestedPage);
    }
    if (requestedComponent && DESIGNER_COMPONENTS.some((component) => (
      component.value === requestedComponent
      && (!component.requiresAdvanced || canManageAdvancedSettings)
    ))) {
      setPanelView({ mode: 'theme-settings', sectionId: null, componentKey: requestedComponent, blockKey: null, blockIndex: null });
    }
  }, [searchParams, canManageAdvancedSettings]);

  const applyDraftPayload = useCallback((payload = [], baseGroups = {}, defaults = {}) => {
    const grouped = payload.reduce((result, entry) => {
      if (!entry?.group || !entry?.key) return result;
      if (entry.operation === 'delete') return result;
      if (!result[entry.group]) result[entry.group] = {};
      result[entry.group][entry.key] = entry.value;
      return result;
    }, {});

    const resetTargets = payload
      .filter((entry) => entry?.operation === 'delete')
      .map(({ group, key }) => ({ group, key }));
    const mergeGroup = (group) => {
      const next = { ...(baseGroups[group] || {}) };
      const defaultGroup = defaults[group] || {};
      resetTargets
        .filter((target) => target.group === group)
        .forEach(({ key }) => {
          if (key === null) {
            Object.keys(next).forEach((existingKey) => delete next[existingKey]);
            Object.assign(next, defaultGroup);
          } else if (Object.prototype.hasOwnProperty.call(defaultGroup, key)) next[key] = defaultGroup[key];
          else delete next[key];
        });
      Object.assign(next, grouped[group] || {});
      return next;
    };

    const merged = {};
    [...new Set([
      ...Object.keys(baseGroups || {}),
      ...Object.keys(grouped),
      ...resetTargets.map((target) => target.group),
    ])].forEach((group) => {
      merged[group] = mergeGroup(group);
    });

    if (merged.theme) setThemeSettings(merged.theme);
    if (merged.componentStyles) setComponentStyles(merged.componentStyles);
    if (merged.nav) setNavSettings(merged.nav);
    if (merged.footer) setFooterSettings(merged.footer);
    if (merged.announcement) setAnnouncementSettings(merged.announcement);
    if (merged.advanced) setAdvancedSettings({ customCSS: merged.advanced.customCSS || '' });

    const nextPages = Object.entries(DESIGNER_PAGE_GROUP_MAP).reduce((result, [page, group]) => {
      if (merged[group]) result[page] = merged[group];
      return result;
    }, {});
    if (Object.keys(nextPages).length) setPageSettings(nextPages);
    if (merged.homepage?.sections) setSections(merged.homepage.sections);
    return { groups: merged, resetTargets };
  }, []);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    try {
      const [homepage, draftState, designState] = await Promise.all([
        getSettingsGroup('homepage'),
        getDesignDraft().catch(() => ({ draft: null })),
        getDesignState().catch(() => ({ groups: {}, sources: {}, defaults: {} })),
      ]);
      setDesignSources(designState?.sources || {});
      setDesignDefaults(designState?.defaults || {});
      const existingDraft = draftState?.draft || null;
      const draftResult = existingDraft
        ? applyDraftPayload(existingDraft.payload || [], designState?.groups || {}, designState?.defaults || {})
        : null;
      const initialSections = draftResult?.groups?.homepage?.sections || homepage?.sections || [];
      if (existingDraft) {
        draftHydratedRef.current = true;
        setDraft(existingDraft);
        setDraftDeletes(draftResult?.resetTargets || []);
      } else {
        setDraftDeletes([]);
      }
      setSections(initialSections);
      setHistory([initialSections]);
      setHistoryIndex(0);
    } catch {
      notify('Failed to load homepage sections', 'error');
    } finally {
      setLoading(false);
    }
  }, [applyDraftPayload, notify]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const clearDraftDelete = (group, key = null) => {
    setDraftDeletes((current) => current.filter((target) => (
      target.group !== group || (key !== null && target.key !== null && target.key !== key)
    )));
  };

  const buildDraftPayload = (basePayload) => {
    const groupResets = new Set(draftDeletes.filter((target) => target.key === null).map((target) => target.group));
    const keyResets = new Set(draftDeletes.filter((target) => target.key !== null).map((target) => `${target.group}.${target.key}`));
    const deleteKeys = new Set();
    const writes = basePayload.filter((entry) => {
      const targetKey = `${entry.group}.${entry.key}`;
      const shouldDelete = groupResets.has(entry.group) || keyResets.has(targetKey);
      if (shouldDelete) deleteKeys.add(targetKey);
      return !shouldDelete;
    });

    draftDeletes.forEach(({ group, key }) => {
      if (key !== null) deleteKeys.add(`${group}.${key}`);
    });
    Object.entries(designSources || {}).forEach(([group, sources]) => {
      if (!groupResets.has(group)) return;
      Object.entries(sources || {})
        .filter(([, source]) => source === 'custom')
        .forEach(([key]) => deleteKeys.add(`${group}.${key}`));
    });

    const deletes = [...deleteKeys].map((target) => {
      const separator = target.indexOf('.');
      return {
        group: target.slice(0, separator),
        key: target.slice(separator + 1),
        operation: 'delete',
      };
    });
    return [...writes, ...deletes];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Map unified pageSettings back to their API groups
      const pageEntries = Object.entries(pageSettings || {}).flatMap(([pg, vals]) =>
        Object.entries(vals || {}).map(([key, value]) => ({ key, value, group: DESIGNER_PAGE_GROUP_MAP[pg] || pg }))
      );
      const payload = buildDraftPayload([
        { key: 'sections', value: sections, group: 'homepage' },
        ...Object.entries(themeSettings || {}).map(([key, value]) => ({ key, value, group: 'theme' })),
        ...Object.entries(componentStyles || {}).map(([key, value]) => ({ key, value, group: 'componentStyles' })),
        ...Object.entries(navSettings || {}).map(([key, value]) => ({ key, value, group: 'nav' })),
        ...Object.entries(footerSettings || {}).map(([key, value]) => ({ key, value, group: 'footer' })),
        ...Object.entries(announcementSettings || {}).map(([key, value]) => ({ key, value, group: 'announcement' })),
        ...(canManageAdvancedSettings ? Object.entries(advancedSettings || {}).map(([key, value]) => ({ key, value, group: 'advanced' })) : []),
        ...pageEntries,
      ]);
      const savedDraft = await saveDesignDraft(payload, draft?.revision);
      setDraft(savedDraft);
      setDraftDeletes((savedDraft?.payload || []).filter((entry) => entry.operation === 'delete').map(({ group, key }) => ({ group, key })));
      notify('Design draft saved. Publish it when the storefront is ready.', 'success');
      setDirty(false);
      // Reset history baseline to current state
      setHistory([sections]);
      setHistoryIndex(0);
    } catch (error) {
      notify(error.response?.data?.error?.message || 'Failed to save design draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openVersionHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const result = await getDesignVersions(30);
      setDesignVersions(result?.versions || []);
    } catch (error) {
      notify(error.response?.data?.error?.message || 'Failed to load published design history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const requestVersionRestore = (version) => {
    setHistoryOpen(false);
    setPendingVersion(version);
  };

  const handleRestoreVersion = async () => {
    if (!pendingVersion) return;
    setRestoringVersionId(pendingVersion.id);
    try {
      const restored = await restoreDesignVersion(pendingVersion.id, draft?.revision);
      const designState = await getDesignState().catch(() => ({
        groups: settings || {},
        sources: designSources,
        defaults: designDefaults,
      }));
      const draftResult = applyDraftPayload(
        restored?.draft?.payload || [],
        designState?.groups || {},
        designState?.defaults || {},
      );
      setDesignSources(designState?.sources || {});
      setDesignDefaults(designState?.defaults || {});
      setDraft(restored?.draft || null);
      setDraftDeletes(draftResult.resetTargets || []);
      draftHydratedRef.current = true;
      const nextSections = draftResult.groups?.homepage?.sections || [];
      setHistory([nextSections]);
      setHistoryIndex(0);
      setDirty(false);
      setPendingVersion(null);
      notify(`Version ${pendingVersion.revision} restored into the design draft. Review it, then publish when ready.`, 'success');
    } catch (error) {
      notify(error.response?.data?.error?.message || 'Failed to restore published design version', 'error');
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handlePublish = async () => {
    if (!draft || dirty) return;
    setPublishing(true);
    try {
      await publishDesignDraft(draft.revision);
      draftHydratedRef.current = false;
      setDraft(null);
      setDraftDeletes([]);
      if (refreshSettings) await refreshSettings();
      const state = await getDesignState();
      setDesignSources(state?.sources || {});
      setDesignDefaults(state?.defaults || {});
      notify('Design draft published to the storefront.', 'success');
      setPublishOpen(false);
    } catch (error) {
      notify(error.response?.data?.error?.message || 'Publish failed. Review the latest design changes and try again.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const update = (next, skipHistory = false) => {
    setSections(next);
    clearDraftDelete('homepage');
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
    clearDraftDelete(DESIGNER_PAGE_GROUP_MAP[page] || page);
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
    clearDraftDelete('componentStyles', componentName);
    setComponentStyles((current) => ({
      ...(current || {}),
      [componentName]: nextValue,
    }));
    setDirty(true);
  };

  const handleResetDesign = (componentKey) => {
    const target = getDesignResetTarget(componentKey);
    if (!target) return;
    const defaults = designDefaults[target.group] || {};
    if (target.group === 'theme') setThemeSettings({ ...defaults });
    else if (target.group === 'nav') setNavSettings({ ...defaults });
    else if (target.group === 'footer') setFooterSettings({ ...defaults });
    else if (target.group === 'announcement') setAnnouncementSettings({ ...defaults });
    else if (target.group === 'advanced') setAdvancedSettings({ customCSS: defaults.customCSS || '' });
    else if (target.key) {
      setComponentStyles((current) => {
        const next = { ...(current || {}) };
        if (Object.prototype.hasOwnProperty.call(defaults, target.key)) next[target.key] = defaults[target.key];
        else delete next[target.key];
        return next;
      });
    }
    setDraftDeletes((current) => {
      const next = current.filter((entry) => entry.group !== target.group || entry.key !== target.key);
      return [...next, { group: target.group, key: target.key || null }];
    });
    setDirty(true);
    notify('Reset staged in the design draft. Publish to make it live.', 'success');
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
  const activeResetTarget = getDesignResetTarget(activeComponent);
  const activeDraftDelete = activeResetTarget && draftDeletes.some((entry) => (
    entry.group === activeResetTarget.group && (entry.key === null || entry.key === activeResetTarget.key)
  ));
  const activeDraftTouch = activeResetTarget && draft?.payload?.some((entry) => (
    entry.group === activeResetTarget.group && (!activeResetTarget.key || entry.key === activeResetTarget.key)
  ));
  const activeComponentSource = activeDraftDelete
    ? 'default'
    : activeDraftTouch
      ? 'draft'
      : getDesignSource(activeComponent, designSources);

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
            <Chip
              label={dirty ? 'Unsaved changes' : draft ? 'Draft saved' : 'Live'}
              size="small"
              color={dirty ? 'warning' : draft ? 'info' : 'success'}
              variant={dirty ? 'outlined' : 'filled'}
              sx={{ height: 22, fontWeight: 700 }}
            />
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
            <Button size="small" variant="text" startIcon={<HistoryIcon />} onClick={openVersionHistory} disabled={saving || publishing}>
              History
            </Button>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => openAddSection(sections.length, 'template')}>Add Section</Button>
            <Button size="small" variant="outlined" startIcon={<SaveIcon />} onClick={handleSave} disabled={!dirty || saving || publishing}>
              {saving ? 'Saving...' : 'Save draft'}
            </Button>
            <Button size="small" variant="contained" onClick={() => setPublishOpen(true)} disabled={!draft || dirty || saving || publishing}>
              Publish
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
              designSource={activeComponentSource}
              onReset={handleResetDesign}
              resetting={resettingDesign}
              onThemeSettingsChange={(value) => {
                clearDraftDelete('theme');
                setThemeSettings(value);
                setDirty(true);
              }}
              onComponentStyleChange={handleComponentStyleChange}
              onNavChange={(value) => {
                clearDraftDelete('nav');
                setNavSettings(value);
                setDirty(true);
              }}
              onAnnouncementChange={(value) => {
                clearDraftDelete('announcement');
                setAnnouncementSettings(value);
                setDirty(true);
              }}
              onFooterChange={(value) => {
                clearDraftDelete('footer');
                setFooterSettings(value);
                setDirty(true);
              }}
              onAdvancedChange={(value) => {
                clearDraftDelete('advanced', 'customCSS');
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
                <ToggleButton value="mock" aria-label="Interactive editor preview">Editor Preview</ToggleButton>
                <ToggleButton value="live" aria-label="Read-only live storefront preview">Live Storefront</ToggleButton>
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

          <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            {previewRenderMode === 'live' ? (
              <Alert
                severity="info"
                variant="outlined"
                action={(
                  <Button size="small" onClick={() => setPreviewRenderMode('mock')} sx={{ whiteSpace: 'nowrap' }}>
                    Open editor
                  </Button>
                )}
                sx={{ py: 0, alignItems: 'center', '& .MuiAlert-message': { py: 0.5, fontSize: '0.78rem' } }}
              >
                Live Storefront is read-only. Switch to Editor Preview to select sections and components.
              </Alert>
            ) : (
              <Alert
                severity="success"
                variant="outlined"
                sx={{ py: 0, alignItems: 'center', '& .MuiAlert-message': { py: 0.5, fontSize: '0.78rem' } }}
              >
                Select a section, header item, card, or footer in the preview to edit it. Changes stay in this draft until you save.
              </Alert>
            )}
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

      <DesignVersionHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        versions={designVersions}
        loading={historyLoading}
        restoringId={restoringVersionId}
        onRestore={requestVersionRestore}
      />

      <Dialog
        open={Boolean(pendingVersion)}
        onClose={() => !restoringVersionId && setPendingVersion(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Restore version {pendingVersion?.revision}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This replaces the current saved draft with the published version. It does not change the live storefront. Any unsaved editor changes will be discarded.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingVersion(null)} disabled={Boolean(restoringVersionId)}>Cancel</Button>
          <Button variant="contained" onClick={handleRestoreVersion} disabled={Boolean(restoringVersionId)}>
            {restoringVersionId ? 'Restoring...' : 'Restore to draft'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={publishOpen} onClose={() => !publishing && setPublishOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Publish design draft?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will make the saved draft live across the storefront. The server will stop the publish if the live design changed since this draft was started.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishOpen(false)} disabled={publishing}>Cancel</Button>
          <Button variant="contained" onClick={handlePublish} disabled={publishing}>
            {publishing ? 'Publishing...' : 'Publish design'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default SectionComposerPage;
