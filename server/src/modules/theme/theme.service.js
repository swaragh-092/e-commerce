'use strict';

const path = require('path');
const fs = require('fs');
const { sequelize, ThemePackage, ThemeActivation, Setting, ApiDefinition, Order, Product } = require('../index');
const SettingsService = require('../settings/settings.service');
const AuditService = require('../audit/audit.service');
const { packageSchema } = require('./theme.validation');
const AppError = require('../../utils/AppError');

const BUILTIN_DIR = path.join(__dirname, 'builtin');

const TEMPLATE_API_DESCRIPTION_PREFIX = '[template-data-source]';
const TEMPLATE_API_ALLOWED_RESOURCES = new Set(['products', 'categories', 'brands', 'productImages', 'tags', 'media', 'pages']);
const TEMPLATE_API_ALLOWED_FIELDS = {
  products: new Set(['id', 'name', 'slug', 'shortDescription', 'price', 'salePrice', 'saleLabel', 'isFeatured', 'avgRating', 'reviewCount', 'brandId', 'createdAt']),
  categories: new Set(['id', 'name', 'slug', 'description', 'parentId', 'image', 'icon', 'sortOrder']),
  brands: new Set(['id', 'name', 'slug', 'description', 'image', 'isActive', 'isPromoted', 'isFeatured']),
  productImages: new Set(['id', 'productId', 'url', 'alt', 'sortOrder', 'isPrimary', 'mediaId']),
  tags: new Set(['id', 'name', 'slug']),
  media: new Set(['id', 'url', 'filename', 'mimeType', 'alt', 'caption']),
  pages: new Set(['id', 'title', 'slug', 'metaTitle', 'metaDescription', 'bannerUrl', 'status', 'sortOrder']),
};
const TEMPLATE_API_FILTER_FIELDS = {
  products: new Set(['id', 'name', 'slug', 'price', 'salePrice', 'type', 'isFeatured', 'brandId']),
  categories: new Set(['id', 'name', 'slug', 'parentId']),
  brands: new Set(['id', 'name', 'slug', 'isActive', 'isPromoted', 'isFeatured']),
  productImages: new Set(['id', 'productId', 'isPrimary', 'mediaId']),
  tags: new Set(['id', 'name', 'slug']),
  media: new Set(['id', 'filename', 'mimeType', 'provider']),
  pages: new Set(['id', 'title', 'slug', 'status', 'linkPosition']),
};
const TEMPLATE_API_SORT_FIELDS = {
  products: new Set(['name', 'slug', 'price', 'salePrice', 'createdAt', 'updatedAt']),
  categories: new Set(['name', 'slug', 'sortOrder', 'createdAt']),
  brands: new Set(['name', 'slug', 'createdAt']),
  productImages: new Set(['sortOrder', 'createdAt']),
  tags: new Set(['name', 'slug', 'createdAt']),
  media: new Set(['filename', 'mimeType', 'createdAt']),
  pages: new Set(['title', 'slug', 'sortOrder', 'createdAt']),
};
const TEMPLATE_API_RELATIONS = {
  products: new Set(['images', 'categories', 'brand', 'tags']),
  categories: new Set(['children', 'products']),
  brands: new Set(['products']),
  productImages: new Set(['media']),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

let _builtinCache = null;

const loadBuiltinFiles = () => {
  if (_builtinCache) return _builtinCache;
  const files = fs.readdirSync(BUILTIN_DIR).filter(f => f.endsWith('.theme.json'));
  const themes = [];
  for (const file of files) {
    try {
      const filePath = path.join(BUILTIN_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      themes.push(JSON.parse(content));
    } catch (err) {
      console.error(`Error parsing builtin theme file '${file}' in BUILTIN_DIR:`, err);
    }
  }
  _builtinCache = Object.freeze(themes);
  return _builtinCache;
};

const buildSettingsRows = (pkg, scopes, replaceDemoContent, dataSourceRefs = []) => {
  const rows = [];

  if (scopes.includes('design') && pkg.design?.theme) {
    for (const [key, value] of Object.entries(pkg.design.theme)) {
      if (value !== null && value !== undefined) rows.push({ key, value, group: 'theme' });
    }
  }

  if (scopes.includes('componentStyles') && pkg.componentStyles) {
    for (const [key, value] of Object.entries(pkg.componentStyles)) {
      if (value !== null && value !== undefined) rows.push({ key, value, group: 'componentStyles' });
    }
  }

  if (scopes.includes('sectionPresets') && pkg.sectionPresets) {
    for (const [key, value] of Object.entries(pkg.sectionPresets)) {
      if (value !== null && value !== undefined) rows.push({ key, value, group: 'sectionPresets' });
    }
  }

  if (scopes.includes('layoutStyle') && pkg.layout) {
    if (pkg.layout.nav) {
      for (const [key, value] of Object.entries(pkg.layout.nav)) {
        rows.push({ key, value, group: 'nav' });
      }
    }
    if (pkg.layout.footerStyle) {
      for (const [key, value] of Object.entries(pkg.layout.footerStyle)) {
        rows.push({ key, value, group: 'footer' });
      }
    }
    if (pkg.layout.announcementStyle) {
      for (const [key, value] of Object.entries(pkg.layout.announcementStyle)) {
        rows.push({ key, value, group: 'announcement' });
      }
    }
  }

  if (scopes.includes('homepageSections') && pkg.layout?.homepageSections) {
    const sourceByKey = new Map(dataSourceRefs.map((ref) => [ref.key, ref]));
    const sections = pkg.layout.homepageSections.map((section) => {
      const { dataSourceSlug, ...safeSection } = section;
      if (!safeSection.dataSourceKey) return safeSection;
      const ref = sourceByKey.get(safeSection.dataSourceKey);
      return ref ? { ...safeSection, dataSourceSlug: ref.slug } : safeSection;
    });
    rows.push({ key: 'sections', value: sections, group: 'homepage' });
  }

  if (replaceDemoContent && scopes.includes('demoContent') && pkg.demoContent) {
    if (pkg.demoContent.announcementText) {
      rows.push({ key: 'text', value: pkg.demoContent.announcementText, group: 'announcement' });
    }
    if (pkg.demoContent.heroSlides) {
      rows.push({ key: 'heroSlides', value: pkg.demoContent.heroSlides, group: 'homepage' });
    }
    if (pkg.demoContent.valueProps) {
      rows.push({ key: 'valueProps', value: pkg.demoContent.valueProps, group: 'homepage' });
    }
    if (pkg.demoContent.promoBanners) {
      rows.push({ key: 'promoBanners', value: pkg.demoContent.promoBanners, group: 'homepage' });
    }
  }

  rows.push(...buildPageTemplateRows(pkg, scopes));

  return rows;
};


const pushDefinedSetting = (rows, group, key, value) => {
  if (value !== undefined && value !== null) rows.push({ group, key, value });
};

const buildPageTemplateRows = (pkg, scopes) => {
  const rows = [];
  if (!scopes.includes('pageTemplates') || !pkg.pageTemplates) return rows;

  const product = pkg.pageTemplates.product;
  if (product) {
    pushDefinedSetting(rows, 'productPage', 'templateLayout', product.layout);
    pushDefinedSetting(rows, 'productPage', 'showTrustBadges', product.showTrustBadges);
    pushDefinedSetting(rows, 'productPage', 'showRelatedProducts', product.showRelatedProducts);
    pushDefinedSetting(rows, 'productPage', 'showRecentlyViewed', product.showRecentlyViewed);
    pushDefinedSetting(rows, 'productPage', 'showStickyAddToCart', product.showStickyAddToCart);
    pushDefinedSetting(rows, 'productPage', 'showBreadcrumbs', product.showBreadcrumbs);
  }

  const collection = pkg.pageTemplates.collection;
  if (collection) {
    pushDefinedSetting(rows, 'catalog', 'templateLayout', collection.layout);
    pushDefinedSetting(rows, 'catalog', 'gridColumns', collection.productsPerRow);
    pushDefinedSetting(rows, 'catalog', 'filterLayout', collection.filterLayout);
    pushDefinedSetting(rows, 'catalog', 'showBreadcrumbs', collection.showBreadcrumbs);
  }

  const brand = pkg.pageTemplates.brand;
  if (brand) {
    pushDefinedSetting(rows, 'brandsPage', 'cardLayout', brand.layout);
    pushDefinedSetting(rows, 'brandsPage', 'heroTitle', brand.title);
    pushDefinedSetting(rows, 'brandsPage', 'heroSubtitle', brand.subtitle);
    pushDefinedSetting(rows, 'brandsPage', 'gridColumns', brand.productsPerRow);
    pushDefinedSetting(rows, 'brandsPage', 'imageAspectRatio', brand.imageAspectRatio);
    pushDefinedSetting(rows, 'brandsPage', 'cardStyle', brand.cardStyle);
    pushDefinedSetting(rows, 'brandsPage', 'cardBorderRadius', brand.cardBorderRadius);
    pushDefinedSetting(rows, 'brandsPage', 'showDescriptions', brand.showDescriptions);
    pushDefinedSetting(rows, 'brandsPage', 'showProductCount', brand.showProductCount);
    pushDefinedSetting(rows, 'brandsPage', 'showAlphabeticalFilter', brand.showAlphabeticalFilter);
    pushDefinedSetting(rows, 'brandsPage', 'showFeaturedSection', brand.showFeaturedSection);
    pushDefinedSetting(rows, 'brandsPage', 'featuredLayout', brand.featuredLayout);
    pushDefinedSetting(rows, 'brandsPage', 'featuredCount', brand.featuredCount);
  }

  const cart = pkg.pageTemplates.cart;
  if (cart) {
    pushDefinedSetting(rows, 'cartPage', 'layout', cart.layout);
    pushDefinedSetting(rows, 'cartPage', 'showCrossSells', cart.showCrossSells);
    pushDefinedSetting(rows, 'cartPage', 'showTrustBadges', cart.showTrustBadges);
    pushDefinedSetting(rows, 'cartPage', 'emptyStateText', cart.emptyStateText);
  }

  const account = pkg.pageTemplates.account;
  if (account) {
    pushDefinedSetting(rows, 'accountPage', 'layout', account.layout);
    pushDefinedSetting(rows, 'accountPage', 'orderCardStyle', account.orderCardStyle);
    pushDefinedSetting(rows, 'accountPage', 'showSupportInfo', account.showSupportInfo);
  }

  const blog = pkg.pageTemplates.blog;
  if (blog) {
    pushDefinedSetting(rows, 'blogPage', 'listLayout', blog.listLayout);
    pushDefinedSetting(rows, 'blogPage', 'articleLayout', blog.articleLayout);
    pushDefinedSetting(rows, 'blogPage', 'showAuthor', blog.showAuthor);
    pushDefinedSetting(rows, 'blogPage', 'showDate', blog.showDate);
  }

  return rows;
};

const readCurrentSettings = async (groups, transaction = null, { lock = false } = {}) => {
  const opts = { where: { group: groups } };
  if (transaction) opts.transaction = transaction;
  if (lock && transaction) {
    opts.lock = transaction.LOCK ? transaction.LOCK.UPDATE : 'UPDATE';
  }
  const settings = await Setting.findAll(opts);
  const snapshot = {};
  for (const s of settings) {
    if (!snapshot[s.group]) snapshot[s.group] = {};
    snapshot[s.group][s.key] = s.value;
  }
  return snapshot;
};

const affectedGroups = (scopes, replaceDemoContent) => {
  const groups = new Set();
  if (scopes.includes('design')) groups.add('theme');
  if (scopes.includes('componentStyles')) groups.add('componentStyles');
  if (scopes.includes('sectionPresets')) groups.add('sectionPresets');
  if (scopes.includes('layoutStyle')) { groups.add('nav'); groups.add('footer'); groups.add('announcement'); }
  if (scopes.includes('homepageSections')) groups.add('homepage');
  if (replaceDemoContent && scopes.includes('demoContent')) { groups.add('announcement'); groups.add('homepage'); }
  if (scopes.includes('pageTemplates')) { groups.add('productPage'); groups.add('catalog'); groups.add('brandsPage'); groups.add('cartPage'); groups.add('accountPage'); groups.add('blogPage'); }
  return [...groups];
};

const clampTemplateLimit = (value, fallback = 10) => Math.max(1, Math.min(50, Number.parseInt(value || fallback, 10) || fallback));

const sanitizeTemplateApiNode = (node, parentResource = null) => {
  const resource = node.resource;
  if (!TEMPLATE_API_ALLOWED_RESOURCES.has(resource)) {
    throw new AppError('VALIDATION_ERROR', 400, `Template data source resource '${resource}' is not allowed.`);
  }

  if (node.relation && parentResource && !TEMPLATE_API_RELATIONS[parentResource]?.has(node.relation)) {
    throw new AppError('VALIDATION_ERROR', 400, `Template data source relation '${parentResource}.${node.relation}' is not allowed.`);
  }

  const fieldAllowlist = TEMPLATE_API_ALLOWED_FIELDS[resource] || new Set();
  const filterAllowlist = TEMPLATE_API_FILTER_FIELDS[resource] || new Set();
  const sortAllowlist = TEMPLATE_API_SORT_FIELDS[resource] || new Set();
  const fields = Array.isArray(node.fields) ? node.fields.filter((field) => fieldAllowlist.has(field)) : [];
  const filters = (node.filters || []).filter((filter) => filterAllowlist.has(filter.field)).map((filter) => ({
    field: filter.field,
    operator: filter.operator || 'equals',
    source: filter.source || 'static',
    param: filter.source === 'query' ? filter.param : null,
    defaultValue: filter.defaultValue ?? null,
    value: filter.value ?? null,
  }));
  const relations = (node.relations || []).slice(0, 12).map((relation) => sanitizeTemplateApiNode(relation, resource));

  return {
    key: node.key || node.resource,
    resource,
    relation: node.relation || null,
    enabled: node.enabled !== false,
    mode: node.mode || 'all',
    selectedIds: Array.isArray(node.selectedIds) ? node.selectedIds.slice(0, 100) : [],
    limit: clampTemplateLimit(node.limit, 10),
    pagination: node.pagination?.enabled ? {
      enabled: true,
      pageParam: node.pagination.pageParam || 'page',
      pageSizeParam: node.pagination.pageSizeParam || 'pageSize',
      defaultPage: node.pagination.defaultPage || 1,
      defaultPageSize: clampTemplateLimit(node.pagination.defaultPageSize, 10),
    } : { enabled: false },
    depth: Math.max(1, Math.min(2, Number.parseInt(node.depth || 1, 10) || 1)),
    fields,
    filters,
    relations,
    sortBy: sortAllowlist.has(node.sortBy) ? node.sortBy : null,
    sortOrder: String(node.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
  };
};

const templateApiSlug = (templateSlug, key) => `template-${templateSlug}-${key}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140);

const normalizeTemplateApiConfig = (config = {}) => ({
  responseMode: config.responseMode || 'object',
  includeMeta: config.includeMeta !== false,
  blocks: (config.blocks || []).slice(0, 8).map((block) => sanitizeTemplateApiNode(block)),
});

const upsertTemplateDataSources = async (pkg, user, transaction) => {
  const refs = [];
  const dataSources = Array.isArray(pkg.dataSources) ? pkg.dataSources : [];

  for (const source of dataSources) {
    if (source.type !== 'apiBuilder') continue;
    const slug = templateApiSlug(pkg.meta.slug, source.key);
    const marker = `${TEMPLATE_API_DESCRIPTION_PREFIX} template=${pkg.meta.slug} key=${source.key}`;
    const description = source.definition.description ? `${marker}\n${source.definition.description}` : marker;
    const payload = {
      name: source.definition.name,
      slug,
      description,
      isActive: source.definition.isActive !== false,
      config: normalizeTemplateApiConfig(source.definition.config),
      createdByTemplateId: pkg.meta.slug,
      updatedBy: user.id,
    };

    const existing = await ApiDefinition.findOne({ where: { slug }, transaction, paranoid: false });
    let api;
    if (existing) {
      const isOwnedByTemplate = existing.createdByTemplateId === pkg.meta.slug ||
        (!existing.createdByTemplateId && String(existing.description || '').includes(marker));
      if (!isOwnedByTemplate) {
        throw new AppError('VALIDATION_ERROR', 409, `API Builder slug '${slug}' already exists and is not owned by this template.`);
      }
      if (existing.deletedAt) await existing.restore({ transaction });
      await existing.update(payload, { transaction });
      api = existing;
    } else {
      api = await ApiDefinition.create({ ...payload, createdBy: user.id }, { transaction });
    }

    refs.push({ key: source.key, type: source.type, id: api.id, slug: api.slug, url: `/api/api-builder/public/${api.slug}` });
  }

  return refs;
};

// ─── Service Methods ────────────────────────────────────────────────────────

const listBuiltin = () => loadBuiltinFiles();

const listLibrary = async (query = {}) => {
  const where = {};
  if (query.source) where.source = query.source;
  if (query.category) where.category = query.category;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize, 10) || 20));
  const { count, rows } = await ThemePackage.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { themes: rows, total: count, page, pageSize, totalPages: Math.ceil(count / pageSize) };
};

const validateTemplateDataSources = (dataSources) => {
  if (!dataSources || !Array.isArray(dataSources)) return;

  const allowedResources = TEMPLATE_API_ALLOWED_RESOURCES;
  // Resources in the explicit blocklist that are NOT in the allowlist.
  // The previous substring check (lowerResource.includes('order') etc.)
  // was dead code — the allowlist check on line 374 has already rejected
  // any resource whose name contains those substrings, because none of
  // 'orders', 'orderItems', 'users', 'payments', 'shipping', 'taxes',
  // 'credentials', 'analytics', 'admins' are in TEMPLATE_API_ALLOWED_RESOURCES.
  const blockedResources = new Set([
    'settings', 'menus', 'menuItems', 'productVariants', 'productAttributes',
    'attributeTemplates', 'attributeValues'
  ]);

  const validateNode = (node, path, currentDepth = 1) => {
    if (!node || typeof node !== 'object') return;

    const resource = node.resource;
    if (!resource) {
      throw new AppError('VALIDATION_ERROR', 400, `${path}: Missing resource type.`);
    }

    // Check allowlist
    if (!allowedResources.has(resource)) {
      throw new AppError('VALIDATION_ERROR', 400, `${path}: Resource '${resource}' is not in the template allowlist.`);
    }

    // The exact-match blocklist below is redundant with the allowlist
    // check above for the historical substring list (orders, users,
    // payments, shipping, taxes, credentials, analytics, admins) — those
    // names are not in TEMPLATE_API_ALLOWED_RESOURCES and would already
    // have thrown on the previous line. The blocklist is kept for
    // defence-in-depth: if a future allowlist edit accidentally adds
    // e.g. 'adminAuditLog', this guard still rejects it.
    if (blockedResources.has(resource)) {
      throw new AppError('VALIDATION_ERROR', 400, `${path}: Resource '${resource}' is blocked for template access.`);
    }

    // Check field allowlist
    if (node.fields && Array.isArray(node.fields)) {
      const allowedFields = TEMPLATE_API_ALLOWED_FIELDS[resource] || new Set();
      for (const field of node.fields) {
        if (!allowedFields.has(field)) {
          throw new AppError('VALIDATION_ERROR', 400, `${path}: Field '${field}' is not allowed for resource '${resource}'. Allowed fields are: ${[...allowedFields].join(', ')}`);
        }
      }
    }

    // Check item limit
    if (node.limit !== undefined && node.limit !== null) {
      if (node.limit > 24) {
        throw new AppError('VALIDATION_ERROR', 400, `${path}: Limit ${node.limit} exceeds the maximum allowed section item limit of 24.`);
      }
    }

    // Check pagination defaultPageSize
    if (node.pagination && typeof node.pagination === 'object') {
      if (node.pagination.defaultPageSize > 50) {
        throw new AppError('VALIDATION_ERROR', 400, `${path}: Pagination defaultPageSize ${node.pagination.defaultPageSize} exceeds the maximum allowed page size of 50.`);
      }
    }

    // Check filters limit
    if (node.filters && Array.isArray(node.filters)) {
      if (node.filters.length > 10) {
        throw new AppError('VALIDATION_ERROR', 400, `${path}: Filters count ${node.filters.length} exceeds the maximum allowed filters limit of 10.`);
      }
    }

    // Check relation depth
    if (currentDepth > 2) {
      throw new AppError('VALIDATION_ERROR', 400, `${path}: Relation depth exceeds maximum limit of 2.`);
    }

    if (node.relations && Array.isArray(node.relations)) {
      node.relations.forEach((relNode, idx) => {
        validateNode(relNode, `${path}.relations[${idx}]`, currentDepth + 1);
      });
    }
  };

  dataSources.forEach((source, sIdx) => {
    if (source.type !== 'apiBuilder') return;
    const definition = source.definition;
    if (!definition || !definition.config) {
      throw new AppError('VALIDATION_ERROR', 400, `dataSources[${sIdx}]: Missing API Builder definition config.`);
    }

    const blocks = definition.config.blocks || [];
    if (blocks.length > 8) {
      throw new AppError('VALIDATION_ERROR', 400, `dataSources[${sIdx}].definition.config: Blocks count ${blocks.length} exceeds the maximum allowed limit of 8.`);
    }

    blocks.forEach((block, bIdx) => {
      validateNode(block, `dataSources[${sIdx}].definition.config.blocks[${bIdx}]`, 1);
    });
  });
};

const validatePackage = (data) => {
  const { error, value } = packageSchema.validate(data, { abortEarly: false, stripUnknown: false });
  if (error) {
    const messages = error.details.map(d => {
      const path = d.path.join('.');
      return path ? `${path}: ${d.message.replace(/^"[^"]*"\s*/, '')}` : d.message;
    });
    throw new AppError('VALIDATION_ERROR', 400, messages.join('; '));
  }
  validateTemplateDataSources(value.dataSources);
  return value;
};

