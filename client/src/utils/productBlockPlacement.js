export const PRODUCT_BLOCK_PLACEMENTS = {
  'before-options': 'Before variant options',
  'before-specifications': 'Before specifications',
  'after-details': 'After product details',
};

export const DEFAULT_PRODUCT_BLOCK_PLACEMENT = 'before-specifications';

export const getProductBlockPlacement = (block) =>
  Object.hasOwn(PRODUCT_BLOCK_PLACEMENTS, block.productPlacement) ? block.productPlacement : DEFAULT_PRODUCT_BLOCK_PLACEMENT;
