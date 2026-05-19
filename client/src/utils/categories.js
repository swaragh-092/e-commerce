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
