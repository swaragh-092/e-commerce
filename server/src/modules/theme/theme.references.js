'use strict';

const { ApiDefinition, Brand, Category, Gallery, Media, Page, Product, Tag } = require('../index');

const slugFields = {
  categorySlug: Category,
  selectedCategorySlugs: Category,
  brandSlug: Brand,
  selectedBrandSlugs: Brand,
  productSlug: Product,
  tagSlug: Tag,
  tagSlugs: Tag,
  gallerySlug: Gallery,
  pageSlug: Page,
  dataSourceSlug: ApiDefinition,
};
const menuRoutes = { category: Category, brands: Brand, products: Product, p: Page, tags: Tag };
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function collectReferences(value, path = [], result = []) {
  if (!value || typeof value !== 'object') return result;
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = [...path, Array.isArray(value) ? Number(key) : key];
    if (path[0] === 'layout' && path[1] === 'nav' && path[2] === 'headerLinks' && key === 'url' && typeof entry === 'string') {
      const link = /^\/(category|brands|products|p|tags)\/([a-z0-9-]+)(?:[?#].*)?$/.exec(entry);
      if (link) result.push({ model: menuRoutes[link[1]], field: 'slug', value: entry, lookupValue: link[2], path: nextPath });
      continue;
    }
    if (path.at(-1) === 'query' && typeof entry === 'string' && ['category', 'categoryId', 'brand'].includes(key)) {
      const field = key === 'categoryId' || (key === 'brand' && uuid.test(entry)) ? 'id' : 'slug';
      if (field === 'id' && !uuid.test(entry)) continue;
      result.push({ model: key === 'brand' ? Brand : Category, field, value: entry, path: nextPath });
      continue;
    }
    const model = Object.hasOwn(slugFields, key) ? slugFields[key] : undefined;
    if (model) {
      const values = Array.isArray(entry) ? entry : [entry];
      for (const [index, slug] of values.entries()) {
        if (typeof slug === 'string' && slug) result.push({ model, field: 'slug', value: slug, path: Array.isArray(entry) ? [...nextPath, index] : nextPath });
      }
    } else if (key === 'productIds' && Array.isArray(entry)) {
      entry.forEach((id, index) => {
        if (typeof id === 'string' && uuid.test(id)) result.push({ model: Product, field: 'id', value: id, path: [...nextPath, index] });
      });
    } else if (typeof entry === 'string' && /^(?:\/uploads\/|\/media\/)/.test(entry) &&
      ['image', 'url', 'mobileUrl', 'logoUrl', 'previewImage', 'backgroundImage'].includes(key)) {
      result.push({ model: Media, field: 'url', value: entry, path: nextPath });
    } else {
      collectReferences(entry, nextPath, result);
    }
  }
  return result;
}

async function inspectThemeReferences(packageData) {
  const references = collectReferences(packageData);
  const groups = new Map();
  for (const reference of references) {
    const key = `${reference.model.name}:${reference.field}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(reference);
  }
  return (await Promise.all([...groups.values()].map(async (group) => {
    const { model, field } = group[0];
    const values = [...new Set(group.map((reference) => reference.lookupValue ?? reference.value))];
    const records = await model.findAll({ where: { [field]: values, ...(model === ApiDefinition && { isActive: true }) }, attributes: [field] });
    const resolved = new Set(records.map((record) => record[field]));
    return group.map(({ path, value, lookupValue }) => ({
      path, value, resource: model.name.toLowerCase(), resolved: resolved.has(lookupValue ?? value),
    }));
  }))).flat();
}

module.exports = { inspectThemeReferences };
