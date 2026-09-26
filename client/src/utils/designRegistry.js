/**
 * Canonical metadata for the visual design editor.
 *
 * This is intentionally UI-framework agnostic: editors bind their own
 * components to these keys, while labels, scope, ownership, and deep-link
 * targets stay consistent across Settings and Store Designer.
 */
const COMPONENT_DEFINITIONS = [
  { key: 'designTokens', label: 'Design Tokens', group: 'global', description: 'Brand colours, typography, and global visual tokens.', settingsGroup: 'theme', ownership: 'group', previewTarget: 'global', resetTarget: { group: 'theme' } },
  { key: 'productCard', label: 'Product Card', group: 'cards', description: 'Product tile layout, metadata, price, and actions.', settingsGroup: 'componentStyles', ownership: 'group', previewTarget: 'product-card', resetTarget: { group: 'componentStyles', key: 'productCard' } },
  { key: 'categoryCard', label: 'Category Card', group: 'cards', description: 'Category tile image, label, and interaction treatment.', settingsGroup: 'componentStyles', ownership: 'group', previewTarget: 'category-card', resetTarget: { group: 'componentStyles', key: 'categoryCard' } },
  { key: 'promoCard', label: 'Promo Banner', group: 'cards', description: 'Promotional card imagery, copy, and call to action.', settingsGroup: 'componentStyles', ownership: 'group', previewTarget: 'promo-card', resetTarget: { group: 'componentStyles', key: 'promoCard' } },
  { key: 'brandCard', label: 'Brand Card', group: 'cards', description: 'Brand logo card layout and hover treatment.', settingsGroup: 'componentStyles', ownership: 'group', previewTarget: 'brand-card', resetTarget: { group: 'componentStyles', key: 'brandCard' } },
  { key: 'trustCard', label: 'Trust Item', group: 'cards', description: 'Trust and value-proposition item styling.', settingsGroup: 'componentStyles', ownership: 'group', previewTarget: 'trust-card', resetTarget: { group: 'componentStyles', key: 'trustCard' } },
  { key: 'headerLayout', label: 'Header Layout', group: 'structure', description: 'Header placement, background, and responsive layout.', settingsGroup: 'nav', ownership: 'group', previewTarget: 'header', resetTarget: { group: 'nav' } },
  { key: 'announcementBar', label: 'Announcement Bar', group: 'structure', description: 'Store-wide message, link, and announcement visibility.', settingsGroup: 'announcement', ownership: 'group', previewTarget: 'announcement', resetTarget: { group: 'announcement' } },
  { key: 'headerLogo', label: 'Logo', group: 'structure', description: 'Store name, logo image, and logo sizing.', settingsGroup: 'nav', ownership: 'group', previewTarget: 'logo', resetTarget: { group: 'nav' } },
  { key: 'headerMenu', label: 'Menu', group: 'structure', description: 'Primary links and category navigation.', settingsGroup: 'nav', ownership: 'group', previewTarget: 'menu', resetTarget: { group: 'nav' } },
  { key: 'headerActions', label: 'Search, Account & Cart', group: 'structure', description: 'Header actions and their order.', settingsGroup: 'nav', ownership: 'group', previewTarget: 'header-actions', resetTarget: { group: 'nav' } },
  { key: 'footer', label: 'Footer Settings', group: 'structure', description: 'Footer visibility, links, and social presentation.', settingsGroup: 'footer', ownership: 'group', previewTarget: 'footer', resetTarget: { group: 'footer' } },
  { key: 'cartItem', label: 'Cart Item Row', group: 'commerce', description: 'Cart line-item density, image, and metadata treatment.', settingsGroup: 'componentStyles', ownership: 'group', previewTarget: 'cart-item', resetTarget: { group: 'componentStyles', key: 'cartItem' } },
  { key: 'checkoutBlock', label: 'Checkout Blocks', group: 'commerce', description: 'Checkout form blocks, headers, and primary actions.', settingsGroup: 'componentStyles', ownership: 'group', previewTarget: 'checkout', resetTarget: { group: 'componentStyles', key: 'checkoutBlock' } },
  { key: 'formControl', label: 'Forms & Inputs', group: 'commerce', description: 'Shared input shape, density, fill, and focus treatment.', settingsGroup: 'componentStyles', ownership: 'group', previewTarget: 'form-control', resetTarget: { group: 'componentStyles', key: 'formControl' } },
  { key: 'badgeChip', label: 'Badges & Chips', group: 'commerce', description: 'Status, sale, and metadata badge presentation.', settingsGroup: 'componentStyles', ownership: 'group', previewTarget: 'badge', resetTarget: { group: 'componentStyles', key: 'badgeChip' } },
  { key: 'customCss', label: 'Custom CSS', group: 'advanced', description: 'Permission-gated CSS overrides for advanced users.', settingsGroup: 'advanced', settingsKey: 'customCSS', ownership: 'key', previewTarget: 'custom-css', requiresAdvanced: true, resetTarget: { group: 'advanced', key: 'customCSS' } },
];

const COMPONENT_GROUP_DEFINITIONS = [
  { key: 'global', label: 'Global Tokens', description: 'Inherited visual decisions used across the storefront.', componentKeys: ['designTokens'] },
  { key: 'cards', label: 'Cards & Product', description: 'Reusable product, category, brand, promo, and trust recipes.', componentKeys: ['productCard', 'categoryCard', 'promoCard', 'brandCard', 'trustCard'] },
  { key: 'structure', label: 'Site Structure', description: 'Shared header, announcement, navigation, and footer surfaces.', componentKeys: ['headerLayout', 'announcementBar', 'headerLogo', 'headerMenu', 'headerActions', 'footer'] },
  { key: 'commerce', label: 'Commerce', description: 'Reusable cart, checkout, form, and badge surfaces.', componentKeys: ['cartItem', 'checkoutBlock', 'formControl', 'badgeChip'] },
  { key: 'advanced', label: 'Advanced', description: 'Permission-gated escape hatches for custom styling.', componentKeys: ['customCss'] },
];

