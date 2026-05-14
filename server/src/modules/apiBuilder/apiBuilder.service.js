'use strict';

const {
  ApiDefinition,
  Brand,
  Category,
  Menu,
  MenuItem,
  Page,
  Product,
  ProductImage,
  ProductVariant,
  ProductAttribute,
  Tag,
  AttributeTemplate,
  AttributeValue,
  VariantOption,
  Media,
  Setting,
  Sequelize,
} = require('../index');
const { Op } = Sequelize;
const AppError = require('../../utils/AppError');
const { generateSlug } = require('../../utils/slugify');
const SettingsService = require('../settings/settings.service');

const MAX_LIMIT = 200;

const RESOURCE_FIELDS = {
  categories: ['id', 'name', 'slug', 'description', 'parentId', 'image', 'icon', 'sortOrder', 'metaTitle', 'metaDescription', 'createdAt', 'updatedAt'],
  products: ['id', 'name', 'slug', 'description', 'shortDescription', 'sku', 'price', 'salePrice', 'saleStartAt', 'saleEndAt', 'saleLabel', 'quantity', 'weight', 'type', 'isFeatured', 'avgRating', 'reviewCount', 'brandId', 'metaTitle', 'metaDescription', 'createdAt', 'updatedAt'],
  brands: ['id', 'name', 'slug', 'description', 'image', 'isActive', 'isPromoted', 'isFeatured', 'createdAt', 'updatedAt'],
  pages: ['id', 'title', 'slug', 'content', 'linkPosition', 'linkPlacement', 'metaTitle', 'metaDescription', 'bannerUrl', 'status', 'sortOrder', 'createdAt', 'updatedAt'],
  menus: ['id', 'name', 'slug', 'location', 'isActive', 'sortOrder', 'alignment', 'createdAt', 'updatedAt'],
  menuItems: ['id', 'menuId', 'parentId', 'label', 'targetType', 'targetId', 'url', 'placement', 'sortOrder', 'isVisible', 'openInNewTab', 'createdAt', 'updatedAt'],
  productImages: ['id', 'productId', 'variantId', 'url', 'alt', 'sortOrder', 'isPrimary', 'mediaId', 'createdAt'],
  productVariants: ['id', 'productId', 'sku', 'mediaId', 'price', 'stockQty', 'reservedQty', 'isActive', 'sortOrder', 'createdAt', 'updatedAt'],
  productAttributes: ['id', 'productId', 'attributeId', 'valueId', 'customName', 'customValue', 'isVariantAttr', 'sortOrder', 'createdAt', 'updatedAt'],
  variantOptions: ['variantId', 'attributeId', 'valueId'],
  attributeTemplates: ['id', 'name', 'slug', 'displayType', 'valueType', 'unit', 'sortOrder', 'createdAt', 'updatedAt'],
  attributeValues: ['id', 'attributeId', 'value', 'slug', 'displayLabel', 'swatchColor', 'imageUrl', 'unitLabel', 'metadata', 'sortOrder', 'createdAt', 'updatedAt'],
  tags: ['id', 'name', 'slug', 'createdAt'],
  media: ['id', 'url', 'filename', 'mimeType', 'size', 'originalName', 'alt', 'description', 'caption', 'provider', 'createdAt', 'updatedAt'],
  settings: ['key', 'value', 'group'],
};

const FILTERABLE_FIELDS = {
  categories: ['id', 'name', 'slug', 'parentId'],
  products: ['id', 'name', 'slug', 'sku', 'price', 'salePrice', 'quantity', 'type', 'isFeatured', 'brandId'],
  brands: ['id', 'name', 'slug', 'isActive', 'isPromoted', 'isFeatured'],
  pages: ['id', 'title', 'slug', 'status', 'linkPosition'],
  menus: ['id', 'name', 'slug', 'location', 'isActive', 'alignment'],
  menuItems: ['id', 'menuId', 'parentId', 'label', 'targetType', 'placement', 'isVisible'],
  productImages: ['id', 'productId', 'variantId', 'isPrimary', 'mediaId'],
  productVariants: ['id', 'productId', 'sku', 'price', 'stockQty', 'isActive'],
  productAttributes: ['id', 'productId', 'attributeId', 'valueId', 'customName', 'customValue', 'isVariantAttr'],
  variantOptions: ['variantId', 'attributeId', 'valueId'],
  attributeTemplates: ['id', 'name', 'slug'],
  attributeValues: ['id', 'attributeId', 'value', 'slug'],
  tags: ['id', 'name', 'slug'],
  media: ['id', 'filename', 'mimeType', 'provider'],
  settings: ['key', 'group'],
};

