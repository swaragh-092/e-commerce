import {
  Box, Stack, Typography, IconButton, Button, Divider, Alert,
  TextField, Switch, FormControlLabel,
} from '@mui/material';
import { Link } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaletteIcon from '@mui/icons-material/Palette';
import GridViewIcon from '@mui/icons-material/GridView';
import NavigationIcon from '@mui/icons-material/Navigation';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CodeIcon from '@mui/icons-material/Code';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PaymentIcon from '@mui/icons-material/Payment';
import BadgeIcon from '@mui/icons-material/Badge';
import InputIcon from '@mui/icons-material/Input';
import LoyaltyIcon from '@mui/icons-material/Loyalty';
import {
  ProductCardStyleEditor,
  CategoryCardStyleEditor,
  PromoCardStyleEditor,
  BrandCardStyleEditor,
  TrustCardStyleEditor,
  FooterStyleEditor,
  CartItemStyleEditor,
  CheckoutBlockStyleEditor,
  FormControlStyleEditor,
  BadgeChipStyleEditor,
} from '../../settings/CardStyleEditors';
import CssVarsPanel from '../../settings/CssVarsPanel';
import { DesignTokensEditor } from '../DesignTokensEditor';
import CustomCssEditor from '../../settings/CustomCssEditor';


const splitMenuItems = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .join(', ');

const PanelField = ({ label, value, onChange, helperText, placeholder, type = 'text' }) => (
  <TextField
    fullWidth
    size="small"
    type={type}
    label={label}
    value={value || ''}
    onChange={(event) => onChange(event.target.value)}
    helperText={helperText}
    placeholder={placeholder}
    InputLabelProps={type === 'color' ? { shrink: true } : undefined}
  />
);

const HeaderLayoutEditor = ({ value = {}, onChange }) => {
  const patch = (key, next) => onChange({ ...(value || {}), [key]: next });
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" fontWeight={900}>Header Layout</Typography>
      <FormControlLabel control={<Switch size="small" checked={value.sticky !== false} onChange={(e) => patch('sticky', e.target.checked)} />} label="Sticky header" />
      <FormControlLabel control={<Switch size="small" checked={value.showCategoryBar === true} onChange={(e) => patch('showCategoryBar', e.target.checked)} />} label="Show category bar below menu" />
      <PanelField label="Header background" type="color" value={value.bgColor || '#0f766e'} onChange={(v) => patch('bgColor', v)} />
      <PanelField label="Header text color" type="color" value={value.fgColor || '#ffffff'} onChange={(v) => patch('fgColor', v)} />
    </Stack>
  );
};

const HeaderLogoEditor = ({ value = {}, onChange }) => {
  const patch = (key, next) => onChange({ ...(value || {}), [key]: next });
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" fontWeight={900}>Logo</Typography>
      <PanelField label="Store name override" value={value.logoText || ''} placeholder="Uses store name when empty" onChange={(v) => patch('logoText', v)} />
      <PanelField label="Logo image URL" value={value.logoUrl || ''} placeholder="Optional logo image URL" onChange={(v) => patch('logoUrl', v)} />
      <FormControlLabel control={<Switch size="small" checked={value.showStoreName !== false} onChange={(e) => patch('showStoreName', e.target.checked)} />} label="Show store name text" />
      <PanelField label="Logo max width" value={value.logoMaxWidth || ''} placeholder="120px" onChange={(v) => patch('logoMaxWidth', v)} />
    </Stack>
  );
};

const HeaderMenuEditor = ({ value = {}, onChange }) => {
  const patch = (key, next) => onChange({ ...(value || {}), [key]: next });
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" fontWeight={900}>Menu</Typography>
      <Alert severity="info" action={<Button component={Link} to="/admin/menus" size="small" color="inherit">Open</Button>}>
        Published header links come from Menu Builder. These fallback labels are used only when no header menu or top pages exist.
      </Alert>
      <PanelField label="Fallback menu labels" value={splitMenuItems(value.menuItems)} helperText="Comma separated fallback labels for empty stores." placeholder="Shop, Collections, Contact" onChange={(v) => patch('menuItems', v)} />
      <FormControlLabel control={<Switch size="small" checked={value.showMenu !== false} onChange={(e) => patch('showMenu', e.target.checked)} />} label="Show menu links" />
      <FormControlLabel control={<Switch size="small" checked={value.showCategoryBar === true} onChange={(e) => patch('showCategoryBar', e.target.checked)} />} label="Show category bar" />
    </Stack>
  );
};

