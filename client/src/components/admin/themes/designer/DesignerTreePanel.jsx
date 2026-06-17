import { useState } from 'react';
import {
  Box, Stack, Typography, IconButton, Switch, Button, Chip, Divider,
  Accordion, AccordionSummary, AccordionDetails, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NavigationIcon from '@mui/icons-material/Navigation';
import FootprintIcon from '@mui/icons-material/DirectionsWalk';
import TuneIcon from '@mui/icons-material/Tune';
import CampaignIcon from '@mui/icons-material/Campaign';
import StorefrontIcon from '@mui/icons-material/Storefront';
import MenuIcon from '@mui/icons-material/Menu';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { getSectionLabel } from '../../../storefront/sections/sectionRegistry';
import {
  ProductPageStyleEditor,
  CategoryPageStyleEditor,
  CatalogPageStyleEditor,
  BlogPageStyleEditor,
  BrandsPageStyleEditor,
  AccountPageStyleEditor,
  CartPageStyleEditor,
  CheckoutPageStyleEditor,
  SearchPageStyleEditor,
  NotFoundPageStyleEditor,
  OrdersPageStyleEditor,
} from '../../settings/PageStyleEditors';

// Per-page style editor map (pages that have editable settings)
const PAGE_EDITORS = {
  product:     { Editor: ProductPageStyleEditor,   key: 'product' },
  category:    { Editor: CategoryPageStyleEditor,  key: 'category' },
  collection:  { Editor: CatalogPageStyleEditor,   key: 'collection' },
  blog:        { Editor: BlogPageStyleEditor,      key: 'blog' },
  brand:       { Editor: BrandsPageStyleEditor,    key: 'brand' },
  account:     { Editor: AccountPageStyleEditor,   key: 'account' },
  cart:        { Editor: CartPageStyleEditor,      key: 'cart' },
  checkout:    { Editor: CheckoutPageStyleEditor,  key: 'checkout' },
  search:      { Editor: SearchPageStyleEditor,    key: 'search' },
  'not-found': { Editor: NotFoundPageStyleEditor,  key: 'not-found' },
  orders:      { Editor: OrdersPageStyleEditor,    key: 'orders' },
};

// Pages whose controls are auto-generated (info only)
// Wishlist inherits Product Card styles — no dedicated settings panel yet
const PAGE_INFO = {
  wishlist: 'The Wishlist page inherits Product Card styles. Adjust card appearance under Theme Settings → Product Card.',
};

const AddSectionButton = ({ children = 'Add section', onClick, variant = 'text', compact = false }) => (
  <Button
    size="small"
    variant={variant}
    color="primary"
    startIcon={<AddIcon sx={{ fontSize: compact ? 13 : 14 }} />}
    onClick={onClick}
    fullWidth={variant === 'outlined'}
    sx={{
      justifyContent: compact ? 'center' : 'flex-start',
      minHeight: compact ? 24 : undefined,
      fontSize: compact ? '0.68rem' : '0.75rem',
      py: compact ? 0.15 : 0.55,
      px: compact ? 0.75 : undefined,
      color: variant === 'text' ? 'text.secondary' : undefined,
      textTransform: 'none',
      '&:hover': { color: variant === 'text' ? 'primary.main' : undefined },
    }}
  >
    {children}
  </Button>
);

const InsertSectionControl = ({ label = 'Add section here', onClick }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: 0.75,
      px: 0.5,
      py: 0.15,
    }}
  >
    <Box sx={{ borderTop: '1px dashed', borderColor: 'divider' }} />
    <AddSectionButton compact onClick={onClick}>
      {label}
    </AddSectionButton>
    <Box sx={{ borderTop: '1px dashed', borderColor: 'divider' }} />
  </Box>
);