const PAGE_DEFINITIONS = [
  { key: 'home', label: 'Home', status: 'active', previewPath: '/', settingsGroup: 'homepage' },
  { key: 'product', label: 'Product', status: 'active', previewPath: '/products', settingsGroup: 'productPage', ownedKeys: ['templateLayout', 'imageAlignment', 'showBreadcrumbs', 'showSKU', 'showStockBadge', 'showStickyAddToCart', 'showTrustBadges', 'showRelatedProducts', 'showRecentlyViewed', 'addToCartLabel', 'showBuyNowButton', 'buyNowLabel'] },
  { key: 'category', label: 'Category', status: 'active', previewPath: '/category/all', settingsGroup: 'categoryPage', ownedKeys: ['heroTitle', 'headerLayout', 'showSubcategories'] },
  { key: 'collection', label: 'Collection', status: 'active', previewPath: '/products', settingsGroup: 'catalog', ownedKeys: ['templateLayout', 'filterLayout', 'showBreadcrumbs', 'gridColumns', 'showFilters', 'categoryDepth', 'showCategoryIcon'] },
  { key: 'search', label: 'Search', status: 'active', previewPath: '/search' },
  { key: 'cart', label: 'Cart', status: 'active', previewPath: '/cart', settingsGroup: 'cartPage', ownedKeys: ['layout', 'showCrossSells', 'showTrustBadges', 'emptyStateText'] },
  { key: 'checkout', label: 'Checkout', status: 'active', previewPath: '/checkout' },
  { key: 'account', label: 'Account', status: 'active', previewPath: '/account', settingsGroup: 'accountPage', ownedKeys: ['layout', 'orderCardStyle', 'showSupportInfo'] },
  { key: 'orders', label: 'Orders', status: 'active', previewPath: '/account/orders' },
  { key: 'wishlist', label: 'Wishlist', status: 'active', previewPath: '/wishlist' },
  { key: 'brand', label: 'Brands', status: 'active', previewPath: '/brands', settingsGroup: 'brandsPage', ownedKeys: ['heroTitle', 'heroSubtitle', 'cardLayout', 'gridColumns', 'imageAspectRatio', 'cardStyle', 'cardBorderRadius', 'showDescriptions', 'showProductCount', 'showAlphabeticalFilter', 'showFeaturedSection', 'featuredLayout', 'featuredCount'] },
  { key: 'blog', label: 'Blog', status: 'active', previewPath: '/blogs', settingsGroup: 'blogPage', ownedKeys: ['listLayout', 'articleLayout', 'showAuthor', 'showDate'] },
  { key: 'not-found', label: '404 Page', status: 'active', previewPath: '/not-found-preview' },
];

// Merchant-facing control metadata lives beside ownership metadata so the
// Designer and compatibility surfaces cannot drift on labels, defaults, or
// persisted setting keys. Values deliberately remain storage-compatible with
// the existing page settings; this is an editor schema, not a new API shape.
const PAGE_CONTROL_SCHEMAS = {
  product: {
    groups: [
      {
        key: 'layout',
        label: 'Page Layout & Options',
        fields: [
          {
            key: 'templateLayout',
            label: 'Product Layout',
            type: 'select',
            defaultValue: 'media-left-details-right',
            options: [
              { value: 'media-left-details-right', label: 'Media left, details right' },
              { value: 'gallery-top-details-below', label: 'Gallery top, details below' },
              { value: 'sticky-purchase-panel', label: 'Sticky purchase panel' },
              { value: 'luxury-editorial', label: 'Luxury editorial' },
              { value: 'editorial', label: 'Editorial' },
            ],
          },
          {
            key: 'imageAlignment',
            label: 'Thumbnail Alignment',
            type: 'select',
            defaultValue: 'horizontal',
            options: [
              { value: 'horizontal', label: 'Horizontal below main image' },
              { value: 'vertical', label: 'Vertical beside main image' },
            ],
          },
        ],
      },
      {
        key: 'visibility',
        label: 'Visibility Toggles',
        fields: [
          { key: 'showBreadcrumbs', label: 'Show breadcrumbs', type: 'boolean', defaultValue: true },
          { key: 'showSKU', label: 'Show SKU code', type: 'boolean', defaultValue: true },
          { key: 'showStockBadge', label: 'Show stock badge', type: 'boolean', defaultValue: true },
          { key: 'showStickyAddToCart', label: 'Show sticky bar', type: 'boolean', defaultValue: true },
          { key: 'showTrustBadges', label: 'Show trust badges', type: 'boolean', defaultValue: true },
          { key: 'showRelatedProducts', label: 'Show related items', type: 'boolean', defaultValue: true },
          { key: 'showRecentlyViewed', label: 'Show recently viewed', type: 'boolean', defaultValue: true },
        ],
      },
      {
        key: 'content',
        label: 'Labels & Content',
        fields: [
          { key: 'addToCartLabel', label: 'Add to Cart Button Label', type: 'text', defaultValue: 'Add to Cart' },
          { key: 'showBuyNowButton', label: 'Show Buy Now Button', type: 'boolean', defaultValue: true },
          {
            key: 'buyNowLabel',
            label: 'Buy Now Button Label',
            type: 'text',
            defaultValue: 'Buy Now',
            visibleWhen: { key: 'showBuyNowButton', notEquals: false },
          },
        ],
      },
    ],
  },
};