const preview = async (packageData, scopes = ['design', 'layoutStyle']) => {
  const pkg = validatePackage(packageData);
  const groups = affectedGroups(scopes, scopes.includes('demoContent'));
  const currentSnapshot = await readCurrentSettings(groups);

  const rows = buildSettingsRows(pkg, scopes, scopes.includes('demoContent'));
  const mergedSettings = JSON.parse(JSON.stringify(currentSnapshot));
  const changes = [];

  for (const row of rows) {
    if (!mergedSettings[row.group]) mergedSettings[row.group] = {};
    const before = mergedSettings[row.group][row.key];
    if (JSON.stringify(before) !== JSON.stringify(row.value)) {
      changes.push({ group: row.group, key: row.key, before: before ?? null, after: row.value });
    }
    mergedSettings[row.group][row.key] = row.value;
  }

  return { mergedSettings, changes };
};

const importToLibrary = async (packageData, userId) => {
  const pkg = validatePackage(packageData);
  const existing = await ThemePackage.findOne({ where: { slug: pkg.meta.slug } });
  if (existing) {
    await existing.update({
      name: pkg.meta.name,
      version: pkg.meta.version,
      author: pkg.meta.author,
      description: pkg.meta.description,
      category: pkg.meta.category,
      tags: pkg.meta.tags,
      previewImage: pkg.meta.previewImage,
      packageData: pkg,
    });
    return existing;
  }
  return ThemePackage.create({
    slug: pkg.meta.slug,
    name: pkg.meta.name,
    version: pkg.meta.version,
    author: pkg.meta.author,
    description: pkg.meta.description,
    category: pkg.meta.category,
    tags: pkg.meta.tags,
    previewImage: pkg.meta.previewImage,
    packageData: pkg,
    source: 'imported',
    createdBy: userId,
  });
};

