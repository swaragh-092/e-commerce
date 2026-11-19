export const walkCategoryTree = (nodes = [], visitor, depth = 0, parentPath = '') => {
  if (typeof visitor !== 'function') {
    throw new TypeError('visitor must be a function');
  }
  const rows = [];

  nodes.forEach((node) => {
    const path = parentPath ? `${parentPath} › ${node.name}` : node.name;
    rows.push(visitor(node, { depth, path }));
    if (node.children?.length) {
      rows.push(...walkCategoryTree(node.children, visitor, depth + 1, path));
    }
  });

  return rows;
};

// Custom homepage tiles can reference categories that have since become empty.
// Preserve unrelated/custom destinations while validating category links against
// the same filtered tree used by the storefront navigation.
export const filterCategoryTiles = (tiles = [], categories = []) => {
  const slugs = new Set(walkCategoryTree(categories, category => category.slug));
  return tiles.filter(tile => {
    const link = tile.link || '';
    const path = link.match(/^\/category\/([^/?#]+)/);
    const query = link.match(/^\/products\?([^#]*)/);
    try {
      const slug = path ? decodeURIComponent(path[1]) : query ? new URLSearchParams(query[1]).get('category') : null;
      return !slug || slugs.has(slug);
    } catch {
      return false;
    }
  });
};
