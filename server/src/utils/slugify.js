'use strict';

/**
 * Generate a URL-friendly slug from a string.
 * Handles collision detection by appending -1, -2, etc.
 *
 * @param {string} text - The text to slugify
 * @param {object} Model - Sequelize model to check for collisions
 * @param {string} field - The field name to check (default: 'slug')
 * @param {object} options - Optional collision query settings and maximum slug length
 * @returns {Promise<string>} A unique slug
 */
const generateSlug = async (text, Model = null, field = 'slug', options = {}) => {
    const slug = text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[_\s]+/g, '-')    // spaces and underscores → hyphens
        .replace(/[^\w-]+/g, '')    // remove non-word chars
        .replace(/_/g, '-')         // ensure no underscores remain
        .replace(/--+/g, '-')       // collapse multiple hyphens
        .replace(/^-+/, '')         // trim leading hyphens
        .replace(/-+$/, '');        // trim trailing hyphens

    const maxLength = options.maxLength ?? Infinity;
    const truncate = (length) => slug.slice(0, length).replace(/-+$/, '');
    if (!Model) return truncate(maxLength);

    // Check for collisions
    let candidate = truncate(maxLength);
    let counter = 1;
    while (await Model.findOne({ 
        where: { [field]: candidate, ...(options.where || {}) }, 
        transaction: options.transaction,
        paranoid: options.paranoid ?? false // Keep deleted slugs reserved unless the caller explicitly permits reuse.
    })) {
        const suffix = `-${counter}`;
        candidate = `${truncate(maxLength - suffix.length)}${suffix}`;
        counter++;
    }

    return candidate;
};

module.exports = { generateSlug };
