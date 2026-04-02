'use strict';

/**
 * Calculates offset and limit for pagination
 * @param {number|string} page - Current page number (1-indexed)
 * @param {number|string} limit - Items per page
 * @returns {Object} { limit, offset }
 */
const getPagination = (page = 1, limit = 20) => {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, parseInt(limit, 10) || 20);
  
  // Cap max limit to 100 to prevent large queries
  const finalLimit = Math.min(parsedLimit, 100);
  const offset = (parsedPage - 1) * finalLimit;

  return { limit: finalLimit, offset };
};

/**
 * Formats a paginated response
 * @param {Array} data - The items
 * @param {number} totalItems - Total count across all pages
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} meta object
 */
const getPagingData = (data, totalItems, page, limit) => {
  const currentPage = page ? parseInt(page, 10) : 1;
  const totalPages = Math.ceil(totalItems / limit);

  return {
    totalItems,
    data,
    totalPages,
    currentPage,
  };
};

module.exports = { getPagination, getPagingData };
