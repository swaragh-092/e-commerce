// Preserve merchant copy; adapt only the shipped cart-specific headlines.
export const getHeroTitle = (title, storeMode) => (
  storeMode === 'catalog' && [
    'Everything your cart has been waiting for',
    'Upgrade your everyday cart',
  ].includes(title)
    ? 'Discover your next favorite'
    : title
);
