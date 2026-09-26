'use strict';

const applyProductStorefrontFilters = (where, filters = {}, isAdmin = false) => {
  if (!isAdmin) {
    where.status = 'published';
    where.isEnabled = true;
    return where;
  }

  if (filters.status === 'published') {
    where.status = 'published';
    where.isEnabled = true;
  } else if (filters.status === 'paused') {
    where.status = 'published';
    where.isEnabled = false;
  } else if (filters.status) {
    where.status = filters.status;
  }

  if (filters.isEnabled !== undefined) {
    where.isEnabled = filters.isEnabled === 'true' || filters.isEnabled === true;
  }

  return where;
};

const buildProductStorefrontCountsWhere = (where, filters = {}) => {
  const countWhere = { ...where };
  delete countWhere.status;
  if (filters.status === 'published' || filters.status === 'paused') {
    delete countWhere.isEnabled;
  }
  return countWhere;
};

const mapProductStorefrontCounts = (statusCounts = []) => statusCounts.reduce((acc, curr) => {
  const isEnabled = curr.isEnabled === true || curr.isEnabled === 'true';
  const state = curr.status === 'published'
    ? (isEnabled ? 'published' : 'paused')
    : curr.status;
  acc[state] = (acc[state] || 0) + parseInt(curr.count || 0, 10);
  return acc;
}, { published: 0, paused: 0, draft: 0, archived: 0 });

module.exports = {
  applyProductStorefrontFilters,
  buildProductStorefrontCountsWhere,
  mapProductStorefrontCounts,
};