Object.assign(PAGE_CONTROL_SCHEMAS, {
  category: {
    groups: [{
      key: 'header',
      label: 'Page Header Style',
      fields: [
        { key: 'heroTitle', label: 'Default Page/Hero Title', type: 'text', defaultValue: 'Shop Category', helperText: 'Fallback title if the category lacks a custom name' },
        {
          key: 'headerLayout',
          label: 'Header Layout',
          type: 'select',
          defaultValue: 'standard',
          options: [
            { value: 'standard', label: 'Standard - title and description inline' },
            { value: 'cover', label: 'Cover - full-width background banner' },
            { value: 'split', label: 'Split - text left, image right' },
          ],
        },
        { key: 'showSubcategories', label: 'Show subcategory navigation chips', type: 'boolean', defaultValue: true },
      ],
    }],
  },
  collection: {
    groups: [{
      key: 'layout',
      label: 'Collection Layout & Filters',
      fields: [
        {
          key: 'templateLayout',
          label: 'Collection Layout',
          type: 'select',
          defaultValue: 'sidebar-filters-grid',
          options: [
            { value: 'sidebar-filters-grid', label: 'Sidebar filters + grid' },
            { value: 'topbar-filters-grid', label: 'Top filter bar + grid' },
            { value: 'compact-b2b-list', label: 'Compact B2B list' },
            { value: 'editorial-collection-grid', label: 'Editorial collection grid' },
            { value: 'image-led-grid', label: 'Image-led grid' },
          ],
        },
        {
          key: 'filterLayout',
          label: 'Filter Layout',
          type: 'select',
          defaultValue: 'sidebar',
          options: [
            { value: 'sidebar', label: 'Sidebar filters' },
            { value: 'topbar', label: 'Top bar filters' },
            { value: 'drawer', label: 'Drawer/mobile-first filters' },
          ],
        },
        { key: 'showBreadcrumbs', label: 'Show breadcrumbs on collection pages', type: 'boolean', defaultValue: true },
        {
          key: 'gridColumns',
          label: 'Grid Columns',
          type: 'select',
          defaultValue: 4,
          options: [
            { value: 2, label: '2 - Wide cards' },
            { value: 3, label: '3 columns' },
            { value: 4, label: '4 columns' },
            { value: 5, label: '5 - Dense grid' },
          ],
        },
        { key: 'showCategoryIcon', label: 'Show category icons', type: 'boolean', defaultValue: true },
        { key: 'showFilters', label: 'Show filter sidebar on catalog page', type: 'boolean', defaultValue: true },
        {
          key: 'categoryDepth',
          label: 'Category Filter Depth',
          type: 'select',
          defaultValue: 3,
          visibleWhen: { key: 'showFilters', notEquals: false },
          options: [
            { value: 1, label: '1 - Top-level only' },
            { value: 2, label: '2 - Top + sub-categories' },
            { value: 3, label: '3 - Top + sub + sub-sub' },
            { value: 4, label: '4 levels deep' },
            { value: 5, label: '5 levels deep' },
          ],
        },
      ],
    }],
  },
  blog: {
    groups: [{
      key: 'layout',
      label: 'Blog Layout',
      fields: [
        {
          key: 'listLayout',
          label: 'Blog List Layout',
          type: 'select',
          defaultValue: 'grid',
          options: [
            { value: 'grid', label: 'Grid Layout' },
            { value: 'list', label: 'List Layout' },
            { value: 'masonry', label: 'Masonry' },
          ],
        },
        {
          key: 'articleLayout',
          label: 'Article Layout',
          type: 'select',
          defaultValue: 'standard',
          options: [
            { value: 'standard', label: 'Standard' },
            { value: 'cover', label: 'Cover image header' },
          ],
        },
        { key: 'showAuthor', label: 'Show article author', type: 'boolean', defaultValue: true },
        { key: 'showDate', label: 'Show article publish date', type: 'boolean', defaultValue: true },
      ],
    }],
  },
  brand: {
    groups: [
      {
        key: 'directory',
        label: 'Brand Directory',
        fields: [
          { key: 'heroTitle', label: 'Page Title', type: 'text', defaultValue: 'Shop by Brand' },
          { key: 'heroSubtitle', label: 'Page Subtitle', type: 'text', defaultValue: 'Discover products grouped by your favorite brands.' },
          {
            key: 'cardLayout',
            label: 'Card Layout',
            type: 'select',
            defaultValue: 'standard',
            options: [
              { value: 'standard', label: 'Standard - image top, content below' },
              { value: 'overlay', label: 'Overlay - full image with text overlay' },
              { value: 'minimal', label: 'Minimal - compact logo and name' },
            ],
          },
          {
            key: 'gridColumns',
            label: 'Grid Columns',
            type: 'select',
            defaultValue: 4,
            options: [
              { value: 2, label: '2 - Wide cards' },
              { value: 3, label: '3 columns' },
              { value: 4, label: '4 columns' },
              { value: 5, label: '5 - Dense grid' },
            ],
          },
          {
            key: 'imageAspectRatio',
            label: 'Image Ratio',
            type: 'select',
            defaultValue: 'square',
            options: [
              { value: 'square', label: 'Square' },
              { value: 'landscape', label: 'Landscape' },
              { value: 'portrait', label: 'Portrait' },
            ],
          },
          {
            key: 'cardStyle',
            label: 'Card Style',
            type: 'select',
            defaultValue: 'inherit',
            options: [
              { value: 'inherit', label: 'Inherit from theme' },
              { value: 'elevated', label: 'Elevated' },
              { value: 'outlined', label: 'Outlined' },
              { value: 'flat', label: 'Flat' },
            ],
          },
          { key: 'cardBorderRadius', label: 'Card Border Radius (px)', type: 'number', defaultValue: 12, min: 0, max: 48 },
          { key: 'showDescriptions', label: 'Show brand descriptions', type: 'boolean', defaultValue: true },
          { key: 'showProductCount', label: 'Show product count badges', type: 'boolean', defaultValue: true },
          { key: 'showAlphabeticalFilter', label: 'Show alphabetical filter', type: 'boolean', defaultValue: true },
        ],
      },
      {
        key: 'featured',
        label: 'Featured Brands',
        fields: [
          { key: 'showFeaturedSection', label: 'Show featured brand section', type: 'boolean', defaultValue: true },
          {
            key: 'featuredLayout',
            label: 'Featured Layout',
            type: 'select',
            defaultValue: 'banner',
            options: [
              { value: 'banner', label: 'Banner' },
              { value: 'carousel', label: 'Carousel' },
              { value: 'grid', label: 'Grid' },
            ],
          },
          { key: 'featuredCount', label: 'Featured Count', type: 'number', defaultValue: 3, min: 1, max: 24 },
        ],
      },
    ],
  },
  account: {
    groups: [{
      key: 'layout',
      label: 'Account Page Layout',
      fields: [
        {
          key: 'layout',
          label: 'Account Navigation Layout',
          type: 'select',
          defaultValue: 'sidebar',
          options: [
            { value: 'tabs', label: 'Tabs - compact horizontal navigation' },
            { value: 'sidebar', label: 'Sidebar - dashboard style navigation' },
          ],
        },
        {
          key: 'orderCardStyle',
          label: 'Order Card Style',
          type: 'select',
          defaultValue: 'detailed',
          options: [
            { value: 'detailed', label: 'Detailed - shows thumbnails' },
            { value: 'compact', label: 'Compact - list view' },
          ],
        },
        { key: 'showSupportInfo', label: 'Show support information block', type: 'boolean', defaultValue: false },
      ],
    }],
  },
  cart: {
    groups: [
      {
        key: 'layout',
        label: 'Cart Layout',
        fields: [{
          key: 'layout',
          label: 'Layout Style',
          type: 'select',
          defaultValue: 'standard',
          options: [
            { value: 'standard', label: 'Standard — items left, summary right' },
            { value: 'compact', label: 'Compact — reduced spacing' },
          ],
        }],
      },
      {
        key: 'features',
        label: 'Features',
        fields: [
          { key: 'showCrossSells', label: 'Show cross-sells', type: 'boolean', defaultValue: true },
          { key: 'showTrustBadges', label: 'Show trust badges and secure checkout messaging', type: 'boolean', defaultValue: true },
        ],
      },
      {
        key: 'content',
        label: 'Empty Cart Content',
        fields: [{ key: 'emptyStateText', label: 'Empty Cart Message', type: 'text', defaultValue: "Haven't added anything yet. Let's fix that.", multiline: true }],
      },
    ],
  },
  checkout: {
    groups: [
      {
        key: 'layout',
        label: 'Checkout Layout',
        fields: [{
          key: 'layout',
          label: 'Layout Style',
          type: 'select',
          defaultValue: 'two-column',
          options: [
            { value: 'two-column', label: 'Two-column — form left, summary right' },
            { value: 'one-column', label: 'One-column — stacked' },
            { value: 'accordion', label: 'Accordion — collapsed steps' },
          ],
        }],
      },
      {
        key: 'features',
        label: 'Features',
        fields: [
          { key: 'showOrderSummary', label: 'Show order summary sidebar', type: 'boolean', defaultValue: true },
          { key: 'allowGuestCheckout', label: 'Allow guest checkout', type: 'boolean', defaultValue: true },
          { key: 'showCoupon', label: 'Show coupon field at checkout', type: 'boolean', defaultValue: true },
          { key: 'showShippingStep', label: 'Show shipping step', type: 'boolean', defaultValue: true },
          { key: 'showOrderNotes', label: 'Show order notes field', type: 'boolean', defaultValue: true },
        ],
      },
      {
        key: 'labels',
        label: 'Labels',
        fields: [
          { key: 'placeOrderLabel', label: 'Place Order Button Label', type: 'text', defaultValue: 'Place Order' },
          { key: 'paymentHeading', label: 'Payment Section Heading', type: 'text', defaultValue: 'Payment' },
        ],
      },
    ],
  },
  search: {
    groups: [
      {
        key: 'layout',
        label: 'Search Results Layout',
        fields: [
          {
            key: 'gridColumns',
            label: 'Grid Columns',
            type: 'select',
            defaultValue: 4,
            options: [
              { value: 2, label: '2 — Wide cards' },
              { value: 3, label: '3 columns' },
              { value: 4, label: '4 columns' },
            ],
          },
          {
            key: 'defaultSort',
            label: 'Default Sort',
            type: 'select',
            defaultValue: 'relevance',
            options: [
              { value: 'relevance', label: 'Relevance' },
              { value: 'newest', label: 'Newest' },
              { value: 'price_asc', label: 'Price: Low to High' },
              { value: 'price_desc', label: 'Price: High to Low' },
            ],
          },
        ],
      },
      {
        key: 'features',
        label: 'Features',
        fields: [
          { key: 'showFilters', label: 'Show filter sidebar', type: 'boolean', defaultValue: true },
          { key: 'showSortBar', label: 'Show sort bar', type: 'boolean', defaultValue: true },
          { key: 'showResultCount', label: 'Show result count', type: 'boolean', defaultValue: true },
        ],
      },
      {
        key: 'labels',
        label: 'Labels',
        fields: [
          { key: 'searchPlaceholder', label: 'Search Input Placeholder', type: 'text', defaultValue: 'Search products…' },
          { key: 'noResultsMessage', label: 'No Results Message', type: 'text', defaultValue: 'No products found for your search.', multiline: true },
        ],
      },
    ],
  },
  'not-found': {
    groups: [
      {
        key: 'content',
        label: '404 Page Content',
        fields: [
          { key: 'headline', label: 'Headline', type: 'text', defaultValue: 'Page Not Found' },
          { key: 'subtext', label: 'Sub-text', type: 'text', defaultValue: "Sorry, the page you're looking for doesn't exist or has been moved.", multiline: true },
        ],
      },
      {
        key: 'actions',
        label: 'CTA Buttons',
        fields: [
          { key: 'cta1Label', label: 'Primary Button Label', type: 'text', defaultValue: 'Browse Products' },
          { key: 'cta1Link', label: 'Primary Button Link', type: 'text', defaultValue: '/products' },
          { key: 'cta2Label', label: 'Secondary Button Label', type: 'text', defaultValue: 'Go Home' },
          { key: 'cta2Link', label: 'Secondary Button Link', type: 'text', defaultValue: '/' },
        ],
      },
    ],
  },
  orders: {
    groups: [
      {
        key: 'layout',
        label: 'Orders List Layout',
        fields: [{
          key: 'layout',
          label: 'Layout Style',
          type: 'select',
          defaultValue: 'list',
          options: [
            { value: 'list', label: 'List — full-width rows' },
            { value: 'cards', label: 'Cards — grid of order cards' },
          ],
        }],
      },
      {
        key: 'visibility',
        label: 'Visibility',
        fields: [
          { key: 'showStatusBadge', label: 'Show order status badges', type: 'boolean', defaultValue: true },
          { key: 'showThumbnails', label: 'Show item thumbnails', type: 'boolean', defaultValue: true },
          { key: 'showTotal', label: 'Show order total', type: 'boolean', defaultValue: true },
          { key: 'showTracking', label: 'Show tracking link', type: 'boolean', defaultValue: true },
        ],
      },
      {
        key: 'labels',
        label: 'Labels',
        fields: [
          { key: 'emptyHeadline', label: 'Empty Orders Headline', type: 'text', defaultValue: "You haven't placed any orders yet" },
          { key: 'emptyCtaLabel', label: 'Empty Orders CTA Label', type: 'text', defaultValue: 'Start Shopping' },
        ],
      },
    ],
  },
});

