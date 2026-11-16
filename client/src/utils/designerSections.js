// Shared by the designer section list and its storefront preview.
export const getPageSections = (settingsObj, activePg, defaultLayoutSections) => {
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
