import { useState } from 'react';
import {
  Box, Stack, Typography, IconButton, Button, Alert, Chip,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Switch, FormControlLabel,
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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
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
import { DesignTokensEditor } from '../DesignTokensEditor';
import CustomCssEditor from '../../settings/CustomCssEditor';
import { DESIGN_COMPONENT_GROUPS, getDesignComponentControlSchema, getDesignComponentsForGroup } from '../../../../utils/designRegistry';
import { DesignSchemaFields } from './DesignSchemaFields';


const HeaderLayoutEditor = ({ value = {}, onChange }) => (
  <DesignSchemaFields
    schema={getDesignComponentControlSchema('headerLayout')}
    value={value}
    onChange={onChange}
  />
);

const HeaderLogoEditor = ({ value = {}, onChange }) => (
  <DesignSchemaFields
    schema={getDesignComponentControlSchema('headerLogo')}
    value={value}
    onChange={onChange}
  />
);

const HeaderMenuEditor = ({ value = {}, onChange }) => {
  return (
    <Stack spacing={2}>
      <Alert severity="info" action={<Button component={Link} to="/admin/menus" size="small" color="inherit">Open</Button>}>
        Published header links come from Menu Builder. These fallback labels are used only when no header menu or top pages exist.
      </Alert>
      <DesignSchemaFields
        schema={getDesignComponentControlSchema('headerMenu')}
        value={value}
        onChange={onChange}
      />
    </Stack>
  );
};

const DEFAULT_ACTIONS_ORDER = ['search', 'cart', 'wishlist', 'account'];

const ACTION_META = {
  search:   { field: 'showSearch',   label: 'Show search',   isChecked: (v) => v.showSearch !== false },
  cart:     { field: 'showCart',     label: 'Show cart',     isChecked: (v) => v.showCart !== false },
  wishlist: { field: 'showWishlist', label: 'Show wishlist', isChecked: (v) => v.showWishlist === true },
  account:  { field: 'showAccount',  label: 'Show account',  isChecked: (v) => v.showAccount !== false },
};

const HeaderActionsEditor = ({ value = {}, onChange }) => {
  const patch = (key, next) => onChange({ ...(value || {}), [key]: next });

  const order = Array.isArray(value.actionsOrder) && value.actionsOrder.length
    ? [...new Set([...value.actionsOrder, ...DEFAULT_ACTIONS_ORDER])].filter((key) => ACTION_META[key])
    : DEFAULT_ACTIONS_ORDER;

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const next = Array.from(order);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    patch('actionsOrder', next);
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" fontWeight={900}>Right Actions</Typography>
      <Typography variant="caption" color="text.secondary">Drag to reorder how these appear in the header.</Typography>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="header-actions-order">
          {(droppableProvided) => (
            <Stack spacing={0.75} ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
              {order.map((actionKey, index) => {
                const meta = ACTION_META[actionKey];
                return (
                  <Draggable key={actionKey} draggableId={actionKey} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <Box
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          pr: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          bgcolor: dragSnapshot.isDragging ? 'action.hover' : 'transparent',
                        }}
                      >
                        <Box {...dragProvided.dragHandleProps} sx={{ display: 'flex', alignItems: 'center', color: 'text.disabled', cursor: 'grab', px: 0.75 }}>
                          <DragIndicatorIcon fontSize="small" />
                        </Box>
                        <FormControlLabel
                          sx={{ flex: 1, m: 0, py: 0.5 }}
                          control={<Switch size="small" checked={meta.isChecked(value)} onChange={(e) => patch(meta.field, e.target.checked)} />}
                          label={meta.label}
                        />
                      </Box>
                    )}
                  </Draggable>
                );
              })}
              {droppableProvided.placeholder}
            </Stack>
          )}
        </Droppable>
      </DragDropContext>
    </Stack>
  );
};

const AnnouncementBarEditor = ({ value = {}, onChange }) => (
  <DesignSchemaFields
    schema={getDesignComponentControlSchema('announcementBar')}
    value={value}
    onChange={onChange}
  />
);

const COMPONENT_ICON_BY_KEY = {
  designTokens: <PaletteIcon sx={{ fontSize: 16 }} />,
  productCard: <LoyaltyIcon sx={{ fontSize: 16 }} />,
  categoryCard: <GridViewIcon sx={{ fontSize: 16 }} />,
  promoCard: <StorefrontIcon sx={{ fontSize: 16 }} />,
  brandCard: <BadgeIcon sx={{ fontSize: 16 }} />,
  trustCard: <BadgeIcon sx={{ fontSize: 16 }} />,
  headerLayout: <NavigationIcon sx={{ fontSize: 16 }} />,
  announcementBar: <BadgeIcon sx={{ fontSize: 16 }} />,
  headerLogo: <StorefrontIcon sx={{ fontSize: 16 }} />,
  headerMenu: <GridViewIcon sx={{ fontSize: 16 }} />,
  headerActions: <ShoppingCartIcon sx={{ fontSize: 16 }} />,
  footer: <StorefrontIcon sx={{ fontSize: 16 }} />,
  cartItem: <ShoppingCartIcon sx={{ fontSize: 16 }} />,
  checkoutBlock: <PaymentIcon sx={{ fontSize: 16 }} />,
  formControl: <InputIcon sx={{ fontSize: 16 }} />,
  badgeChip: <BadgeIcon sx={{ fontSize: 16 }} />,
  customCss: <CodeIcon sx={{ fontSize: 16 }} />,
};

