'use strict';

const DESIGN_DRAFT_KEY = 'store';

// These are the groups the Store Designer can stage. Payment, shipping,
// credentials, catalog inventory, and other operational groups are excluded.
const DESIGN_DRAFT_GROUPS = Object.freeze([
  'theme',
  'componentStyles',
  'nav',
  'footer',
  'announcement',
  'homepage',
  'productPage',
  'categoryPage',
  'catalog',
  'blogPage',
  'brandsPage',
  'cartPage',
  'checkoutPage',
  'wishlistPage',
  'searchPage',
  'notFoundPage',
  'ordersPage',
  'accountPage',
  'advanced',
]);

const isDesignDraftTarget = (group, key) => (
  DESIGN_DRAFT_GROUPS.includes(group) && (group !== 'advanced' || key === 'customCSS')
);

module.exports = {
  DESIGN_DRAFT_KEY,
  DESIGN_DRAFT_GROUPS,
  isDesignDraftTarget,
};