const exportCurrent = async (options = {}) => {
  const { includeHomepageSections = true, includeDemoContent = true, includeComponentStyles = true, includeSectionPresets = true } = options;
  const groups = ['theme', 'componentStyles', 'sectionPresets', 'nav', 'footer', 'announcement', 'homepage', 'productPage', 'catalog', 'brandsPage', 'cartPage', 'accountPage', 'blogPage'];
  const snapshot = await readCurrentSettings(groups);

  const pkg = {
    schemaVersion: 3,
    meta: {
      slug: 'custom-export',
      name: 'Custom Export',
      version: '1.0.0',
      author: 'Store Admin',
      description: 'Exported current store theme configuration.',
      category: 'general',
      tags: ['exported'],
      previewImage: null,
    },
    design: { theme: snapshot.theme || {} },
    layout: {
      nav: snapshot.nav || {},
      footerStyle: { bgColor: snapshot.footer?.bgColor, fgColor: snapshot.footer?.fgColor },
      announcementStyle: { bgColor: snapshot.announcement?.bgColor, fgColor: snapshot.announcement?.fgColor },
    },
  };

  if (includeComponentStyles) {
    pkg.componentStyles = snapshot.componentStyles || {};
  }

  if (includeSectionPresets) {
    pkg.sectionPresets = snapshot.sectionPresets || {};
  }

  if (includeHomepageSections) {
    pkg.layout.homepageSections = (snapshot.homepage?.sections || []).map((section) => {
      const { dataSourceKey, dataSourceSlug, ...exportableSection } = section;
      return exportableSection;
    });
  }

  pkg.pageTemplates = {
    product: {
      layout: snapshot.productPage?.templateLayout || 'media-left-details-right',
      showTrustBadges: snapshot.productPage?.showTrustBadges,
      showRelatedProducts: snapshot.productPage?.showRelatedProducts,
      showRecentlyViewed: snapshot.productPage?.showRecentlyViewed,
      showStickyAddToCart: snapshot.productPage?.showStickyAddToCart,
      showBreadcrumbs: snapshot.productPage?.showBreadcrumbs,
    },
    collection: {
      layout: snapshot.catalog?.templateLayout || 'sidebar-filters-grid',
      productsPerRow: snapshot.catalog?.gridColumns,
      filterLayout: snapshot.catalog?.filterLayout || 'sidebar',
      showBreadcrumbs: snapshot.catalog?.showBreadcrumbs,
    },
    brand: {
      layout: snapshot.brandsPage?.cardLayout || 'standard',
      title: snapshot.brandsPage?.heroTitle || 'Shop by Brand',
      subtitle: snapshot.brandsPage?.heroSubtitle || 'Discover products grouped by your favorite brands.',
      productsPerRow: snapshot.brandsPage?.gridColumns,
      imageAspectRatio: snapshot.brandsPage?.imageAspectRatio || 'square',
      cardStyle: snapshot.brandsPage?.cardStyle || 'inherit',
      cardBorderRadius: snapshot.brandsPage?.cardBorderRadius,
      showDescriptions: snapshot.brandsPage?.showDescriptions,
      showProductCount: snapshot.brandsPage?.showProductCount,
      showAlphabeticalFilter: snapshot.brandsPage?.showAlphabeticalFilter,
      showFeaturedSection: snapshot.brandsPage?.showFeaturedSection,
      featuredLayout: snapshot.brandsPage?.featuredLayout || 'banner',
      featuredCount: snapshot.brandsPage?.featuredCount,
    },
    cart: {
      layout: snapshot.cartPage?.layout || 'standard',
      showCrossSells: snapshot.cartPage?.showCrossSells,
      showTrustBadges: snapshot.cartPage?.showTrustBadges,
      emptyStateText: snapshot.cartPage?.emptyStateText,
    },
    account: {
      layout: snapshot.accountPage?.layout || 'tabs',
      orderCardStyle: snapshot.accountPage?.orderCardStyle || 'detailed',
      showSupportInfo: snapshot.accountPage?.showSupportInfo,
    },
    blog: {
      listLayout: snapshot.blogPage?.listLayout || 'grid',
      articleLayout: snapshot.blogPage?.articleLayout || 'standard',
      showAuthor: snapshot.blogPage?.showAuthor,
      showDate: snapshot.blogPage?.showDate,
    },
  };

  if (includeDemoContent) {
    pkg.demoContent = {
      announcementText: snapshot.announcement?.text || '',
      heroSlides: snapshot.homepage?.heroSlides || [],
      valueProps: snapshot.homepage?.valueProps || [],
      promoBanners: snapshot.homepage?.promoBanners || [],
    };
  }

  return pkg;
};

