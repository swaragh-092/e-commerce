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


export const getMenuItemDeletionBlock = (item, rows) => {
  const children = rows.filter((row) => row.parentId === item.id);
  if (children.some((row) => !row.generatedFromCategory)) {
    return `“${item.label}” has child items. Delete the child items first, then delete the parent item.`;
  }
  if (children.length) {
    return `“${item.label}” displays category-generated children. Edit the item and turn off category syncing or change its link type before deleting it.`;
  }
  return '';
};
