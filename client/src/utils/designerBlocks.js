export function findDesignerBlock(blocks, id, parentId = null) {
  for (const [index, block] of blocks.entries()) {
    if (block.id === id) return { block, index, parentId, siblings: blocks };
    const child = findDesignerBlock(block.children || [], id, block.id);
    if (child) return child;
  }
  return null;
}

export function updateDesignerBlockList(blocks, parentId, update) {
  if (parentId === null) return update(blocks);
  return blocks.map((block) => {
    if (!block.children) return block;
    const children = block.id === parentId
      ? update(block.children)
      : updateDesignerBlockList(block.children, parentId, update);
    return { ...block, children };
  });
}

export function duplicateDesignerBlock(block) {
  return {
    ...block,
    id: globalThis.crypto.randomUUID(),
    ...(block.children && { children: block.children.map(duplicateDesignerBlock) }),
  };
}