const COMPONENT_EDITOR_BY_KEY = {
  designTokens: DesignTokensEditor,
  productCard: ProductCardStyleEditor,
  categoryCard: CategoryCardStyleEditor,
  promoCard: PromoCardStyleEditor,
  brandCard: BrandCardStyleEditor,
  trustCard: TrustCardStyleEditor,
  headerLayout: HeaderLayoutEditor,
  announcementBar: AnnouncementBarEditor,
  headerLogo: HeaderLogoEditor,
  headerMenu: HeaderMenuEditor,
  headerActions: HeaderActionsEditor,
  footer: FooterStyleEditor,
  cartItem: CartItemStyleEditor,
  checkoutBlock: CheckoutBlockStyleEditor,
  formControl: FormControlStyleEditor,
  badgeChip: BadgeChipStyleEditor,
  customCss: CustomCssEditor,
};

// The registry owns labels, descriptions, grouping, and permissions. This
// file only binds those definitions to the actual editor and icon components.
const COMPONENT_GROUPS = DESIGN_COMPONENT_GROUPS.map((group) => ({
  ...group,
  items: getDesignComponentsForGroup(group.key).map((item) => ({
    ...item,
    value: item.key,
    icon: COMPONENT_ICON_BY_KEY[item.key],
    Editor: COMPONENT_EDITOR_BY_KEY[item.key],
  })),
}));

// Flatten for lookup
const ALL_COMPONENTS = COMPONENT_GROUPS.flatMap((g) => g.items);

const ComponentRow = ({ item, isSelected, onClick }) => (
  <Box
    onClick={() => onClick(item)}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick(item);
      }
    }}
    title={item.description}
    aria-label={`${item.label}: ${item.description}`}
    role="button"
    tabIndex={0}
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
  designSource,
  onReset,
  resetting,
  // Change handlers
  onThemeSettingsChange,
  onComponentStyleChange,
  onNavChange,
  onAnnouncementChange,
  onFooterChange,
  onAdvancedChange,
  canManageAdvancedSettings,
}) => {
  const [resetOpen, setResetOpen] = useState(false);
  const activeItem = ALL_COMPONENTS.find((c) => c.value === activeComponent) || ALL_COMPONENTS[0];
  const ActiveEditor = activeItem?.Editor;
  const isCustomized = designSource === 'custom';
  const isDraft = designSource === 'draft';

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
          <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.88rem' }}>Design system &amp; components</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            Select an item in the editor preview for contextual controls, or use the library below.
          </Typography>
        </Box>
      </Box>

      {activeComponent ? (
        // Inspector sub-view — showing a specific component editor
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, rowGap: 0.5, px: 1.5, py: 0.75, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ color: 'primary.main' }}>{activeItem.icon}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>{activeItem.label}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem' }}>
                {activeItem.description}
              </Typography>
            </Box>
            <Chip
              label={isDraft ? 'Draft' : isCustomized ? 'Customized' : 'Default'}
              size="small"
              color={isDraft || isCustomized ? 'primary' : 'default'}
              variant={isDraft || isCustomized ? 'filled' : 'outlined'}
              sx={{ height: 22, fontSize: '0.66rem', fontWeight: 700 }}
            />
            <Button
              size="small"
              color="inherit"
              onClick={() => setResetOpen(true)}
              disabled={(!isCustomized && !isDraft) || resetting}
              sx={{ minWidth: 0, px: 0.75, fontSize: '0.7rem', whiteSpace: 'nowrap' }}
            >
              {resetting ? 'Resetting…' : 'Reset'}
            </Button>
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
          <Alert severity="info" variant="outlined" sx={{ mx: 1.5, mb: 1.25, py: 0, '& .MuiAlert-message': { py: 0.6, fontSize: '0.74rem' } }}>
            Start with the preview: click a header, card, or footer item to open only the controls for that item. This library is for global recipes and advanced styles.
          </Alert>
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
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset {activeItem.label}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This stages removal of the saved override for this design scope and restores the store default in the preview. The live storefront changes only after you publish the draft.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setResetOpen(false);
              onReset(activeComponent);
            }}
          >
            Reset to default
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DesignerThemePanel;