const HeaderActionsEditor = ({ value = {}, onChange }) => {
  const patch = (key, next) => onChange({ ...(value || {}), [key]: next });
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" fontWeight={900}>Right Actions</Typography>
      <FormControlLabel control={<Switch size="small" checked={value.showSearch !== false} onChange={(e) => patch('showSearch', e.target.checked)} />} label="Show search" />
      <FormControlLabel control={<Switch size="small" checked={value.showAccount !== false} onChange={(e) => patch('showAccount', e.target.checked)} />} label="Show account" />
      <FormControlLabel control={<Switch size="small" checked={value.showCart !== false} onChange={(e) => patch('showCart', e.target.checked)} />} label="Show cart" />
      <FormControlLabel control={<Switch size="small" checked={value.showWishlist === true} onChange={(e) => patch('showWishlist', e.target.checked)} />} label="Show wishlist" />
    </Stack>
  );
};

const AnnouncementBarEditor = ({ value = {}, onChange }) => {
  const patch = (key, next) => onChange({ ...(value || {}), [key]: next });
  const enabled = value.enabled === true || value.enabled === 'true';
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" fontWeight={900}>Announcement Bar</Typography>
      <FormControlLabel control={<Switch size="small" checked={enabled} onChange={(e) => patch('enabled', e.target.checked)} />} label="Show announcement bar" />
      {enabled && (
        <>
          <PanelField label="Message text" value={value.text || ''} helperText={`${(value.text || '').length}/200`} onChange={(v) => patch('text', v.slice(0, 200))} />
          <PanelField label="Link URL" value={value.link || ''} placeholder="/products" onChange={(v) => patch('link', v)} />
          <PanelField label="Background color" type="color" value={value.bgColor || '#0f766e'} onChange={(v) => patch('bgColor', v)} />
          <PanelField label="Text color" type="color" value={value.fgColor || '#ffffff'} onChange={(v) => patch('fgColor', v)} />
          <FormControlLabel control={<Switch size="small" checked={value.dismissible !== false} onChange={(e) => patch('dismissible', e.target.checked)} />} label="Show dismiss button" />
        </>
      )}
    </Stack>
  );
};

// Groups of DESIGNER_COMPONENTS with icons and section labels
const COMPONENT_GROUPS = [
  {
    label: 'Global Tokens',
    items: [
      { value: 'designTokens', label: 'Design Tokens', icon: <PaletteIcon sx={{ fontSize: 16 }} />, Editor: DesignTokensEditor },
    ],
  },
  {
    label: 'Cards & Product',
    items: [
      { value: 'productCard',  label: 'Product Card',   icon: <LoyaltyIcon sx={{ fontSize: 16 }} />,    Editor: ProductCardStyleEditor },
      { value: 'categoryCard', label: 'Category Card',  icon: <GridViewIcon sx={{ fontSize: 16 }} />,    Editor: CategoryCardStyleEditor },
      { value: 'promoCard',    label: 'Promo Banner',   icon: <StorefrontIcon sx={{ fontSize: 16 }} />,  Editor: PromoCardStyleEditor },
      { value: 'brandCard',    label: 'Brand Card',     icon: <BadgeIcon sx={{ fontSize: 16 }} />,       Editor: BrandCardStyleEditor },
      { value: 'trustCard',    label: 'Trust Item',     icon: <BadgeIcon sx={{ fontSize: 16 }} />,       Editor: TrustCardStyleEditor },
    ],
  },
  {
    label: 'Site Structure',
    items: [
      { value: 'headerLayout', label: 'Header Layout', icon: <NavigationIcon sx={{ fontSize: 16 }} />, Editor: HeaderLayoutEditor },
      { value: 'announcementBar', label: 'Announcement Bar', icon: <BadgeIcon sx={{ fontSize: 16 }} />, Editor: AnnouncementBarEditor },
      { value: 'headerLogo', label: 'Logo', icon: <StorefrontIcon sx={{ fontSize: 16 }} />, Editor: HeaderLogoEditor },
      { value: 'headerMenu', label: 'Menu', icon: <GridViewIcon sx={{ fontSize: 16 }} />, Editor: HeaderMenuEditor },
      { value: 'headerActions', label: 'Search, Account & Cart', icon: <ShoppingCartIcon sx={{ fontSize: 16 }} />, Editor: HeaderActionsEditor },
      { value: 'footer', label: 'Footer Settings',     icon: <StorefrontIcon sx={{ fontSize: 16 }} />, Editor: FooterStyleEditor },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { value: 'cartItem',      label: 'Cart Item Row',    icon: <ShoppingCartIcon sx={{ fontSize: 16 }} />, Editor: CartItemStyleEditor },
      { value: 'checkoutBlock', label: 'Checkout Blocks',  icon: <PaymentIcon sx={{ fontSize: 16 }} />,      Editor: CheckoutBlockStyleEditor },
      { value: 'formControl',   label: 'Forms & Inputs',   icon: <InputIcon sx={{ fontSize: 16 }} />,        Editor: FormControlStyleEditor },
      { value: 'badgeChip',     label: 'Badges & Chips',   icon: <BadgeIcon sx={{ fontSize: 16 }} />,        Editor: BadgeChipStyleEditor },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { value: 'customCss', label: 'Custom CSS', icon: <CodeIcon sx={{ fontSize: 16 }} />, Editor: CustomCssEditor, requiresAdvanced: true },
    ],
  },
];