const SectionRow = ({ section, index, total, isSelected, onSelect, onMove, onToggle, onDelete }) => (
  <Box
    onClick={() => onSelect(section)}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      px: 1,
      py: 0.75,
      borderRadius: 1.5,
      cursor: 'pointer',
      bgcolor: isSelected ? 'primary.50' : 'transparent',
      border: '1px solid',
      borderColor: isSelected ? 'primary.main' : 'transparent',
      opacity: section.enabled === false ? 0.55 : 1,
      transition: 'all 0.15s',
      '&:hover': {
        bgcolor: isSelected ? 'primary.50' : 'action.hover',
        borderColor: isSelected ? 'primary.main' : 'divider',
      },
    }}
  >
    <DragIndicatorIcon sx={{ color: 'text.disabled', fontSize: 16, flexShrink: 0, cursor: 'grab' }} />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" fontWeight={isSelected ? 800 : 600} noWrap sx={{ fontSize: '0.85rem' }}>
        {getSectionLabel(section)}
      </Typography>
      {section.subtitle || section.placement === 'footer' ? (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: '0.7rem' }}>
          {section.placement === 'footer' ? 'Footer · ' : ''}{section.type}
        </Typography>
      ) : null}
    </Box>
    <Tooltip title={section.enabled === false ? 'Enable section' : 'Hide section'}>
      <Switch
        size="small"
        checked={section.enabled !== false}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggle(index)}
        sx={{ mr: -0.5 }}
      />
    </Tooltip>
    <Tooltip title="Move up">
      <span>
        <IconButton size="small" disabled={index === 0}
          onClick={(e) => { e.stopPropagation(); onMove(index, -1); }}>
          <ArrowUpwardIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </span>
    </Tooltip>
    <Tooltip title="Move down">
      <span>
        <IconButton size="small" disabled={index === total - 1}
          onClick={(e) => { e.stopPropagation(); onMove(index, 1); }}>
          <ArrowDownwardIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </span>
    </Tooltip>
    <Tooltip title="Remove section">
      <IconButton size="small" color="error"
        onClick={(e) => { e.stopPropagation(); onDelete(index); }}>
        <DeleteIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Tooltip>
  </Box>
);


const HeaderBlockRow = ({ icon, label, description, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      ml: 2.25,
      px: 1.25,
      py: 0.75,
      borderLeft: '1px solid',
      borderColor: 'divider',
      cursor: 'pointer',
      '&:hover': { bgcolor: 'action.hover' },
    }}
  >
    <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: '0.8rem' }}>{label}</Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: '0.68rem' }}>{description}</Typography>
    </Box>
  </Box>
);

const FixedNode = ({ icon, label, description, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 1.5,
      py: 1,
      borderRadius: 1.5,
      cursor: 'pointer',
      bgcolor: 'action.hover',
      border: '1px solid',
      borderColor: 'divider',
      transition: 'all 0.15s',
      '&:hover': { borderColor: 'text.primary', bgcolor: 'action.selected' },
    }}
  >
    <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>{label}</Typography>
      {description && (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>{description}</Typography>
      )}
    </Box>
    <TuneIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
  </Box>
);