const SORTABLE_FIELDS = {
  categories: ['name', 'slug', 'sortOrder', 'createdAt', 'updatedAt'],
  products: ['name', 'slug', 'price', 'salePrice', 'quantity', 'createdAt', 'updatedAt'],
  brands: ['name', 'slug', 'createdAt', 'updatedAt'],
  pages: ['title', 'slug', 'sortOrder', 'createdAt', 'updatedAt'],
  menus: ['name', 'slug', 'sortOrder', 'createdAt', 'updatedAt'],
  menuItems: ['label', 'sortOrder', 'createdAt', 'updatedAt'],
  productImages: ['sortOrder', 'createdAt'],
  productVariants: ['sku', 'price', 'stockQty', 'sortOrder', 'createdAt', 'updatedAt'],
  productAttributes: ['customName', 'customValue', 'sortOrder', 'createdAt', 'updatedAt'],
  attributeTemplates: ['name', 'slug', 'sortOrder', 'createdAt', 'updatedAt'],
  attributeValues: ['value', 'slug', 'sortOrder', 'createdAt', 'updatedAt'],
  tags: ['name', 'slug', 'createdAt'],
  media: ['filename', 'mimeType', 'size', 'createdAt', 'updatedAt'],
};

const PRIVATE_SETTING_GROUPS = ['gateway_credentials', 'messaging_credentials'];

const DEFAULT_ORDER = {
  categories: [['sortOrder', 'ASC'], ['name', 'ASC']],
  products: [['createdAt', 'DESC']],
  brands: [['name', 'ASC']],
  pages: [['sortOrder', 'ASC'], ['title', 'ASC']],
  menus: [['sortOrder', 'ASC'], ['name', 'ASC']],
  menuItems: [['sortOrder', 'ASC'], ['label', 'ASC']],
  productImages: [['sortOrder', 'ASC']],
  productVariants: [['sortOrder', 'ASC']],
  productAttributes: [['sortOrder', 'ASC']],
  variantOptions: [['variantId', 'ASC'], ['attributeId', 'ASC']],
  attributeTemplates: [['sortOrder', 'ASC'], ['name', 'ASC']],
  attributeValues: [['sortOrder', 'ASC'], ['value', 'ASC']],
  tags: [['name', 'ASC']],
  media: [['createdAt', 'DESC']],
};

const RESOURCE_MODELS = {
  categories: Category,
  products: Product,
  brands: Brand,
  pages: Page,
  menus: Menu,
  menuItems: MenuItem,
  productImages: ProductImage,
  productVariants: ProductVariant,
  productAttributes: ProductAttribute,
  variantOptions: VariantOption,
  attributeTemplates: AttributeTemplate,
  attributeValues: AttributeValue,
  tags: Tag,
  media: Media,
};

const PUBLIC_WHERE = {
  products: { status: 'published', isEnabled: true },
  brands: { isActive: true },
  pages: { status: 'published' },
  menus: { isActive: true },
  menuItems: { isVisible: true },
  productVariants: { isActive: true },
};

