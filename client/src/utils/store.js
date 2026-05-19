export const DEFAULT_STORE_NAME = 'E-Commerce Store';

export const getStoreName = (settings) =>
  settings?.general?.storeName || DEFAULT_STORE_NAME;
