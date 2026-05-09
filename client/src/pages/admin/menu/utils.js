import { getApiErrorMessage } from '../../../utils/apiErrors';
 
export const flattenItems = (items = [], depth = 0, rows = []) => {
  items.forEach((item) => {
    rows.push({ ...item, depth, displayLabel: `${'  '.repeat(depth)}${item.label}` });
    flattenItems(item.children || [], depth + 1, rows);
  });
  return rows;
};
 
export const flattenCategories = (items = [], depth = 0, rows = []) => {
  items.forEach((item) => {
    rows.push({ ...item, displayName: `${'  '.repeat(depth)}${item.name}` });
    flattenCategories(item.children || [], depth + 1, rows);
  });
  return rows;
};
 
export const formatValidationError = (error, fallback) => {
  const details = error?.response?.data?.error?.details;
  if (Array.isArray(details) && details.length) {
    return details.map((detail) => detail.message).join(' ');
  }
  return getApiErrorMessage(error, fallback);
};

