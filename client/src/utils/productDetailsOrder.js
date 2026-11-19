import { getProductBlockPlacement } from './productBlockPlacement';

export const PRODUCT_DETAILS_LABELS = {
  title: 'Product title', metadata: 'Stock and SKU', price: 'Price', summary: 'Short description',
  variants: 'Variant picker', purchase: 'Buy buttons', specifications: 'Specifications', description: 'Description',
};
export const DEFAULT_DETAILS_FLOW = [
  'title', 'metadata', 'price', 'summary', 'before-options', 'variants', 'purchase',
  'before-specifications', 'specifications', 'description', 'after-details',
];
export const customDetailKey = (id) => `custom:${id}`;

export function getProductDetailsOrder(section) {
  const blocks = section?.heroBlocks || [];
  const defaults = DEFAULT_DETAILS_FLOW.flatMap((key) => Object.hasOwn(PRODUCT_DETAILS_LABELS, key)
    ? [key]
    : blocks.filter((block) => getProductBlockPlacement(block) === key).map(({ id }) => customDetailKey(id)));
  const allowed = new Set(defaults);
  return [...new Set([...(Array.isArray(section?.detailsBlockOrder) ? section.detailsBlockOrder : []), ...defaults]
    .filter((key) => allowed.has(key)))];
}