const COMPONENT_CONTROL_SCHEMAS = {
  productCard: {
    groups: [
      {
        key: 'recipe',
        label: 'Product Card Recipe',
        fields: [
          {
            key: 'variant',
            label: 'Product Card Variant',
            type: 'select',
            options: [
              { value: 'classic', label: 'Classic' },
              { value: 'compact', label: 'Compact' },
              { value: 'editorial', label: 'Editorial' },
              { value: 'marketplace', label: 'Marketplace' },
              { value: 'minimal', label: 'Minimal' },
              { value: 'deal', label: 'Deal' },
            ],
          },
          {
            key: 'imageRatio',
            label: 'Image Ratio',
            type: 'select',
            options: [
              { value: '1/1', label: 'Square 1:1' },
              { value: '4/5', label: 'Portrait 4:5' },
              { value: '4/3', label: 'Landscape 4:3' },
              { value: '3/4', label: 'Tall 3:4' },
              { value: '16/9', label: 'Wide 16:9' },
            ],
          },
          {
            key: 'imageFit',
            label: 'Image Fit',
            type: 'select',
            options: [
              { value: 'cover', label: 'Cover' },
              { value: 'contain', label: 'Contain' },
            ],
          },
          {
            key: 'density',
            label: 'Density',
            type: 'select',
            options: [
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' },
            ],
          },
          {
            key: 'contentAlign',
            label: 'Content Alignment',
            type: 'select',
            options: [
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ],
          },
          {
            key: 'imagePadding',
            label: 'Image Padding',
            type: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' },
            ],
          },
          {
            key: 'titleLines',
            label: 'Title Lines',
            type: 'select',
            options: [1, 2, 3, 4].map((value) => ({ value, label: `${value} ${value === 1 ? 'line' : 'lines'}` })),
          },
          {
            key: 'priceStyle',
            label: 'Price Style',
            type: 'select',
            options: [
              { value: 'regular', label: 'Regular' },
              { value: 'bold', label: 'Bold' },
            ],
          },
        ],
      },
      {
        key: 'surface',
        label: 'Surface & Interaction',
        fields: [
          {
            key: 'hoverEffect',
            label: 'Hover Effect',
            type: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'lift', label: 'Lift' },
              { value: 'zoom', label: 'Zoom Image' },
              { value: 'fade', label: 'Fade' },
            ],
          },
          {
            key: 'shadow',
            label: 'Shadow',
            type: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'soft', label: 'Soft' },
              { value: 'medium', label: 'Medium' },
              { value: 'strong', label: 'Strong' },
            ],
          },
          {
            key: 'radius',
            label: 'Radius',
            type: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
              { value: 'pill', label: 'Pill' },
            ],
          },
          {
            key: 'badgePosition',
            label: 'Badge Position',
            type: 'select',
            options: [
              { value: 'top-right', label: 'Top Right' },
              { value: 'top-left', label: 'Top Left' },
              { value: 'bottom-right', label: 'Bottom Right' },
              { value: 'bottom-left', label: 'Bottom Left' },
            ],
          },
          {
            key: 'wishlistPosition',
            label: 'Wishlist/Share Position',
            type: 'select',
            options: [
              { value: 'top-right', label: 'Top Right' },
              { value: 'top-left', label: 'Top Left' },
              { value: 'bottom-right', label: 'Bottom Right' },
              { value: 'bottom-left', label: 'Bottom Left' },
            ],
          },
          {
            key: 'actionPlacement',
            label: 'Action Placement',
            type: 'select',
            options: [
              { value: 'footer', label: 'Below content' },
              { value: 'image-overlay', label: 'Image overlay' },
            ],
          },
        ],
      },
      {
        key: 'visibility',
        label: 'Visibility',
        fields: [
          { key: 'showBrand', label: 'Show Brand', type: 'boolean' },
          { key: 'showCategory', label: 'Show Category', type: 'boolean' },
          { key: 'showRating', label: 'Show Rating', type: 'boolean' },
          { key: 'showWishlist', label: 'Show Wishlist', type: 'boolean' },
          { key: 'showShare', label: 'Show Share', type: 'boolean' },
          { key: 'showSaleCountdown', label: 'Show Sale Countdown', type: 'boolean' },
        ],
      },
    ],
  },
  categoryCard: {
    groups: [
      {
        key: 'recipe',
        label: 'Category Card Recipe',
        fields: [
          {
            key: 'variant',
            label: 'Category Card Variant',
            type: 'select',
            options: [
              { value: 'image-tile', label: 'Image Tile' },
              { value: 'icon-grid', label: 'Icon Grid' },
              { value: 'compact-chips', label: 'Compact Chips' },
            ],
          },
          {
            key: 'titlePlacement',
            label: 'Title Placement',
            type: 'select',
            options: [
              { value: 'below', label: 'Below Image' },
              { value: 'overlay', label: 'Overlay Bottom' },
              { value: 'centered', label: 'Centered Overlay' },
            ],
          },
          {
            key: 'imageRatio',
            label: 'Image Ratio',
            type: 'select',
            options: [
              { value: '1/1', label: 'Square 1:1' },
              { value: '4/5', label: 'Portrait 4:5' },
              { value: '4/3', label: 'Landscape 4:3' },
              { value: '16/9', label: 'Wide 16:9' },
            ],
          },
          {
            key: 'density',
            label: 'Density',
            type: 'select',
            options: [
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' },
            ],
          },
          {
            key: 'hoverEffect',
            label: 'Hover Effect',
            type: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'lift', label: 'Lift' },
              { value: 'zoom', label: 'Zoom Image' },
              { value: 'fade', label: 'Fade' },
            ],
          },
          {
            key: 'shadow',
            label: 'Shadow',
            type: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'soft', label: 'Soft' },
              { value: 'medium', label: 'Medium' },
              { value: 'strong', label: 'Strong' },
            ],
          },
        ],
      },
      {
        key: 'visibility',
        label: 'Visibility',
        fields: [
          { key: 'showSubtitle', label: 'Show Subtitle', type: 'boolean' },
          { key: 'showProductCount', label: 'Show Product Count', type: 'boolean' },
        ],
      },
    ],
  },
};

