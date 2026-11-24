import { BLOCK_FIELD_PRESETS } from './DesignerSectionEditor';
import { getProductDetailsOrder, PRODUCT_DETAILS_LABELS, customDetailKey } from '../../../../utils/productDetailsOrder';
import { HERO_BLOCK_LABELS } from '../../../storefront/sections/ComposedHero';
import { Fragment, useEffect, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Box, Stack, Typography, IconButton, Switch, Button, Chip, Divider,
  Accordion, AccordionSummary, AccordionDetails, Tooltip, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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

const PAGE_INFO = {
  wishlist: 'Wishlist uses a fixed layout. You can preview it here and edit shared storefront styles in Theme Settings.',
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
      textTransform: 'none',
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
      '@media (hover: hover) and (pointer: fine)': {
        height: 10,
        position: 'relative',
        '& > *': { opacity: 0 },
        '&:hover > *, &:focus-within > *': { opacity: 1, zIndex: 1 },
        '& > button': { bgcolor: 'background.paper' },
      },
    }}
  >
    <Box sx={{ borderTop: '1px dashed', borderColor: 'divider' }} />
    <AddSectionButton compact onClick={onClick}>
      {label}
    </AddSectionButton>
    <Box sx={{ borderTop: '1px dashed', borderColor: 'divider' }} />
  </Box>
);