const apply = async (packageData, applyOptions, user) => {
  const { scopes = ['design', 'layoutStyle'], replaceDemoContent = false } = applyOptions;
  const pkg = validatePackage(packageData);
  const groups = affectedGroups(scopes, replaceDemoContent);

  const result = await sequelize.transaction(async (t) => {
    // Acquire row-level locks on all settings in the affected groups.
    // A concurrent apply will block here until this transaction commits/rolls back,
    // eliminating the TOCTOU window between read and write.
    const beforeSnapshot = await readCurrentSettings(groups, t, { lock: true });

    const dataSourceRefs = scopes.includes('dataSources') ? await upsertTemplateDataSources(pkg, user, t) : [];
    const rows = buildSettingsRows(pkg, scopes, replaceDemoContent, dataSourceRefs);

    if (!rows.length && !dataSourceRefs.length) throw new AppError('VALIDATION_ERROR', 400, 'No settings or data sources to apply for selected scopes.');

    if (rows.length) await SettingsService.bulkUpdate(rows, user.id, user, { transaction: t });

    const afterSnapshot = await readCurrentSettings(groups, t);

    // Find or reference the library package
    let themePackageId = null;
    const existing = await ThemePackage.findOne({ where: { slug: pkg.meta.slug }, transaction: t });
    if (existing) themePackageId = existing.id;

    const activation = await ThemeActivation.create({
      themePackageId,
      themeName: pkg.meta.name,
      themeVersion: pkg.meta.version,
      appliedScopes: scopes,
      beforeSnapshot,
      afterSnapshot,
      dataSourceRefs,
      appliedBy: user.id,
    }, { transaction: t });

    try {
      await AuditService.log({
        userId: user.id,
        action: 'UPDATE',
        entity: 'Theme',
        entityId: activation.id,
        changes: { themeName: pkg.meta.name, version: pkg.meta.version, scopes, dataSources: dataSourceRefs.map((ref) => ref.slug) },
      }, t);
    } catch (e) { /* audit failure must not break apply */ }

    return activation;
  });

  return result;
};

