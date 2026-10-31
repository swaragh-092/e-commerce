'use strict';

// Null preserves the existing unbounded response for menus without a configured limit.
const pageChildren = (children, limit, offset = 0) => {
    const page = children.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
        items: page.map(paginateItem),
        pagination: {
            total: children.length, limit, offset,
            hasMore: nextOffset < children.length,
            nextOffset: nextOffset < children.length ? nextOffset : null,
        },
    };
};
const paginateItem = (item) => {
    const children = item.children || [];
    if (!Number.isInteger(item.childDisplayLimit) || item.childDisplayLimit < 1) {
        return { ...item, children: children.map(paginateItem) };
    }
    const page = pageChildren(children, item.childDisplayLimit);
    return { ...item, children: page.items, childrenPagination: page.pagination };
};
const paginateMenu = (menu) => menu ? { ...menu, items: (menu.items || []).map(paginateItem) } : null;
module.exports = { pageChildren, paginateMenu };