const ExpandItemsButton = ({ label, expanded, onToggle }) => (
  <IconButton size="small" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`} aria-expanded={expanded}
    onClick={(event) => { event.stopPropagation(); onToggle(); }} sx={{ p: 0.25 }}>
    {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
  </IconButton>
);

const SidebarDragHandle = ({ handleProps, label }) => handleProps && (
  <Box
    {...handleProps}
    aria-label={`Reorder ${label}`}
    onPointerDown={(event) => {
      if (!event.isPrimary || event.pointerType === 'touch' || event.button !== 0 ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      // Keep the pending gesture in this document if its first move crosses the preview iframe.
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }}
    sx={{
      display: 'grid', placeItems: 'center', width: 32, height: 32, flexShrink: 0,
      color: 'text.secondary', cursor: 'grab', touchAction: 'none', userSelect: 'none',
      borderRadius: 1, '&:hover, &:focus-visible': { bgcolor: 'action.hover', color: 'text.primary' },
      '&:active': { cursor: 'grabbing' },
    }}
  >
    <DragIndicatorIcon sx={{ fontSize: 18, pointerEvents: 'none' }} />
  </Box>
);

const SectionRow = ({ section, index, total, isSelected, onSelect, onMove, onToggle, onDelete, dragHandleProps, expandControl }) => {
  const rowRef = useRef(null);
  useEffect(() => {
    if (isSelected) rowRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [isSelected]);
  return (
  <Box
    ref={rowRef}
    onClick={() => onSelect(section)}
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      position: 'relative',
      minHeight: 44,
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
      '&:hover .section-actions, &:focus-within .section-actions': { opacity: 1 },
      '&:hover': {
        bgcolor: isSelected ? 'primary.50' : 'action.hover',
        borderColor: isSelected ? 'primary.main' : 'divider',
      },
    }}
  >
    {expandControl}
    <SidebarDragHandle handleProps={dragHandleProps} label={section.title || getSectionLabel(section)} />
    <Box component="button" type="button" onClick={(event) => { event.stopPropagation(); onSelect(section); }} aria-label={`Edit ${getSectionLabel(section)}`} sx={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'none', p: 0, color: 'inherit', cursor: 'pointer' }}>
      <Typography variant="body2" fontWeight={isSelected ? 800 : 600} sx={{ fontSize: '0.85rem', overflowWrap: 'anywhere' }}>
        {section.title || getSectionLabel(section)}
      </Typography>
      {section.title || section.subtitle || section.placement === 'footer' ? (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: '0.7rem' }}>
          {section.placement === 'footer' ? 'Footer · ' : ''}{getSectionLabel(section)}
        </Typography>
      ) : null}
    </Box>
    <Stack className="section-actions" direction="row" alignItems="center" sx={{ opacity: isSelected ? 1 : 0, transition: 'opacity .15s', width: '100%', justifyContent: 'flex-end', flexShrink: 0, borderRadius: 1, '@media (hover: none)': { opacity: 1 } }}>
    <Tooltip title={section.enabled === false ? 'Enable section' : 'Hide section'}>
      <Switch
        size="small"
        inputProps={{ 'aria-label': `${section.enabled === false ? 'Show' : 'Hide'} ${getSectionLabel(section)}` }}
        checked={section.enabled !== false}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggle(index)}
        sx={{ mr: -0.5 }}
      />
    </Tooltip>
    <Tooltip title="Move up">
      <span>
        <IconButton aria-label={`Move ${getSectionLabel(section)} up`} size="small" disabled={index === 0}
          onClick={(e) => { e.stopPropagation(); onMove(index, -1); }}>
          <ArrowUpwardIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </span>
    </Tooltip>
    <Tooltip title="Move down">
      <span>
        <IconButton aria-label={`Move ${getSectionLabel(section)} down`} size="small" disabled={index === total - 1}
          onClick={(e) => { e.stopPropagation(); onMove(index, 1); }}>
          <ArrowDownwardIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </span>
    </Tooltip>
    <Tooltip title="Remove section">
      <IconButton aria-label={`Remove ${getSectionLabel(section)}`} size="small" color="error"
        onClick={(e) => { e.stopPropagation(); onDelete(index); }}>
        <DeleteIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Tooltip>
    </Stack>
  </Box>
  );
};


const HeaderBlockRow = ({ icon, label, description, onClick }) => (
  <Box
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick?.(); } }}
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

const FixedNode = ({ icon, label, description, onClick, expandControl }) => (
  <Box
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
    {expandControl}
    <Box component="button" type="button" onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0, p: 0, border: 0, bgcolor: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
      <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>{label}</Typography>
        {description && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>{description}</Typography>
        )}
      </Box>
      <TuneIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
    </Box>
  </Box>
);

const DesignerTreePanel = ({
  sections,
  sharedSections = sections,
  loadError,
  onRetryLoad,
  activePage,
  pageSettings,
  selectedSectionId,
  componentSelection,
  onDragActiveChange,
  onSectionClick,
  onThemeSettingsClick,
  onAddSection,
  onAddProductBlock,
  onProductDetailsOrderChange,
  onAddSectionItem,
  inheritedBlocksForSection,
  onSelectProductBlock,
  onMoveSection,
  onReorderSection,
  onToggleSection,
  onDeleteSection,
  onChangePageSections,
  pageTemplateControls,
  onPageSettingChange,
  onHeaderClick,
  onHeaderPartClick,
  onFooterClick,
  onPageContentClick,
}) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const headerRef = useRef(null);
  useEffect(() => {
    if (componentSelection?.componentKey === 'headerLayout') {
      headerRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }
  }, [componentSelection]);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(true);
  const [cartExpanded, setCartExpanded] = useState(false);

  const pageEditorConfig = PAGE_EDITORS[activePage];
  const PageEditor = pageEditorConfig?.Editor;
  const pageInfoText = PAGE_INFO[activePage];
  const currentPageSettings = pageSettings[activePage] || {};
  const pageSections = currentPageSettings.productRows || [];
  const isHomePage = activePage === 'home';
  const productInfo = activePage === 'product' ? sections.find((section) => section.type === 'product-info') : null;
  const detailsOrder = productInfo ? getProductDetailsOrder(productInfo) : [];
  const moveDetail = (from, to) => {
    if (!productInfo || from === to || !detailsOrder[from] || !detailsOrder[to]) return;
    const next = [...detailsOrder];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onProductDetailsOrderChange(productInfo, next);
  };
  const templateSectionRows = sections
    .map((section, originalIndex) => ({ section, originalIndex }))
    .filter(({ section }) => !section.placement || section.placement === 'template');
  const headerSectionRows = sharedSections.map((section, originalIndex) => ({ section, originalIndex }))
    .filter(({ section }) => section.placement === 'header');
  const footerSectionRows = sharedSections
    .map((section, originalIndex) => ({ section, originalIndex }))
    .filter(({ section }) => section.placement === 'footer');
  const templateInsertIndex = footerSectionRows.length > 0 ? footerSectionRows[0].originalIndex : sections.length;
  const footerStartIndex = footerSectionRows.length > 0 ? footerSectionRows[0].originalIndex : sharedSections.length;
  const showSectionPicker = (index, area) => (event) => onAddSection(index, area, event.currentTarget);
  const isComposedSection = (section) => ['composed-hero', 'editorial-image-text'].includes(section.type);
  const expandSectionControl = (section) => (isComposedSection(section) || BLOCK_FIELD_PRESETS[section.type] || section.type === 'product-info') && (
    <ExpandItemsButton label={section.title || getSectionLabel(section)} expanded={Boolean(expandedSections[section.id])}
      onToggle={() => setExpandedSections((current) => ({ ...current, [section.id]: !current[section.id] }))} />
  );

  const renderBlockList = (section, blocks, parentId = null, depth = 0) => (
    <Stack sx={{ pl: 1.5, borderLeft: 1, borderColor: 'divider' }} spacing={0.1}>
      {blocks.length < 12 && <AddSectionButton compact onClick={(event) => onAddProductBlock(section, { parentId, depth, atStart: true, anchorEl: event.currentTarget })}>
        Add block
      </AddSectionButton>}
      {blocks.map((block) => (
        <Fragment key={block.id}>
          <Button size="small" sx={{ justifyContent: 'flex-start', textTransform: 'none', minWidth: 0 }}
            onClick={() => onSelectProductBlock(section, block.id)}>
            <Typography variant="inherit" noWrap>
              {HERO_BLOCK_LABELS[block.type]}{block.text?.trim() ? ` – ${block.text.trim()}` : ''}
            </Typography>
          </Button>
          {block.type === 'group' && depth < 3 && renderBlockList(section, block.children || [], block.id, depth + 1)}
          {blocks.length < 12 && <InsertSectionControl label="Add block below"
            onClick={(event) => onAddProductBlock(section, { parentId, depth, afterId: block.id, anchorEl: event.currentTarget })} />}
        </Fragment>
      ))}
    </Stack>
  );
  const renderExpandableBlocks = (section) => {
    if (!expandedSections[section.id]) return null;
    const composed = isComposedSection(section);
    const schema = BLOCK_FIELD_PRESETS[section.type];
    if (!composed && !schema) return null;
    const items = schema && (section[schema.key] ?? inheritedBlocksForSection?.(section) ?? []);

    return <>
        {composed && renderBlockList(section, section.heroBlocks || [])}
        {schema && <Stack sx={{ pl: 1.5, borderLeft: 1, borderColor: 'divider' }}>
          {items.length < 12 && <AddSectionButton compact onClick={() => onAddSectionItem(section, schema, items, 0)}>
            {schema.addLabel}
          </AddSectionButton>}
          {items.map((item, index) => (
            <Fragment key={item.id || index}>
              <Button size="small" sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                onClick={() => onSelectProductBlock(section, index, schema.key)}>
                {schema.label(item, index)}
              </Button>
              {items.length < 12 && <AddSectionButton compact onClick={() => onAddSectionItem(section, schema, items, index + 1)}>
                {schema.addLabel} below
              </AddSectionButton>}
            </Fragment>
          ))}
        </Stack>}
    </>;
  };

  return (
    <DragDropContext onBeforeDragStart={() => onDragActiveChange?.(true)} onDragEnd={({ source, destination }) => {
      onDragActiveChange?.(false);
      if (!destination) return;
      if (source.droppableId !== destination.droppableId) {
        const positions = ['above', 'below'];
        const from = positions.find((position) => source.droppableId === `page-template-${position}`);
        const to = positions.find((position) => destination.droppableId === `page-template-${position}`);
        if (!from || !to) return;
        const group = (section) => section.pagePosition || 'below';
        const moving = pageSections.filter((section) => group(section) === from)[source.index];
        if (!moving) return;
        const next = pageSections.filter((section) => section !== moving);
        const target = next.filter((section) => group(section) === to)[destination.index];
        next.splice(target ? next.indexOf(target) : next.length, 0, { ...moving, pagePosition: to });
        onChangePageSections(next);
        return;
      }
      if (source.index === destination.index) return;
      if (source.droppableId === 'product-details') {
        moveDetail(source.index, destination.index);
        return;
      }
      if (source.droppableId.startsWith('page-template-')) {
        const position = source.droppableId.slice('page-template-'.length);
        const rows = pageSections.map((section, index) => ({ section, index }))
          .filter(({ section }) => (section.pagePosition || 'below') === position);
        const next = [...pageSections];
        const ordered = rows.map(({ section }) => section);
        ordered.splice(destination.index, 0, ordered.splice(source.index, 1)[0]);
        rows.forEach(({ index }, i) => { next[index] = ordered[i]; });
        onChangePageSections(next);
        return;
      }
      const rows = { header: headerSectionRows, template: templateSectionRows, footer: footerSectionRows }[source.droppableId];
      if (!rows?.[source.index] || !rows[destination.index]) return;
      const from = rows[source.index].originalIndex;
      const target = rows[destination.index].originalIndex;
      onReorderSection?.(from, target + (destination.index > source.index ? 1 : 0), source.droppableId);
    }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>

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
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 1 }}>
        {loadError && (
          <Box sx={{ p: 1.5, mx: 1, mb: 1 }}>
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={onRetryLoad} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Retry
                </Button>
              }
            >
              Failed to load sections.
            </Alert>
          </Box>
        )}

        {pageTemplateControls}

        {/* Page-specific settings accordion (shown for non-home pages) */}
        {!isHomePage && (
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
        <Box ref={headerRef} sx={{ px: 1, mb: 0.5, ...(componentSelection?.componentKey === 'headerLayout' && {
          outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px',
        }) }}>
          <Typography component="h3" variant="caption" color="text.secondary">Header</Typography>
          <FixedNode
            icon={<NavigationIcon sx={{ fontSize: 16 }} />}
            label="Header"
            description="Layout, logo, menu, actions"
            onClick={() => onHeaderClick()}
            expandControl={<ExpandItemsButton label="Header elements" expanded={headerExpanded} onToggle={() => setHeaderExpanded((current) => !current)} />}
          />
          {headerExpanded && <Stack spacing={0.1} sx={{ mt: 0.25 }}>
            <HeaderBlockRow icon={<CampaignIcon sx={{ fontSize: 15 }} />} label="Announcement bar" description="Message, colors, link" onClick={() => onHeaderPartClick?.('announcementBar')} />
            <HeaderBlockRow icon={<StorefrontIcon sx={{ fontSize: 15 }} />} label="Logo" description="Store name and logo image" onClick={() => onHeaderPartClick?.('headerLogo')} />
            <HeaderBlockRow icon={<MenuIcon sx={{ fontSize: 15 }} />} label="Menu" description="Primary links and categories" onClick={() => onHeaderPartClick?.('headerMenu')} />
            <HeaderBlockRow icon={<ShoppingBagIcon sx={{ fontSize: 15 }} />} label="Actions" description="Search, account, cart" onClick={() => onHeaderPartClick?.('headerActions')} />
          </Stack>}
          <Droppable droppableId="header">{(drop) => <Box ref={drop.innerRef} {...drop.droppableProps}>
            {headerSectionRows.map(({ section, originalIndex }, index) => (
              <Draggable key={section.id} draggableId={`header:${section.id}`} index={index}>{(drag) => (
              <Box ref={drag.innerRef} {...drag.draggableProps}>
                <InsertSectionControl label="Add section before" onClick={showSectionPicker(originalIndex, 'header')} />
                <SectionRow section={section} index={index} total={headerSectionRows.length}
                  dragHandleProps={drag.dragHandleProps}
                  expandControl={expandSectionControl(section)}
                  isSelected={selectedSectionId === section.id} onSelect={onSectionClick}
                  onMove={(_, direction) => onMoveSection(originalIndex, direction, 'header')}
                  onToggle={() => onToggleSection(originalIndex)} onDelete={() => onDeleteSection(originalIndex)} />
                {renderExpandableBlocks(section)}
              </Box>
              )}</Draggable>
            ))}
            {drop.placeholder}
            <AddSectionButton onClick={showSectionPicker(sharedSections.length, 'header')}>Add section to header</AddSectionButton>
          </Box>}</Droppable>
        </Box>

        {isHomePage ? <>
        <Divider sx={{ mx: 1, my: 0.75 }}>
          <Typography component="h3" variant="caption" color="text.secondary" sx={{ px: 1 }}>
            Template
          </Typography>
        </Divider>

        {/* Section rows */}
        <Stack spacing={0.35} sx={{ px: 1 }}>
          {templateSectionRows.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1.5, border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">No template sections yet</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={showSectionPicker(templateInsertIndex, 'template')}
                sx={{ display: 'block', mx: 'auto', mt: 1, textTransform: 'none' }}
              >
                Add first section
              </Button>
            </Box>
          ) : (
            <Droppable droppableId="template">{(provided, snapshot) => <Box ref={provided.innerRef} {...provided.droppableProps}
              data-drop-active={snapshot?.isDraggingOver || undefined}
              sx={{ outline: snapshot?.isDraggingOver ? '2px dashed' : undefined, outlineColor: 'primary.main', outlineOffset: '-2px' }}>
            {templateSectionRows.map(({ section, originalIndex }, index) => (
              <Draggable key={section.id} draggableId={String(section.id)} index={index}>{(drag) => <Box ref={drag.innerRef} {...drag.draggableProps}>
                <InsertSectionControl label={`Add section before ${section.title || getSectionLabel(section)}`}
                  onClick={showSectionPicker(originalIndex, 'template')} />
                <SectionRow
                  expandControl={expandSectionControl(section)}
                  dragHandleProps={drag.dragHandleProps}
                  section={section}
                  index={index}
                  total={templateSectionRows.length}
                  isSelected={selectedSectionId === section.id}
                  onSelect={onSectionClick}
                  onMove={(_, direction) => onMoveSection(originalIndex, direction, 'template')}
                  onToggle={() => onToggleSection(originalIndex)}
                  onDelete={() => onDeleteSection(originalIndex)}
                />
                {renderExpandableBlocks(section)}
              </Box>}</Draggable>
            ))}{provided.placeholder}</Box>}</Droppable>
          )}
          {templateSectionRows.length > 0 && <AddSectionButton onClick={showSectionPicker(templateInsertIndex, 'template')} />}
        </Stack>
        </> : (
          <Stack spacing={0.5} sx={{ px: 1, py: 1 }}>
            <Typography component="h3" variant="caption" color="text.secondary">Template</Typography>
            {['above', 'below'].map((position) => {
              const rows = pageSections
                .map((section, originalIndex) => ({ section, originalIndex }))
                .filter(({ section }) => (section.pagePosition || 'below') === position);
              const mainSection = productInfo;

              return <Stack key={position} spacing={0.35}>
                {position === 'below' && (mainSection ? (
                  <>
                    <FixedNode icon={<StorefrontIcon fontSize="small" />} label="Product Information"
                      expandControl={expandSectionControl(mainSection)}
                      description="Edit blocks" onClick={() => onSectionClick(mainSection)} />
                    {expandedSections[mainSection.id] && <Stack sx={{ pl: 2, borderLeft: 1, borderColor: 'divider' }} spacing={0.25}>
                      <Typography variant="body2" sx={{ py: 0.5 }}>Product media</Typography>
                      <Typography component="h4" variant="caption" fontWeight={700}>Details</Typography>
                      {(mainSection.heroBlocks?.length || 0) < 12 && (
                        <AddSectionButton onClick={(event) => onAddProductBlock(mainSection, { detailAfter: null, anchorEl: event.currentTarget })}>
                          Add block
                        </AddSectionButton>
                      )}
                      <Droppable droppableId="product-details">{(drop) => <Box ref={drop.innerRef} {...drop.droppableProps}>
                        {detailsOrder.map((key, index) => {
                          const block = mainSection.heroBlocks?.find(({ id }) => customDetailKey(id) === key);
                          const label = block ? block.text || HERO_BLOCK_LABELS[block.type] : PRODUCT_DETAILS_LABELS[key];
                          return <Draggable key={key} draggableId={`product-detail:${key}`} index={index}>{(drag) => (
                            <Box ref={drag.innerRef} {...drag.draggableProps}>
                              <Stack direction="row" alignItems="center">
                                <SidebarDragHandle handleProps={drag.dragHandleProps} label={label} />
                                <Button size="small" sx={{ justifyContent: 'flex-start', textTransform: 'none', flex: 1, minWidth: 0 }}
                                  onClick={() => onSelectProductBlock(mainSection, block?.id || key, block ? 'heroBlocks' : 'detailsBlockOrder')}>
                                  <Typography variant="inherit" noWrap>{label}</Typography>
                                </Button>
                                <IconButton size="small" disabled={index === 0} aria-label={`Move ${label} up`} onClick={() => moveDetail(index, index - 1)}><ArrowUpwardIcon fontSize="inherit" /></IconButton>
                                <IconButton size="small" disabled={index === detailsOrder.length - 1} aria-label={`Move ${label} down`} onClick={() => moveDetail(index, index + 1)}><ArrowDownwardIcon fontSize="inherit" /></IconButton>
                              </Stack>
                              {(mainSection.heroBlocks?.length || 0) < 12 && <InsertSectionControl label={`Add block after ${label}`}
                                onClick={(event) => onAddProductBlock(mainSection, { detailAfter: key, anchorEl: event.currentTarget })} />}
                            </Box>
                          )}</Draggable>;
                        })}
                        {drop.placeholder}
                      </Box>}</Droppable>
                      {mainSection.detailsBlockOrder && <Button size="small" onClick={() => onProductDetailsOrderChange(mainSection, null)}>Restore default order</Button>}
                    </Stack>}
                  </>
                ) : <><FixedNode icon={<StorefrontIcon fontSize="small" />}
                  label={activePage === 'not-found' ? '404 page' : `${activePage.charAt(0).toUpperCase()}${activePage.slice(1)}`}
                  description="Page settings"
                  expandControl={activePage === 'cart' && <ExpandItemsButton label="Cart blocks" expanded={cartExpanded} onToggle={() => setCartExpanded((value) => !value)} />}
                  onClick={() => {
                    setPageSettingsOpen(true);
                    if (activePage === 'cart') setCartExpanded(true);
                    else onPageContentClick?.();
                  }} />
                  {activePage === 'cart' && cartExpanded && <Stack sx={{ pl: 2, borderLeft: 1, borderColor: 'divider' }}>
                    {[
                      ['Title', 'showCartTitle', () => setPageSettingsOpen(true)],
                      ['Cart products', 'showCartProducts', () => onPageContentClick?.('cartItem')],
                      ['Summary', 'showCartSummary', () => onPageContentClick?.('checkoutBlock')],
                    ].map(([label, key, openSettings]) => (
                      <Stack key={key} direction="row" alignItems="center" justifyContent="space-between">
                        <Button size="small" sx={{ textTransform: 'none' }} onClick={openSettings}>{label}</Button>
                        <Switch size="small" checked={currentPageSettings[key] !== false} inputProps={{ 'aria-label': `Show ${label}` }}
                          onChange={(_, checked) => onPageSettingChange('cart', (current) => ({ ...current, [key]: checked }))} />
                      </Stack>
                    ))}
                  </Stack>}
                </>)}
                <Droppable droppableId={`page-template-${position}`}>{(drop) => <Box ref={drop.innerRef} {...drop.droppableProps}>
                {rows.map(({ section, originalIndex }, index) => (
                  <Draggable key={section.id} draggableId={`page-template:${section.id}`} index={index}>{(drag) => <Box ref={drag.innerRef} {...drag.draggableProps}>
                    {activePage !== 'checkout' && pageSections.length < 6 && (
                      <InsertSectionControl label={`Add section before ${section.title || getSectionLabel(section)}`}
                        onClick={showSectionPicker(originalIndex, position)} />
                    )}
                  <SectionRow key={section.id} section={section} index={index} total={rows.length}
                    dragHandleProps={drag.dragHandleProps}
                    expandControl={expandSectionControl(section)}
                    isSelected={selectedSectionId === section.id} onSelect={onSectionClick}
                    onMove={(_, direction) => {
                      const targetIndex = rows[index + direction].originalIndex;
                      const next = [...pageSections];
                      [next[originalIndex], next[targetIndex]] = [next[targetIndex], next[originalIndex]];
                      onChangePageSections(next);
                    }}
                    onToggle={() => onChangePageSections(pageSections.map((item) =>
                      item.id === section.id ? { ...item, enabled: item.enabled === false } : item))}
                    onDelete={() => onChangePageSections(pageSections.filter((item) => item.id !== section.id))}
                  />
                    {renderExpandableBlocks(section)}
                  </Box>}</Draggable>
                ))}
                {drop.placeholder}</Box>}</Droppable>
                {activePage !== 'checkout' && pageSections.length < 6 && (
                  <AddSectionButton onClick={showSectionPicker(pageSections.length, position)}>
                    Add section {position} page content
                  </AddSectionButton>
                )}
              </Stack>;
            })}
          </Stack>
        )}

        <Divider sx={{ mx: 1, my: 0.75 }} />

        {/* Fixed Footer node */}
        <Box sx={{ px: 1, mb: 0.5 }}>
          <Typography component="h3" variant="caption" color="text.secondary">Footer</Typography>
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
            onClick={showSectionPicker(footerStartIndex, 'footer')}
          />
          <Droppable droppableId="footer">{(provided) => <Box ref={provided.innerRef} {...provided.droppableProps}>
          {footerSectionRows.map(({ section, originalIndex }, index) => (
            <Draggable key={section.id} draggableId={String(section.id)} index={index}>{(drag) => <Box ref={drag.innerRef} {...drag.draggableProps}>
              {index > 0 && <InsertSectionControl label={`Add section before ${section.title || getSectionLabel(section)}`}
                onClick={showSectionPicker(originalIndex, 'footer')} />}
              <SectionRow
                expandControl={expandSectionControl(section)}
                dragHandleProps={drag.dragHandleProps}
                section={section}
                index={index}
                total={footerSectionRows.length}
                isSelected={selectedSectionId === section.id}
                onSelect={onSectionClick}
                onMove={(_, direction) => onMoveSection(originalIndex, direction, 'footer')}
                onToggle={() => onToggleSection(originalIndex)}
                onDelete={() => onDeleteSection(originalIndex)}
              />
              {renderExpandableBlocks(section)}
            </Box>}</Draggable>
          ))}{provided.placeholder}</Box>}</Droppable>
          {footerSectionRows.length > 0 && <AddSectionButton onClick={showSectionPicker(sharedSections.length, 'footer')}>Add section to footer</AddSectionButton>}
        </Stack>
      </Box>

      {/* Bottom: Theme Settings CTA */}
      <Box sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider', p: 1 }}>
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
    </DragDropContext>
  );
};

export default DesignerTreePanel;
