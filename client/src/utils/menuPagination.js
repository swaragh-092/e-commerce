// Ignore stale pages so concurrent desktop/mobile requests cannot revert progress.
export const appendMenuChildren = (menu, menuId, parentId, page) => {
  if (!menu || menu.id !== menuId) return menu;
  const append = (items) => items.map(item => {
    if (item.id === parentId) {
      if (item.childrenPagination?.nextOffset !== page.pagination.offset) return item;
      const seen = new Set((item.children || []).map(child => child.id));
      return { ...item,
        children: [...(item.children || []), ...page.items.filter(child => !seen.has(child.id))],
        childrenPagination: page.pagination,
      };
    }
    return { ...item, children: append(item.children || []) };
  });
  return { ...menu, items: append(menu.items || []) };
};