const componentSelect = (key, label, options) => ({ key, label, type: 'select', options });
const componentBoolean = (key, label) => ({ key, label, type: 'boolean' });
const COMPONENT_STYLE_OPTIONS = {
  radius: [
    { value: 'none', label: 'None' },
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
    { value: 'pill', label: 'Pill' },
  ],
  shadow: [
    { value: 'none', label: 'None' },
    { value: 'soft', label: 'Soft' },
    { value: 'medium', label: 'Medium' },
    { value: 'strong', label: 'Strong' },
  ],
  density: [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'spacious', label: 'Spacious' },
  ],
  hoverEffect: [
    { value: 'none', label: 'None' },
    { value: 'lift', label: 'Lift' },
    { value: 'fade', label: 'Fade' },
  ],
};

Object.assign(COMPONENT_CONTROL_SCHEMAS, {
  designTokens: {
    groups: [
      {
        key: 'foundation',
        label: 'Foundation',
        fields: [
          {
            key: 'buttonStyle',
            label: 'Button Style',
            type: 'select',
            defaultValue: 'solid',
            options: [
              { value: 'solid', label: 'Solid' },
              { value: 'outline', label: 'Outline' },
              { value: 'soft', label: 'Soft' },
              { value: 'pill', label: 'Pill' },
            ],
          },
          {
            key: 'cardStyle',
            label: 'Card Style',
            type: 'select',
            defaultValue: 'elevated',
            options: [
              { value: 'elevated', label: 'Elevated' },
              { value: 'flat', label: 'Flat' },
              { value: 'outlined', label: 'Outlined' },
            ],
          },
          {
            key: 'backgroundStyle',
            label: 'Background Style',
            type: 'select',
            defaultValue: 'softGradient',
            options: [
              { value: 'solid', label: 'Solid' },
              { value: 'softGradient', label: 'Soft Gradient' },
            ],
          },
          {
            key: 'headerStyle',
            label: 'Header Style',
            type: 'select',
            defaultValue: 'glass',
            options: [
              { value: 'solid', label: 'Solid' },
              { value: 'glass', label: 'Glass' },
              { value: 'minimal', label: 'Minimal' },
              { value: 'bordered', label: 'Bordered' },
            ],
          },
          { key: 'borderRadius', label: 'Border Radius', type: 'text', defaultValue: '8px', helperText: 'Example: 4px, 8px, 16px' },
          { key: 'lineHeight', label: 'Line Height', type: 'text', defaultValue: '1.5' },
          { key: 'letterSpacing', label: 'Letter Spacing', type: 'text', defaultValue: '0px' },
          { key: 'headingLetterSpacing', label: 'Heading Letter Spacing', type: 'text', defaultValue: '0px' },
        ],
      },
      {
        key: 'brandColors',
        label: 'Brand Colors',
        fields: [
          { key: 'primaryColor', label: 'Primary Color', type: 'color', defaultValue: '#0f766e' },
          { key: 'secondaryColor', label: 'Secondary Color', type: 'color', defaultValue: '#f97316' },
          { key: 'backgroundColor', label: 'Background Color', type: 'color', defaultValue: '#f7f3ec' },
          { key: 'surfaceColor', label: 'Surface / Card Color', type: 'color', defaultValue: '#ffffff' },
          { key: 'textColor', label: 'Text Color', type: 'color', defaultValue: '#1f2933' },
          {
            key: 'mode',
            label: 'Theme Mode',
            type: 'select',
            defaultValue: 'light',
            options: [
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ],
          },
        ],
      },
      {
        key: 'stateColors',
        label: 'State Colors',
        fields: [
          { key: 'errorColor', label: 'Error Color', type: 'color', defaultValue: '#e11d48' },
          { key: 'warningColor', label: 'Warning Color', type: 'color', defaultValue: '#d97706' },
          { key: 'successColor', label: 'Success Color', type: 'color', defaultValue: '#059669' },
          { key: 'infoColor', label: 'Info Color', type: 'color', defaultValue: '#0284c7' },
        ],
      },
      {
        key: 'typography',
        label: 'Typography Basics',
        fields: [
          { key: 'fontFamily', label: 'Body Font', type: 'text', placeholder: 'Inter' },
          { key: 'headingFont', label: 'Heading Font', type: 'text', placeholder: 'Playfair Display' },
          {
            key: 'bodyWeight',
            label: 'Body Weight',
            type: 'select',
            defaultValue: '400',
            options: ['300', '400', '500', '600', '700', '800', '900'].map((value) => ({ value, label: value })),
          },
          {
            key: 'headingWeight',
            label: 'Heading Weight',
            type: 'select',
            defaultValue: '700',
            options: ['300', '400', '500', '600', '700', '800', '900'].map((value) => ({ value, label: value })),
          },
        ],
      },
    ],
  },
  headerLayout: {
    groups: [{
      key: 'layout',
      label: 'Header Layout',
      fields: [
        { key: 'sticky', label: 'Sticky header', type: 'boolean', defaultValue: true },
        { key: 'showCategoryBar', label: 'Show category bar below menu', type: 'boolean', defaultValue: false },
        { key: 'bgColor', label: 'Header background', type: 'color', defaultValue: '#0f766e' },
        { key: 'fgColor', label: 'Header text color', type: 'color', defaultValue: '#ffffff' },
      ],
    }],
  },
  headerLogo: {
    groups: [{
      key: 'logo',
      label: 'Logo',
      fields: [
        { key: 'logoText', label: 'Store name override', type: 'text', placeholder: 'Uses store name when empty' },
        { key: 'logoUrl', label: 'Logo image URL', type: 'text', placeholder: 'Optional logo image URL' },
        { key: 'showStoreName', label: 'Show store name text', type: 'boolean', defaultValue: true },
        { key: 'logoMaxWidth', label: 'Logo max width', type: 'text', placeholder: '120px' },
      ],
    }],
  },
  headerMenu: {
    groups: [{
      key: 'menu',
      label: 'Menu',
      fields: [
        { key: 'menuItems', label: 'Fallback menu labels', type: 'text', helperText: 'Comma separated fallback labels for empty stores.', placeholder: 'Shop, Collections, Contact' },
        { key: 'showMenu', label: 'Show menu links', type: 'boolean', defaultValue: true },
      ],
    }],
  },
  announcementBar: {
    groups: [{
      key: 'announcement',
      label: 'Announcement Bar',
      fields: [
        { key: 'enabled', label: 'Show announcement bar', type: 'boolean', defaultValue: false },
        { key: 'text', label: 'Message text', type: 'text', maxLength: 200, helperText: 'Up to 200 characters.', visibleWhen: { key: 'enabled', equals: true } },
        { key: 'link', label: 'Link URL', type: 'text', placeholder: '/products', visibleWhen: { key: 'enabled', equals: true } },
        { key: 'bgColor', label: 'Background color', type: 'color', defaultValue: '#0f766e', visibleWhen: { key: 'enabled', equals: true } },
        { key: 'fgColor', label: 'Text color', type: 'color', defaultValue: '#ffffff', visibleWhen: { key: 'enabled', equals: true } },
        { key: 'dismissible', label: 'Show dismiss button', type: 'boolean', defaultValue: true, visibleWhen: { key: 'enabled', equals: true } },
      ],
    }],
  },
  promoCard: {
    groups: [{
      key: 'recipe',
      label: 'Promo Card Recipe',
      fields: [
        componentSelect('variant', 'Promo Variant', [
          { value: 'cards', label: 'Cards' },
          { value: 'split-image', label: 'Split Image' },
          { value: 'banner-stack', label: 'Banner Stack' },
          { value: 'asymmetric', label: 'Asymmetric' },
        ]),
        componentSelect('imagePlacement', 'Image Placement', [
          { value: 'right', label: 'Right' },
          { value: 'left', label: 'Left' },
          { value: 'top', label: 'Top' },
          { value: 'background', label: 'Background' },
        ]),
        componentSelect('titleSize', 'Title Size', [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ]),
        componentSelect('ctaStyle', 'CTA Style', [
          { value: 'button', label: 'Button' },
          { value: 'text-link', label: 'Text Link' },
          { value: 'hidden', label: 'Hidden' },
        ]),
      ],
    }, {
      key: 'surface',
      label: 'Surface',
      fields: [componentSelect('radius', 'Radius', COMPONENT_STYLE_OPTIONS.radius), componentSelect('shadow', 'Shadow', COMPONENT_STYLE_OPTIONS.shadow)],
    }],
  },
  brandCard: {
    groups: [{
      key: 'recipe',
      label: 'Brand Card Recipe',
      fields: [
        componentSelect('variant', 'Brand Variant', [
          { value: 'logo-card', label: 'Logo Card' },
          { value: 'logo-only', label: 'Logo Only' },
        ]),
        componentSelect('hoverEffect', 'Hover Effect', COMPONENT_STYLE_OPTIONS.hoverEffect),
        componentSelect('radius', 'Radius', COMPONENT_STYLE_OPTIONS.radius),
        componentSelect('shadow', 'Shadow', COMPONENT_STYLE_OPTIONS.shadow),
      ],
    }],
  },
  trustCard: {
    groups: [{
      key: 'recipe',
      label: 'Trust Card Recipe',
      fields: [
        componentSelect('variant', 'Trust Variant', [
          { value: 'icon-row', label: 'Icon Row' },
          { value: 'card-grid', label: 'Card Grid' },
        ]),
        componentSelect('titleSize', 'Title Size', [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ]),
        componentSelect('radius', 'Radius', COMPONENT_STYLE_OPTIONS.radius),
        componentSelect('shadow', 'Shadow', COMPONENT_STYLE_OPTIONS.shadow),
      ],
    }],
  },
  cartItem: {
    groups: [{
      key: 'recipe',
      label: 'Cart Item Recipe',
      fields: [
        componentSelect('variant', 'Cart Item Layout', [
          { value: 'standard', label: 'Standard' },
          { value: 'compact', label: 'Compact' },
          { value: 'editorial', label: 'Editorial' },
        ]),
        componentSelect('density', 'Density', COMPONENT_STYLE_OPTIONS.density),
        componentSelect('radius', 'Radius', COMPONENT_STYLE_OPTIONS.radius),
        componentSelect('shadow', 'Shadow', COMPONENT_STYLE_OPTIONS.shadow),
        componentSelect('hoverEffect', 'Hover Effect', COMPONENT_STYLE_OPTIONS.hoverEffect),
        componentBoolean('showVariantPill', 'Show variant pill'),
      ],
    }],
  },
  checkoutBlock: {
    groups: [{
      key: 'recipe',
      label: 'Checkout Block Recipe',
      fields: [
        componentSelect('variant', 'Checkout Block Variant', [
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'elevated', label: 'Elevated' },
        ]),
        componentSelect('headerStyle', 'Header Style', [
          { value: 'stripe', label: 'Stripe' },
          { value: 'plain', label: 'Plain' },
          { value: 'accent', label: 'Accent' },
        ]),
        componentSelect('density', 'Density', COMPONENT_STYLE_OPTIONS.density),
        componentSelect('ctaStyle', 'CTA Style', [
          { value: 'solid', label: 'Solid' },
          { value: 'soft', label: 'Soft' },
          { value: 'outline', label: 'Outline' },
        ]),
        componentSelect('radius', 'Radius', COMPONENT_STYLE_OPTIONS.radius),
        componentSelect('shadow', 'Shadow', COMPONENT_STYLE_OPTIONS.shadow),
      ],
    }],
  },
  formControl: {
    groups: [{
      key: 'recipe',
      label: 'Form Control Recipe',
      fields: [
        componentSelect('variant', 'Input Variant', [
          { value: 'outlined', label: 'Outlined' },
          { value: 'filled', label: 'Filled' },
        ]),
        componentSelect('density', 'Density', COMPONENT_STYLE_OPTIONS.density),
        componentSelect('radius', 'Radius', COMPONENT_STYLE_OPTIONS.radius),
        componentSelect('fill', 'Fill', [
          { value: 'paper', label: 'Paper' },
          { value: 'muted', label: 'Muted' },
          { value: 'transparent', label: 'Transparent' },
        ]),
        componentSelect('focusStyle', 'Focus Style', [
          { value: 'brand', label: 'Brand Border' },
          { value: 'glow', label: 'Soft Glow' },
          { value: 'underline', label: 'Underline' },
        ]),
        componentSelect('labelStyle', 'Label Style', [
          { value: 'floating', label: 'Floating' },
          { value: 'placeholder', label: 'Placeholder First' },
        ]),
      ],
    }],
  },
  badgeChip: {
    groups: [{
      key: 'recipe',
      label: 'Badge & Chip Recipe',
      fields: [
        componentSelect('variant', 'Badge Variant', [
          { value: 'soft', label: 'Soft' },
          { value: 'solid', label: 'Solid' },
          { value: 'outline', label: 'Outline' },
        ]),
        componentSelect('size', 'Size', [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
        ]),
        componentSelect('radius', 'Radius', COMPONENT_STYLE_OPTIONS.radius),
        componentSelect('weight', 'Weight', [
          { value: 'regular', label: 'Regular' },
          { value: 'bold', label: 'Bold' },
          { value: 'black', label: 'Black' },
        ]),
        componentSelect('textTransform', 'Text Case', [
          { value: 'uppercase', label: 'Uppercase' },
          { value: 'none', label: 'Normal' },
        ]),
        { key: 'letterSpacing', label: 'Letter Spacing', type: 'text', placeholder: '0.04em' },
      ],
    }],
  },
});

