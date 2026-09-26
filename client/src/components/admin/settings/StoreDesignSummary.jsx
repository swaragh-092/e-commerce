import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Link } from 'react-router-dom';
import { DESIGNER_TARGETS, getStoreDesignSummary } from '../../../utils/storeDesign';

const SCOPE_CONFIG = {
  global: {
    title: 'Store design is managed in Store Designer',
    description: 'Edit colors, fonts, shape, buttons, surfaces, and global design tokens next to the storefront preview.',
    target: DESIGNER_TARGETS.global,
    action: 'Edit global design',
  },
  cards: {
    title: 'Card recipes are managed in Store Designer',
    description: 'Select a card in the preview to edit its recipe, content density, image ratio, and component-specific controls.',
    target: DESIGNER_TARGETS.cards,
    action: 'Edit card recipes',
  },
  announcement: {
    title: 'Announcement styling is managed in Store Designer',
    description: 'Use the header inspector to edit the message, link, colors, dismiss behavior, and placement together.',
    target: DESIGNER_TARGETS.announcement,
    action: 'Edit announcement',
  },
  header: {
    title: 'Header layout is managed in Store Designer',
    description: 'Use the header inspector for layout and behavior. Use Menu Builder for the published navigation links.',
    target: DESIGNER_TARGETS.header,
    action: 'Edit header layout',
  },
  footer: {
    title: 'Footer content and layout are managed in Store Designer',
    description: 'Keep the footer content and visual treatment together so the preview matches the saved storefront.',
    target: DESIGNER_TARGETS.footer,
    action: 'Edit footer',
  },
  homepage: {
    title: 'Homepage structure is managed in Store Designer',
    description: 'Use the Home canvas to reorder sections, edit blocks, and preview the actual route before saving.',
    target: DESIGNER_TARGETS.homepage,
    action: 'Edit homepage',
  },
};

const PAGE_CONFIG = {
  product: {
    label: 'Product page',
    target: DESIGNER_TARGETS.product,
    action: 'Edit product page',
    description: 'Edit the product layout, gallery, visibility, purchase actions, and page content together.',
    chips: (form) => [
      ['Layout', form['productPage.templateLayout'] || 'Media and details'],
      ['Gallery', form['productPage.imageAlignment'] || 'Horizontal'],
    ],
  },
  category: {
    label: 'Category page',
    target: DESIGNER_TARGETS.category,
    action: 'Edit category page',
    description: 'Edit the category header treatment, fallback title, and subcategory navigation in context.',
    chips: (form) => [['Header', form['categoryPage.headerLayout'] || 'Standard']],
  },
  collection: {
    label: 'Collection page',
    target: DESIGNER_TARGETS.collection,
    action: 'Edit collection page',
    description: 'Edit the collection layout, filters, grid density, breadcrumbs, and category navigation in context.',
    chips: (form) => [
      ['Layout', form['catalog.templateLayout'] || 'Sidebar filters + grid'],
      ['Filters', form['catalog.filterLayout'] || 'Sidebar'],
    ],
  },
  brand: {
    label: 'Brands page',
    target: DESIGNER_TARGETS.brand,
    action: 'Edit brands page',
    description: 'Edit the brands directory, card treatment, featured area, and content visibility in context.',
    chips: (form) => [
      ['Cards', form['brandsPage.cardLayout'] || 'Standard'],
      ['Featured', form['brandsPage.featuredLayout'] || 'Banner'],
    ],
  },
  blog: {
    label: 'Blog pages',
    target: DESIGNER_TARGETS.blog,
    action: 'Edit blog pages',
    description: 'Edit the article list, article header treatment, and metadata visibility from the Blog page context.',
    chips: (form) => [['List', form['blogPage.listLayout'] || 'Grid']],
  },
  cart: {
    label: 'Cart page',
    target: DESIGNER_TARGETS.cart,
    action: 'Edit cart page',
    description: 'Edit cart layout, cross-sells, trust messaging, and empty-cart content in context.',
    chips: (form) => [['Layout', form['cartPage.layout'] || 'Standard']],
  },
  account: {
    label: 'Account page',
    target: DESIGNER_TARGETS.account,
    action: 'Edit account page',
    description: 'Edit account navigation, order presentation, and support information in context.',
    chips: (form) => [['Navigation', form['accountPage.layout'] || 'Sidebar']],
  },
};

const SummaryChip = ({ label, value, color }) => (
  <Chip
    label={`${label}: ${value}`}
    size="small"
    variant="outlined"
    sx={{
      borderColor: color || 'divider',
      '& .MuiChip-label': { fontSize: '0.75rem' },
    }}
  />
);

const StoreDesignSummary = ({ scope = 'global', page, form = {}, homepageSections }) => {
  const config = SCOPE_CONFIG[scope] || SCOPE_CONFIG.global;
  const summary = getStoreDesignSummary(form, homepageSections);
  const pageConfig = PAGE_CONFIG[page];

  if (scope === 'page' && pageConfig) {
    return (
      <Box>
        <Alert
          severity="info"
          action={(
            <Button
              component={Link}
              to={pageConfig.target}
              size="small"
              color="inherit"
              endIcon={<OpenInNewIcon fontSize="small" />}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {pageConfig.action}
            </Button>
          )}
          sx={{ mb: 2 }}
        >
          {pageConfig.label} design is managed in Store Designer. {pageConfig.description}
        </Alert>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" aria-label={`${pageConfig.label} design summary`}>
          {pageConfig.chips(form).map(([label, value]) => (
            <SummaryChip key={label} label={label} value={value} />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          This summary is read-only here. Operational settings remain available in System Settings.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Alert
        severity="info"
        action={(
          <Button
            component={Link}
            to={config.target}
            size="small"
            color="inherit"
            endIcon={<OpenInNewIcon fontSize="small" />}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {config.action}
          </Button>
        )}
        sx={{ mb: 2 }}
      >
        {config.title}. {config.description}
      </Alert>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" aria-label="Current store design summary">
        {scope === 'global' && (
          <>
            <SummaryChip label="Mode" value={summary.theme.mode} />
            <SummaryChip label="Body" value={summary.theme.font} />
            <SummaryChip label="Heading" value={summary.theme.headingFont} />
            <SummaryChip label="Primary" value={summary.theme.primaryColor} color={summary.theme.primaryColor} />
            <SummaryChip label="Secondary" value={summary.theme.secondaryColor} color={summary.theme.secondaryColor} />
          </>
        )}
        {scope === 'cards' && (
          <>
            <SummaryChip label="Product card" value={summary.cards.product} />
            <SummaryChip label="Category card" value={summary.cards.category} />
          </>
        )}
        {scope === 'announcement' && <SummaryChip label="Announcement" value={summary.structure.announcement} />}
        {scope === 'header' && <SummaryChip label="Header" value={summary.structure.header} />}
        {scope === 'footer' && <SummaryChip label="Footer" value={summary.structure.footer} />}
        {scope === 'homepage' && <SummaryChip label="Sections" value={summary.homepage.sections} />}
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        This summary is read-only here. Changes made in Store Designer are saved through the canonical visual editing path.
      </Typography>
    </Box>
  );
};

export default StoreDesignSummary;