const RELATIONS = {
  categories: {
    children: { resource: 'categories', foreignKey: 'parentId', self: true, defaultSort: [['sortOrder', 'ASC'], ['name', 'ASC']] },
    products: { resource: 'products', loader: 'categoryProducts' },
  },
  products: {
    categories: { resource: 'categories', loader: 'productCategories' },
    brand: { resource: 'brands', foreignKey: 'id', parentKey: 'brandId', one: true },
    images: { resource: 'productImages', foreignKey: 'productId', defaultSort: [['sortOrder', 'ASC']] },
    variants: { resource: 'productVariants', foreignKey: 'productId', defaultSort: [['sortOrder', 'ASC']] },
    attributes: { resource: 'productAttributes', foreignKey: 'productId', defaultSort: [['sortOrder', 'ASC']] },
    tags: { resource: 'tags', loader: 'productTags' },
  },
  brands: {
    products: { resource: 'products', foreignKey: 'brandId' },
  },
  menus: {
    items: { resource: 'menuItems', foreignKey: 'menuId', defaultSort: [['sortOrder', 'ASC']] },
  },
  menuItems: {
    children: { resource: 'menuItems', foreignKey: 'parentId', self: true, defaultSort: [['sortOrder', 'ASC']] },
  },
  productImages: {
    media: { resource: 'media', foreignKey: 'id', parentKey: 'mediaId', one: true },
    variant: { resource: 'productVariants', foreignKey: 'id', parentKey: 'variantId', one: true },
  },
  productVariants: {
    options: { resource: 'variantOptions', foreignKey: 'variantId' },
    images: { resource: 'productImages', foreignKey: 'variantId', defaultSort: [['sortOrder', 'ASC']] },
    media: { resource: 'media', foreignKey: 'id', parentKey: 'mediaId', one: true },
  },
  variantOptions: {
    attribute: { resource: 'attributeTemplates', foreignKey: 'id', parentKey: 'attributeId', one: true },
    value: { resource: 'attributeValues', foreignKey: 'id', parentKey: 'valueId', one: true },
  },
  productAttributes: {
    attribute: { resource: 'attributeTemplates', loader: 'attributeTemplate', one: true },
    value: { resource: 'attributeValues', loader: 'attributeValue', one: true },
  },
};

const toPlain = (value) => (typeof value?.toJSON === 'function' ? value.toJSON() : value);

const clampLimit = (value, fallback = 10) => Math.max(1, Math.min(MAX_LIMIT, Number.parseInt(value || fallback, 10) || fallback));

const readPositiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const getNodePagination = (node = {}, context = {}) => {
  const pagination = node.pagination || {};
  if (!pagination.enabled) return null;

  const pageParam = pagination.pageParam || 'page';
  const pageSizeParam = pagination.pageSizeParam || 'pageSize';
  const defaultPage = readPositiveInt(pagination.defaultPage, 1, 100000);
  const defaultPageSize = clampLimit(pagination.defaultPageSize || node.limit, 10);
  const page = readPositiveInt(readQueryValue(context.query, pageParam), defaultPage, 100000);
  const pageSize = clampLimit(readQueryValue(context.query, pageSizeParam), defaultPageSize);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
};

const toPaginatedResult = (rows, count, pagination) => ({
  rows,
  pagination: {
    total: count,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(count / pagination.pageSize),
    hasNext: pagination.page * pagination.pageSize < count,
    hasPrev: pagination.page > 1,
  },
});

const selectedFields = (resource, fields = []) => {
  const allowed = RESOURCE_FIELDS[resource] || [];
  const selected = Array.isArray(fields) && fields.length ? fields.filter((field) => allowed.includes(field)) : allowed;
  return selected.length ? selected : allowed;
};

const pickFields = (item, resource, fields = []) => {
  const plain = toPlain(item);
  const allowed = selectedFields(resource, fields);
  return allowed.reduce((acc, field) => {
    if (plain[field] !== undefined) acc[field] = plain[field];
    return acc;
  }, {});
};

const applyFields = (items, resource, fields = []) => items.map((item) => pickFields(item, resource, fields));