export const DESIGN_COMPONENT_REGISTRY = Object.freeze(COMPONENT_DEFINITIONS.map((item) => Object.freeze(item)));
export const DESIGN_COMPONENT_GROUPS = Object.freeze(COMPONENT_GROUP_DEFINITIONS.map((item) => Object.freeze(item)));
export const DESIGN_PAGE_REGISTRY = Object.freeze(PAGE_DEFINITIONS.map((item) => Object.freeze(item)));

export const DESIGN_PAGE_CONTROL_SCHEMAS = Object.freeze(
  Object.fromEntries(
    Object.entries(PAGE_CONTROL_SCHEMAS).map(([pageKey, schema]) => [
      pageKey,
      Object.freeze({
        ...schema,
        groups: Object.freeze(schema.groups.map((group) => Object.freeze({
          ...group,
          fields: Object.freeze(group.fields.map((field) => Object.freeze({
            ...field,
            options: field.options ? Object.freeze(field.options.map((option) => Object.freeze(option))) : undefined,
          }))),
        }))),
      }),
    ])
  )
);

export const DESIGN_COMPONENT_CONTROL_SCHEMAS = Object.freeze(
  Object.fromEntries(
    Object.entries(COMPONENT_CONTROL_SCHEMAS).map(([componentKey, schema]) => [
      componentKey,
      Object.freeze({
        ...schema,
        groups: Object.freeze(schema.groups.map((group) => Object.freeze({
          ...group,
          fields: Object.freeze(group.fields.map((field) => Object.freeze({
            ...field,
            options: field.options ? Object.freeze(field.options.map((option) => Object.freeze(option))) : undefined,
          }))),
        }))),
      }),
    ])
  )
);