const DesignerTreePanel = ({
  sections,
  activePage,
  pageSettings,
  selectedSectionId,
  onSectionClick,
  onThemeSettingsClick,
  onAddSection,
  onMoveSection,
  onToggleSection,
  onDeleteSection,
  onPageSettingChange,
  onHeaderClick,
  onHeaderPartClick,
  onFooterClick,
}) => {
  const [pageSettingsOpen, setPageSettingsOpen] = useState(true);

  const pageEditorConfig = PAGE_EDITORS[activePage];
  const PageEditor = pageEditorConfig?.Editor;
  const pageInfoText = PAGE_INFO[activePage];
  const currentPageSettings = pageSettings[activePage] || {};
  const isHomePage = activePage === 'home';
  const templateSectionRows = sections
    .map((section, originalIndex) => ({ section, originalIndex }))
    .filter(({ section }) => section.placement !== 'footer');
  const footerSectionRows = sections
    .map((section, originalIndex) => ({ section, originalIndex }))
    .filter(({ section }) => section.placement === 'footer');
  const templateInsertIndex = footerSectionRows.length > 0 ? footerSectionRows[0].originalIndex : sections.length;
  const footerStartIndex = footerSectionRows.length > 0 ? footerSectionRows[0].originalIndex : sections.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Panel Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.85rem' }}>
          {isHomePage ? 'Sections' : `${activePage.charAt(0).toUpperCase() + activePage.slice(1)} Page`}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
          {isHomePage ? 'Drag to reorder. Click a row to edit.' : 'Settings and sections for this page type.'}
        </Typography>
      </Box>

      {/* Scrollable body */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>

        {/* Page-specific settings accordion (shown for non-home pages) */}
        {!isHomePage && (pageEditorConfig || pageInfoText) && (
          <Accordion
            expanded={pageSettingsOpen}
            onChange={(_, v) => setPageSettingsOpen(v)}
            disableGutters
            elevation={0}
            sx={{
              mx: 1,
              mb: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '8px !important',
              '&:before': { display: 'none' },
              overflow: 'hidden',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
              sx={{ px: 1.5, py: 0.5, minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.75 } }}
            >
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                Page Settings
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.5, pb: 2 }}>
              {PageEditor ? (
                <PageEditor
                  value={currentPageSettings}
                  onChange={(v) => onPageSettingChange(activePage, v)}
                />
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  {pageInfoText}
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Fixed Header node */}
        <Box sx={{ px: 1, mb: 0.5 }}>
          <FixedNode
            icon={<NavigationIcon sx={{ fontSize: 16 }} />}
            label="Header"
            description="Layout, logo, menu, actions"
            onClick={() => onHeaderClick()}
          />
          <Stack spacing={0.1} sx={{ mt: 0.25 }}>
            <HeaderBlockRow icon={<CampaignIcon sx={{ fontSize: 15 }} />} label="Announcement bar" description="Message, colors, link" onClick={() => onHeaderPartClick?.('announcementBar')} />
            <HeaderBlockRow icon={<StorefrontIcon sx={{ fontSize: 15 }} />} label="Logo" description="Store name and logo image" onClick={() => onHeaderPartClick?.('headerLogo')} />
            <HeaderBlockRow icon={<MenuIcon sx={{ fontSize: 15 }} />} label="Menu" description="Primary links and categories" onClick={() => onHeaderPartClick?.('headerMenu')} />
            <HeaderBlockRow icon={<ShoppingBagIcon sx={{ fontSize: 15 }} />} label="Actions" description="Search, account, cart" onClick={() => onHeaderPartClick?.('headerActions')} />
          </Stack>
        </Box>

        <Divider sx={{ mx: 1, my: 0.75 }}>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', px: 1 }}>
            {isHomePage ? 'Template Sections' : 'Page Sections'}
          </Typography>
        </Divider>

        {/* Section rows */}
        <Stack spacing={0.35} sx={{ px: 1 }}>
          <InsertSectionControl onClick={() => onAddSection(0, 'template')} />

          {templateSectionRows.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1.5, border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">No template sections yet</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => onAddSection(templateInsertIndex, 'template')}
                sx={{ display: 'block', mx: 'auto', mt: 1, textTransform: 'none' }}
              >
                Add first section
              </Button>
            </Box>
          ) : (
            templateSectionRows.map(({ section, originalIndex }, index) => (
              <Box key={section.id}>
                <SectionRow
                  section={section}
                  index={index}
                  total={templateSectionRows.length}
                  isSelected={selectedSectionId === section.id}
                  onSelect={onSectionClick}
                  onMove={(_, direction) => onMoveSection(originalIndex, direction, 'template')}
                  onToggle={() => onToggleSection(originalIndex)}
                  onDelete={() => onDeleteSection(originalIndex)}
                />
                <InsertSectionControl onClick={() => onAddSection(originalIndex + 1, 'template')} />
              </Box>
            ))
          )}
        </Stack>

        <Divider sx={{ mx: 1, my: 0.75 }} />

        {/* Fixed Footer node */}
        <Box sx={{ px: 1, mb: 0.5 }}>
          <FixedNode
            icon={<FootprintIcon sx={{ fontSize: 16 }} />}
            label="Footer"
            description="Links, social, copyright"
            onClick={() => onFooterClick()}
          />
        </Box>

        <Stack spacing={0.35} sx={{ px: 1, mt: 0.75, pb: 1 }}>
          <InsertSectionControl
            label={footerSectionRows.length ? 'Add footer section here' : 'Add section to footer'}
            onClick={() => onAddSection(footerStartIndex, 'footer')}
          />
          {footerSectionRows.map(({ section, originalIndex }, index) => (
            <Box key={section.id}>
              <SectionRow
                section={section}
                index={index}
                total={footerSectionRows.length}
                isSelected={selectedSectionId === section.id}
                onSelect={onSectionClick}
                onMove={(_, direction) => onMoveSection(originalIndex, direction, 'footer')}
                onToggle={() => onToggleSection(originalIndex)}
                onDelete={() => onDeleteSection(originalIndex)}
              />
              <InsertSectionControl
                label="Add footer section here"
                onClick={() => onAddSection(originalIndex + 1, 'footer')}
              />
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Bottom: Theme Settings CTA */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 1 }}>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={<SettingsIcon sx={{ fontSize: 15 }} />}
          onClick={onThemeSettingsClick}
          sx={{ justifyContent: 'flex-start', fontSize: '0.8rem', py: 0.75 }}
        >
          Theme Settings
        </Button>
      </Box>
    </Box>
  );
};

export default DesignerTreePanel;