const normalizeBoolean = (value) => {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

const readQueryValue = (query, key) => {
  if (!key || !query) return undefined;
  return query[key];
};

const filterValue = (filter, context = {}) => {
  const source = filter.source || filter.valueSource || (filter.param ? 'query' : 'static');
  const queryParam = filter.param || filter.queryParam || filter.field;
  let rawValue = source === 'query'
    ? readQueryValue(context.query, queryParam)
    : filter.value;

  if ((rawValue === undefined || rawValue === null || rawValue === '') && filter.defaultValue !== undefined) {
    rawValue = filter.defaultValue;
  }

  if (Array.isArray(rawValue)) return rawValue.map(normalizeBoolean);
  if (typeof rawValue === 'string' && ['in', 'between'].includes(filter.operator)) {
    return rawValue.split(',').map((item) => normalizeBoolean(item.trim())).filter((item) => item !== '');
  }
  return normalizeBoolean(rawValue);
};

const buildWhere = (resource, filters = [], context = {}) => {
  const allowed = FILTERABLE_FIELDS[resource] || [];
  const where = {};

  filters.forEach((filter) => {
    if (!filter?.field || !allowed.includes(filter.field)) return;
    const value = filterValue(filter, context);
    if (value === undefined || value === null || value === '') return;

    if (filter.operator === 'contains') {
      where[filter.field] = { [Op.iLike]: `%${String(value)}%` };
    } else if (filter.operator === 'in') {
      where[filter.field] = { [Op.in]: Array.isArray(value) ? value : [value] };
    } else if (filter.operator === 'gte') {
      where[filter.field] = { ...(where[filter.field] || {}), [Op.gte]: value };
    } else if (filter.operator === 'lte') {
      where[filter.field] = { ...(where[filter.field] || {}), [Op.lte]: value };
    } else if (filter.operator === 'between' && Array.isArray(value) && value.length >= 2) {
      where[filter.field] = { [Op.between]: [value[0], value[1]] };
    } else {
      where[filter.field] = value;
    }
  });

  return where;
};

const selectedWhere = (block) => {
  if (block.mode !== 'selected') return {};
  if (!Array.isArray(block.selectedIds) || block.selectedIds.length === 0) return { id: null };
  return { id: { [Op.in]: block.selectedIds } };
};

const buildOrder = (resource, block, fallback = DEFAULT_ORDER[resource] || []) => {
  const allowed = SORTABLE_FIELDS[resource] || [];
  const sortBy = allowed.includes(block.sortBy) ? block.sortBy : null;
  if (!sortBy) return fallback;
  return [[sortBy, String(block.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC']];
};

const buildTree = (rows, parentId = null, depth = 10) => {
  if (depth <= 0) return [];
  return rows
    .filter((row) => (row.parentId || null) === (parentId || null))
    .map((row) => ({
      ...row,
      children: buildTree(rows, row.id, depth - 1),
    }));
};

const filterTreeRoots = (tree, ids) => {
  if (!ids?.length) return tree;
  const idSet = new Set(ids);
  const visit = (nodes) => nodes.flatMap((node) => {
    const children = visit(node.children || []);
    if (idSet.has(node.id)) return [{ ...node, children: node.children || [] }];
    if (children.length) return [{ ...node, children }];
    return [];
  });
  return visit(tree);
};

const trimTreeFields = (nodes, fields, depth) => {
  if (depth <= 0) return [];
  return nodes.map((node) => ({
    ...pickFields(node, 'categories', fields),
    children: trimTreeFields(node.children || [], fields, depth - 1),
  }));
};

const loadProductsForCategory = async (categoryId, relation = {}) => {
  const products = await Product.findAll({
    where: {
      status: 'published',
      isEnabled: true,
      ...buildWhere('products', relation.filters || []),
    },
    include: [
      {
        model: Category,
        as: 'categories',
        where: { id: categoryId },
        required: true,
        through: { attributes: [] },
      },
      { model: ProductImage, as: 'images', required: false, limit: 1 },
      { model: Brand, as: 'brand', required: false },
    ],
    limit: clampLimit(relation.limit, 12),
    order: [['createdAt', 'DESC']],
  });

  return applyFields(products, 'products', relation.fields || []);
};

const attachProductsToCategories = async (nodes, relation) => Promise.all(nodes.map(async (node) => ({
  ...node,
  products: await loadProductsForCategory(node.id, relation),
  children: await attachProductsToCategories(node.children || [], relation),
})));

const executeCategories = async (block) => {
  const depth = clampLimit(block.depth, 10);
  const where = {
    ...buildWhere('categories', block.filters || []),
    ...selectedWhere(block),
  };

  if (block.include?.children?.enabled || block.includes?.includes('children')) {
    const allRows = (await Category.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] })).map(toPlain);
    const tree = buildTree(allRows, null, depth);
    let rootIds = block.mode === 'selected' ? block.selectedIds || [] : null;
    if (block.mode === 'filtered' && Object.keys(where).length) {
      const matchingRows = await Category.findAll({ where, attributes: ['id'] });
      rootIds = matchingRows.map((row) => row.id);
    }
    const selectedTree = Array.isArray(rootIds) ? filterTreeRoots(tree, rootIds) : tree;
    let trimmed = trimTreeFields(selectedTree, block.fields, depth);
    if (block.include?.products?.enabled || block.includes?.includes('products')) {
      trimmed = await attachProductsToCategories(trimmed, block.include?.products || {});
    }
    return trimmed.slice(0, clampLimit(block.limit, 10));
  }

  const rows = await Category.findAll({
    where,
    limit: clampLimit(block.limit, 10),
    order: buildOrder('categories', block, [['sortOrder', 'ASC'], ['name', 'ASC']]),
  });
  let result = applyFields(rows, 'categories', block.fields);
  if (block.include?.products?.enabled || block.includes?.includes('products')) {
    result = await attachProductsToCategories(result, block.include?.products || {});
  }
  return result;
};

const productInclude = (block) => {
  const includes = new Set(block.includes || []);
  const include = [];

  if (includes.has('images')) {
    include.push({ model: ProductImage, as: 'images', required: false, include: [{ model: Media, as: 'media', required: false }] });
  }
  if (includes.has('variants')) {
    include.push({
      model: ProductVariant,
      as: 'variants',
      required: false,
      include: [{
        model: VariantOption,
        as: 'options',
        required: false,
        include: [
          { model: AttributeTemplate, as: 'attribute', required: false },
          { model: AttributeValue, as: 'value', required: false },
        ],
      }],
    });
  }
  if (includes.has('attributes')) {
    include.push({
      model: ProductAttribute,
      as: 'attributes',
      required: false,
      include: [
        { model: AttributeTemplate, as: 'attribute', required: false },
        { model: AttributeValue, as: 'value', required: false },
      ],
    });
  }
  if (includes.has('categories')) {
    include.push({ model: Category, as: 'categories', required: false, through: { attributes: [] } });
  }
  if (includes.has('brand')) {
    include.push({ model: Brand, as: 'brand', required: false });
  }
  if (includes.has('tags')) {
    include.push({ model: Tag, as: 'tags', required: false, through: { attributes: [] } });
  }

  return include;
};

const executeProducts = async (block) => {
  const rows = await Product.findAll({
    where: {
      status: 'published',
      isEnabled: true,
      ...buildWhere('products', block.filters || []),
      ...selectedWhere(block),
    },
    include: productInclude(block),
    limit: clampLimit(block.limit, 10),
    order: buildOrder('products', block, [['createdAt', 'DESC']]),
    distinct: true,
  });

  return rows.map((row) => {
    const plain = toPlain(row);
    const base = pickFields(plain, 'products', block.fields);
    ['images', 'variants', 'attributes', 'categories', 'brand', 'tags'].forEach((key) => {
      if (plain[key] !== undefined) base[key] = plain[key];
    });
    return base;
  });
};

const executeBrands = async (block) => {
  const rows = await Brand.findAll({
    where: {
      isActive: true,
      ...buildWhere('brands', block.filters || []),
      ...selectedWhere(block),
    },
    limit: clampLimit(block.limit, 10),
    order: buildOrder('brands', block, [['name', 'ASC']]),
  });
  return applyFields(rows, 'brands', block.fields);
};

const executePages = async (block) => {
  const rows = await Page.findAll({
    where: {
      status: 'published',
      ...buildWhere('pages', block.filters || []),
      ...selectedWhere(block),
    },
    limit: clampLimit(block.limit, 10),
    order: buildOrder('pages', block, [['sortOrder', 'ASC'], ['title', 'ASC']]),
  });
  return applyFields(rows, 'pages', block.fields);
};

const menuItemsTree = (rows, parentId = null) => rows
  .filter((row) => (row.parentId || null) === (parentId || null))
  .map((row) => ({ ...row, children: menuItemsTree(rows, row.id) }));

const executeMenus = async (block) => {
  const rows = await Menu.findAll({
    where: {
      isActive: true,
      ...buildWhere('menus', block.filters || []),
      ...selectedWhere(block),
    },
    include: block.include?.items?.enabled || block.includes?.includes('items')
      ? [{ model: MenuItem, as: 'items', where: { isVisible: true }, required: false }]
      : [],
    limit: clampLimit(block.limit, 10),
    order: buildOrder('menus', block, [['sortOrder', 'ASC'], ['name', 'ASC']]),
  });

  return rows.map((row) => {
    const plain = toPlain(row);
    const base = pickFields(plain, 'menus', block.fields);
    if (plain.items) {
      const items = plain.items
        .map((item) => pickFields(item, 'menus', ['id']))
        .map((_, index) => plain.items[index])
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      base.items = menuItemsTree(items);
    }
    return base;
  });
};

const executeSettings = async (block, context = {}) => {
  if (block.group) {
    if (PRIVATE_SETTING_GROUPS.includes(block.group)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Credential settings cannot be exposed through API Builder');
    }
    const group = await SettingsService.getByGroup(block.group);
    return group;
  }

  const pagination = getNodePagination(block, context);
  const query = {
    where: {
      ...buildWhere('settings', block.filters || [], context),
      [Op.and]: [{ group: { [Op.notIn]: PRIVATE_SETTING_GROUPS } }],
    },
    limit: pagination ? pagination.pageSize : clampLimit(block.limit, 100),
    offset: pagination ? pagination.offset : undefined,
    order: [['group', 'ASC'], ['key', 'ASC']],
  };

  if (pagination) {
    const { rows, count } = await Setting.findAndCountAll(query);
    return toPaginatedResult(rows.map((row) => pickFields(row, 'settings', block.fields)), count, pagination);
  }

  const rows = await Setting.findAll(query);
  return rows.map((row) => pickFields(row, 'settings', block.fields));
};

const legacyRelations = (node) => {
  const relations = Array.isArray(node.relations) ? [...node.relations] : [];
  const legacyIncludes = new Set(node.includes || []);
  const legacyInclude = node.include || {};

  Object.entries(legacyInclude).forEach(([relation, config]) => {
    if (config?.enabled && !relations.some((item) => item.relation === relation)) {
      relations.push({ ...config, relation, enabled: true });
    }
  });

  legacyIncludes.forEach((relation) => {
    if (!relations.some((item) => item.relation === relation)) {
      relations.push({ relation, enabled: true, mode: 'all' });
    }
  });

  return relations.filter((relation) => relation.enabled !== false);
};

const buildNodeWhere = (resource, node = {}, context = {}) => ({
  ...(PUBLIC_WHERE[resource] || {}),
  ...buildWhere(resource, node.filters || [], context),
  ...selectedWhere(node),
});

const loadManyToMany = async ({ source, targetResource, parent, node, throughAs, sourceWhere, context }) => {
  const Model = RESOURCE_MODELS[targetResource];
  const pagination = getNodePagination(node, context);
  const includeSource = {
    model: source.model,
    where: sourceWhere(parent),
    required: true,
    through: { attributes: [] },
    attributes: [],
  };
  if (source.as) includeSource.as = source.as;

  const query = {
    where: buildNodeWhere(targetResource, node, context),
    include: [includeSource],
    limit: pagination ? pagination.pageSize : clampLimit(node.limit, 10),
    offset: pagination ? pagination.offset : undefined,
    order: buildOrder(targetResource, node, DEFAULT_ORDER[targetResource] || []),
    distinct: true,
    ...(throughAs ? { through: { attributes: [] } } : {}),
  };

  if (pagination) {
    const { rows, count } = await Model.findAndCountAll(query);
    return { rows, pagination: toPaginatedResult([], count, pagination).pagination };
  }

  const rows = await Model.findAll(query);
  return { rows };
};

const RELATION_LOADERS = {
  categoryProducts: (parent, node, context) => loadManyToMany({
    source: { model: Category, as: 'categories' },
    targetResource: 'products',
    parent,
    node,
    context,
    sourceWhere: (category) => ({ id: category.id }),
  }),
  productCategories: (parent, node, context) => loadManyToMany({
    source: { model: Product, as: 'products' },
    targetResource: 'categories',
    parent,
    node,
    context,
    sourceWhere: (product) => ({ id: product.id }),
  }),
  productTags: (parent, node, context) => loadManyToMany({
    source: { model: Product },
    targetResource: 'tags',
    parent,
    node,
    context,
    sourceWhere: (product) => ({ id: product.id }),
  }),
  attributeTemplate: async (parent, node, context) => ({
    rows: await AttributeTemplate.findAll({
      where: {
        ...buildNodeWhere('attributeTemplates', node, context),
        id: parent.attributeId || null,
      },
      limit: 1,
    }),
  }),
  attributeValue: async (parent, node, context) => ({
    rows: await AttributeValue.findAll({
      where: {
        ...buildNodeWhere('attributeValues', node, context),
        id: parent.valueId || null,
      },
      limit: 1,
    }),
  }),
};

const loadRelationRows = async (parent, relationConfig, relationNode, context = {}) => {
  if (relationConfig.loader) {
    return RELATION_LOADERS[relationConfig.loader](parent, relationNode, context);
  }

  const resource = relationConfig.resource;
  const Model = RESOURCE_MODELS[resource];
  const pagination = getNodePagination(relationNode, context);
  const parentValue = parent[relationConfig.parentKey || 'id'];
  const relationWhere = parentValue ? { [relationConfig.foreignKey]: parentValue } : { [relationConfig.foreignKey]: null };

  const query = {
    where: {
      ...buildNodeWhere(resource, relationNode, context),
      ...relationWhere,
    },
    limit: relationConfig.one ? 1 : (pagination ? pagination.pageSize : clampLimit(relationNode.limit, 10)),
    offset: relationConfig.one || !pagination ? undefined : pagination.offset,
    order: buildOrder(resource, relationNode, relationConfig.defaultSort || DEFAULT_ORDER[resource] || []),
    distinct: true,
  };

  if (!relationConfig.one && pagination) {
    const { rows, count } = await Model.findAndCountAll(query);
    return { rows, pagination: toPaginatedResult([], count, pagination).pagination };
  }

  const rows = await Model.findAll(query);
  return { rows };
};

const attachRelations = async (resource, items, node, rawItems = items, context = {}) => {
  const relations = legacyRelations(node);
  if (!relations.length) return items;

  return Promise.all(items.map(async (item, index) => {
    const result = { ...item };
    const parent = rawItems[index] || item;
    const parentRelations = RELATIONS[resource] || {};

    for (const relationNode of relations) {
      const relationName = relationNode.relation;
      const relationConfig = parentRelations[relationName];
      if (!relationConfig) continue;

      const targetResource = relationConfig.resource;
      const relationResult = await loadRelationRows(parent, relationConfig, relationNode, context);
      const shaped = await shapeRows(targetResource, relationResult.rows || [], relationNode, context);
      result[relationNode.key || relationName] = relationConfig.one
        ? shaped[0] || null
        : relationResult.pagination
          ? { rows: shaped, pagination: relationResult.pagination }
          : shaped;
    }

    return result;
  }));
};

const shapeRows = async (resource, rows, node = {}, context = {}) => {
  const rawRows = rows.map(toPlain);
  const shaped = applyFields(rawRows, resource, node.fields || []);
  return attachRelations(resource, shaped, node, rawRows, context);
};

const executeSettingsNode = async (node, context = {}) => executeSettings(node, context);

const executeResourceNode = async (node, context = {}) => {
  const resource = node.resource;
  if (resource === 'settings') return executeSettingsNode(node, context);

  const Model = RESOURCE_MODELS[resource];
  if (!Model) throw new AppError('VALIDATION_ERROR', 400, `Unsupported API Builder resource '${resource}'`);

  const pagination = getNodePagination(node, context);
  const query = {
    where: buildNodeWhere(resource, node, context),
    limit: pagination ? pagination.pageSize : clampLimit(node.limit, 10),
    offset: pagination ? pagination.offset : undefined,
    order: buildOrder(resource, node, DEFAULT_ORDER[resource] || []),
    distinct: true,
  };

  if (pagination) {
    const { rows, count } = await Model.findAndCountAll(query);
    return toPaginatedResult(await shapeRows(resource, rows, node, context), count, pagination);
  }

  const rows = await Model.findAll(query);
  return shapeRows(resource, rows, node, context);
};

const EXECUTORS = {
  categories: executeCategories,
  products: executeProducts,
  brands: executeBrands,
  pages: executePages,
  menus: executeMenus,
  settings: executeSettings,
};

const normalizeConfig = (config = {}) => ({
  responseMode: config.responseMode || 'object',
  includeMeta: config.includeMeta !== false,
  blocks: Array.isArray(config.blocks) ? config.blocks : [],
});

const apiUrlFor = (api) => `/api/api-builder/public/${api.slug}`;

const serializeDefinition = (api) => {
  const plain = toPlain(api);
  return {
    ...plain,
    url: apiUrlFor(plain),
  };
};

const makeUniqueSlug = async (text, existingId = null) => {
  const base = await generateSlug(text || 'custom-api');
  let candidate = base || 'custom-api';
  let counter = 1;
  while (true) {
    const existing = await ApiDefinition.findOne({ where: { slug: candidate }, paranoid: false });
    if (!existing || existing.id === existingId) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
};

exports.list = async ({ includeInactive = false } = {}) => {
  const rows = await ApiDefinition.findAll({
    where: includeInactive ? {} : { isActive: true },
    order: [['createdAt', 'DESC']],
  });
  return rows.map(serializeDefinition);
};

exports.getById = async (id) => {
  const api = await ApiDefinition.findByPk(id);
  if (!api) throw new AppError('NOT_FOUND', 404, 'API definition not found');
  return serializeDefinition(api);
};

exports.create = async (data, userId = null) => {
  const slug = await makeUniqueSlug(data.slug || data.name);
  const api = await ApiDefinition.create({
    name: data.name,
    slug,
    description: data.description || null,
    isActive: data.isActive !== false,
    config: normalizeConfig(data.config),
    createdBy: userId,
    updatedBy: userId,
  });
  return serializeDefinition(api);
};

exports.update = async (id, data, userId = null) => {
  const api = await ApiDefinition.findByPk(id);
  if (!api) throw new AppError('NOT_FOUND', 404, 'API definition not found');

  const patch = { ...data, updatedBy: userId };
  if (data.slug && data.slug !== api.slug) {
    patch.slug = await makeUniqueSlug(data.slug, id);
  } else {
    delete patch.slug;
  }
  if (data.config) patch.config = normalizeConfig(data.config);

  await api.update(patch);
  return serializeDefinition(api);
};

exports.remove = async (id) => {
  const api = await ApiDefinition.findByPk(id);
  if (!api) throw new AppError('NOT_FOUND', 404, 'API definition not found');
  await api.destroy();
  return true;
};

exports.executeConfig = async (config, { api = null, preview = false, query = {} } = {}) => {
  const normalized = normalizeConfig(config);
  const enabledBlocks = normalized.blocks.filter((block) => block.enabled !== false && block.resource);

  const output = {};
  const arrayOutput = [];

  for (const block of enabledBlocks) {
    const data = await executeResourceNode(block, { query });
    const key = block.key || block.id || block.resource;
    if (normalized.responseMode === 'array') {
      arrayOutput.push({ key, resource: block.resource, data });
    } else {
      output[key] = data;
    }
  }

  const data = normalized.responseMode === 'array' ? arrayOutput : output;
  if (!normalized.includeMeta) return data;

  return {
    meta: {
      name: api?.name || (preview ? 'Preview' : 'Custom API'),
      slug: api?.slug || null,
      generatedAt: new Date().toISOString(),
      blocks: enabledBlocks.map((block) => block.key || block.id || block.resource),
    },
    data,
  };
};

exports.executeBySlug = async (slug, query = {}) => {
  const api = await ApiDefinition.findOne({ where: { slug, isActive: true } });
  if (!api) throw new AppError('NOT_FOUND', 404, 'API definition not found');
  return exports.executeConfig(api.config, { api: toPlain(api), query });
};