export const DESIGN_COMPONENTS_BY_KEY = Object.freeze(
  Object.fromEntries(DESIGN_COMPONENT_REGISTRY.map((item) => [item.key, item]))
);

export const DESIGNER_OWNED_GROUPS = Object.freeze([
  ...new Set([
    ...DESIGN_COMPONENT_REGISTRY
      .filter((component) => component.ownership === 'group')
      .map((component) => component.settingsGroup),
    'homepage',
  ]),
]);

export const DESIGNER_OWNED_KEYS = Object.freeze(
  Object.fromEntries(
    DESIGN_PAGE_REGISTRY
      .filter((page) => page.settingsGroup && page.ownedKeys?.length)
      .map((page) => [page.settingsGroup, Object.freeze(page.ownedKeys)])
  )
);

export const DESIGNER_TARGETS = Object.freeze({
  global: '/admin/store-designer?component=designTokens',
  cards: '/admin/store-designer?component=productCard',
  categoryCards: '/admin/store-designer?component=categoryCard',
  announcement: '/admin/store-designer?component=announcementBar',
  header: '/admin/store-designer?component=headerLayout',
  footer: '/admin/store-designer?component=footer',
  homepage: '/admin/store-designer?page=home',
  product: '/admin/store-designer?page=product',
  category: '/admin/store-designer?page=category',
  collection: '/admin/store-designer?page=collection',
  blog: '/admin/store-designer?page=blog',
  brand: '/admin/store-designer?page=brand',
  cart: '/admin/store-designer?page=cart',
  account: '/admin/store-designer?page=account',
});

