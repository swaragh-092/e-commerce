export const PRODUCT_STOREFRONT_STATES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
});

export const getProductStorefrontState = (product = {}) => {
  const savedProduct = product || {};
  if (savedProduct.status === PRODUCT_STOREFRONT_STATES.ARCHIVED) {
    return PRODUCT_STOREFRONT_STATES.ARCHIVED;
  }

  if (savedProduct.status !== PRODUCT_STOREFRONT_STATES.PUBLISHED) {
    return PRODUCT_STOREFRONT_STATES.DRAFT;
  }

  return savedProduct.isEnabled === false
    ? PRODUCT_STOREFRONT_STATES.PAUSED
    : PRODUCT_STOREFRONT_STATES.PUBLISHED;
};

export const getProductStorefrontFields = (state) => {
  switch (state) {
    case PRODUCT_STOREFRONT_STATES.PUBLISHED:
      return { status: 'published', isEnabled: true };
    case PRODUCT_STOREFRONT_STATES.PAUSED:
      return { status: 'published', isEnabled: false };
    case PRODUCT_STOREFRONT_STATES.ARCHIVED:
      return { status: 'archived', isEnabled: false };
    case PRODUCT_STOREFRONT_STATES.DRAFT:
    default:
      return { status: 'draft', isEnabled: true };
  }
};

export const getProductStorefrontStateHelp = (state) => {
  switch (state) {
    case PRODUCT_STOREFRONT_STATES.PUBLISHED:
      return 'Published and available products appear on the storefront.';
    case PRODUCT_STOREFRONT_STATES.PAUSED:
      return 'Temporarily hidden from the storefront; publication is kept.';
    case PRODUCT_STOREFRONT_STATES.ARCHIVED:
      return 'Retired from the storefront. You can restore it by changing this state.';
    case PRODUCT_STOREFRONT_STATES.DRAFT:
    default:
      return 'Hidden from the storefront until it is published.';
  }
};

export const PRODUCT_STOREFRONT_STATE_LABELS = Object.freeze({
  [PRODUCT_STOREFRONT_STATES.DRAFT]: 'Draft',
  [PRODUCT_STOREFRONT_STATES.PUBLISHED]: 'Published',
  [PRODUCT_STOREFRONT_STATES.PAUSED]: 'Paused',
  [PRODUCT_STOREFRONT_STATES.ARCHIVED]: 'Archived',
});