// Flatten for lookup
const ALL_COMPONENTS = COMPONENT_GROUPS.flatMap((g) => g.items);

const ComponentRow = ({ item, isSelected, onClick }) => (
  <Box
    onClick={() => onClick(item)}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 1.5,
      py: 0.875,
      borderRadius: 1.5,
      cursor: 'pointer',
      bgcolor: isSelected ? 'primary.50' : 'transparent',
      border: '1px solid',
      borderColor: isSelected ? 'primary.main' : 'transparent',
      transition: 'all 0.15s',
      '&:hover': {
        bgcolor: isSelected ? 'primary.50' : 'action.hover',
        borderColor: isSelected ? 'primary.main' : 'divider',
      },
    }}
  >
    <Box sx={{ color: isSelected ? 'primary.main' : 'text.secondary' }}>{item.icon}</Box>
    <Typography variant="body2" fontWeight={isSelected ? 800 : 600} sx={{ fontSize: '0.83rem', flex: 1 }}>
      {item.label}
    </Typography>
    {item.requiresAdvanced && (
      <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.68rem', fontWeight: 700 }}>ADV</Typography>
    )}
  </Box>
);

const DesignerThemePanel = ({
  activeComponent,
  onComponentSelect,
  onBack,
  // Value getters
  themeSettings,
  componentStyles,
  navSettings,
  announcementSettings,
  footerSettings,
  advancedSettings,
  // Change handlers
  onThemeSettingsChange,
  onComponentStyleChange,
  onNavChange,
  onAnnouncementChange,
  onFooterChange,
  onAdvancedChange,
  canManageAdvancedSettings,
}) => {
  const activeItem = ALL_COMPONENTS.find((c) => c.value === activeComponent) || ALL_COMPONENTS[0];
  const ActiveEditor = activeItem?.Editor;

  // Compute the "value" for the active editor
  const activeValue = (() => {
    if (activeComponent === 'designTokens') return themeSettings;
    if (['headerLayout', 'headerLogo', 'headerMenu', 'headerActions'].includes(activeComponent)) return navSettings;
    if (activeComponent === 'announcementBar') return announcementSettings;
    if (activeComponent === 'footer') return footerSettings;
    if (activeComponent === 'customCss') return advancedSettings;
    return componentStyles?.[activeComponent];
  })();

  const handleValueChange = (nextValue) => {
    if (activeComponent === 'designTokens') onThemeSettingsChange(nextValue);
    else if (['headerLayout', 'headerLogo', 'headerMenu', 'headerActions'].includes(activeComponent)) onNavChange(nextValue);
    else if (activeComponent === 'announcementBar') onAnnouncementChange(nextValue);
    else if (activeComponent === 'footer') onFooterChange(nextValue);
    else if (activeComponent === 'customCss') {
      if (!canManageAdvancedSettings) return;
      onAdvancedChange(nextValue);
    } else {
      onComponentStyleChange(activeComponent, nextValue);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Panel header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <IconButton size="small" onClick={onBack}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.88rem' }}>Theme Settings</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            Global styles applied to every storefront page.
          </Typography>
        </Box>
      </Box>

      {activeComponent ? (
        // Inspector sub-view — showing a specific component editor
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ color: 'primary.main' }}>{activeItem.icon}</Box>
            <Typography variant="body2" fontWeight={700} sx={{ flex: 1, fontSize: '0.82rem' }}>{activeItem.label}</Typography>
            <Button size="small" variant="text" onClick={() => onComponentSelect(null)}
              sx={{ fontSize: '0.72rem', minWidth: 0, px: 1 }}>
              ← All
            </Button>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {activeItem.requiresAdvanced && !canManageAdvancedSettings && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Advanced settings permission required.
              </Alert>
            )}
            {ActiveEditor && (
              <ActiveEditor
                value={activeValue}
                onChange={handleValueChange}
                disabled={activeItem.requiresAdvanced && !canManageAdvancedSettings}
                isSidebar={true}
              />
            )}
          </Box>
        </Box>
      ) : (
        // Component list view
        <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
          {COMPONENT_GROUPS.map((group) => (
            <Box key={group.label} sx={{ mb: 0.5 }}>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ px: 2, py: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.65rem', fontWeight: 800 }}
              >
                {group.label}
              </Typography>
              <Stack spacing={0.25} sx={{ px: 1 }}>
                {group.items.map((item) => (
                  <ComponentRow
                    key={item.value}
                    item={item}
                    isSelected={activeComponent === item.value}
                    onClick={(i) => onComponentSelect(i.value)}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default DesignerThemePanel;