export const getDesignComponent = (key) => DESIGN_COMPONENTS_BY_KEY[key] || null;

export const getDesignPageControlSchema = (key) => DESIGN_PAGE_CONTROL_SCHEMAS[key] || null;

export const getDesignComponentControlSchema = (key) => DESIGN_COMPONENT_CONTROL_SCHEMAS[key] || null;

export const isDesignControlVisible = (field, value = {}) => {
  const condition = field?.visibleWhen;
  if (!condition) return true;
  let currentValue = value[condition.key];
  if (currentValue === 'true') currentValue = true;
  if (currentValue === 'false') currentValue = false;
  if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return currentValue === condition.equals;
  if (Object.prototype.hasOwnProperty.call(condition, 'notEquals')) return currentValue !== condition.notEquals;
  return true;
};

export const getDesignResetTarget = (key) => getDesignComponent(key)?.resetTarget || null;

export const getDesignSource = (key, sources = {}) => {
  const target = getDesignResetTarget(key);
  if (!target) return 'default';
  const groupSources = sources[target.group] || {};
  if (target.key) return groupSources[target.key] || 'default';
  return Object.values(groupSources).some((source) => source === 'custom') ? 'custom' : 'default';
};

export const getDesignComponentsForGroup = (groupKey) => {
  const group = DESIGN_COMPONENT_GROUPS.find((item) => item.key === groupKey);
  return (group?.componentKeys || [])
    .map((key) => getDesignComponent(key))
    .filter(Boolean);
};
