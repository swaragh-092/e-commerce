'use strict';

/**
 * Generate a URL-friendly slug from a string.
 * Handles collision detection by appending -1, -2, etc.
 *
 * @param {string} text - The text to slugify
 * @param {object} Model - Sequelize model to check for collisions
 * @param {string} field - The field name to check (default: 'slug')
 * @returns {Promise<string>} A unique slug
 */
const generateSlug = async (text, Model = null, field = 'slug') => {
    let slug = text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')       // spaces → hyphens
        .replace(/[^\w-]+/g, '')    // remove non-word chars
        .replace(/--+/g, '-')       // collapse multiple hyphens
        .replace(/^-+/, '')         // trim leading hyphens
        .replace(/-+$/, '');        // trim trailing hyphens

    if (!Model) return slug;

    // Check for collisions
    let candidate = slug;
    let counter = 1;
    while (await Model.findOne({ where: { [field]: candidate } })) {
        candidate = `${slug}-${counter}`;
        counter++;
    }

    return candidate;
};

module.exports = { generateSlug };