const listActivations = async () => {
  return ThemeActivation.findAll({
    order: [['created_at', 'DESC']],
    limit: 50,
    include: [
      { association: 'appliedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
      { association: 'rolledBackByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
    ],
  });
};

const rollback = async (activationId, user) => {
  // Take the row lock and rolledBackAt check INSIDE the transaction.
  // Previously this happened before the transaction, so two concurrent
  // rollback requests could both pass the check and both write back the
  // same snapshot. The apply path at readCurrentSettings already uses
  // the same lock pattern (see LOCK.UPDATE on apply).
  return sequelize.transaction(async (t) => {
    const activation = await ThemeActivation.findByPk(activationId, {
      transaction: t,
      lock: t.LOCK ? t.LOCK.UPDATE : 'UPDATE',
    });
    if (!activation) throw new AppError('NOT_FOUND', 404, 'Activation not found.');
    if (activation.rolledBackAt) throw new AppError('VALIDATION_ERROR', 400, 'This activation has already been rolled back.');

    const snapshot = activation.beforeSnapshot;
    const rows = [];
    for (const [group, keys] of Object.entries(snapshot)) {
      for (const [key, value] of Object.entries(keys)) {
        rows.push({ key, value, group });
      }
    }

    if (rows.length) await SettingsService.bulkUpdate(rows, user.id, user, { transaction: t });

    for (const ref of activation.dataSourceRefs || []) {
      const api = await ApiDefinition.findByPk(ref.id, { transaction: t });
      if (api && (api.createdByTemplateId || String(api.description || '').includes(TEMPLATE_API_DESCRIPTION_PREFIX))) {
        await api.update({ isActive: false, updatedBy: user.id }, { transaction: t });
      }
    }

    await activation.update({ rolledBackAt: new Date(), rolledBackBy: user.id }, { transaction: t });

    try {
      await AuditService.log({
        userId: user.id,
        action: 'UPDATE',
        entity: 'Theme',
        entityId: activationId,
        changes: { action: 'rollback', themeName: activation.themeName },
      }, t);
    } catch (e) { /* audit failure must not break rollback */ }

    return activation.reload({ transaction: t });
  });
};

const removeLibraryTheme = async (id, userId) => {
  const pkg = await ThemePackage.findByPk(id);
  if (!pkg) throw new AppError('NOT_FOUND', 404, 'Theme package not found.');
  if (pkg.source === 'builtin') throw new AppError('VALIDATION_ERROR', 400, 'Cannot delete built-in themes.');
  await pkg.destroy();
  return true;
};

const getStoreStatus = async () => {
  const [orderCount, productCount] = await Promise.all([
    Order ? Order.count() : 0,
    Product ? Product.count() : 0,
  ]);
  return { isEmpty: orderCount === 0 && productCount < 5, orderCount, productCount };
};

// Pre-populate built-in themes cache at startup
try {
  loadBuiltinFiles();
} catch (err) {
  console.error('Failed to pre-populate built-in themes cache at startup:', err);
}

module.exports = {
  listBuiltin,
  listLibrary,
  validatePackage,
  preview,
  importToLibrary,
  exportCurrent,
  apply,
  listActivations,
  rollback,
  removeLibraryTheme,
  getStoreStatus,
};

