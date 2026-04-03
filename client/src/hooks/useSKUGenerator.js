import { useContext } from 'react';
import { SettingsContext } from '../context/ThemeContext';

/**
 * Reads the `sku` settings group and exposes two generator functions:
 *
 *   generateProductSKU(productName)
 *     → e.g. "SHOP-TSHIRT" or "SHOP-TSHIRT-A3X7" (with random)
 *
 *   generateVariantSKU(baseSKU, attributeName, attributeValue)
 *     → e.g. "SHOP-TSHIRT-COLOR-RED" (based on variant settings)
 */
const useSKUGenerator = () => {
  const { settings } = useContext(SettingsContext) || {};
  const sku = settings?.sku || {};

  const prefix = (sku.prefix || '').trim();
  const sep = sku.separator !== undefined ? sku.separator : '-';
  const includeProductName = sku.includeProductName !== false;
  const includeAttributeName = sku.includeAttributeName === true;
  const includeAttributeValue = sku.includeAttributeValue !== false;
  const autoUppercase = sku.autoUppercase !== false;
  const useRandom = sku.useRandom === true;
  const randomLength = Math.max(2, Math.min(8, parseInt(sku.randomLength, 10) || 4));

  const clean = (str) => {
    const s = String(str || '')
      .trim()
      .replace(/[^a-zA-Z0-9]/g, sep || '')   // replace non-alphanum with separator
      .replace(new RegExp(`[${sep ? sep.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') : ''}]{2,}`, 'g'), sep) // deduplicate
      .slice(0, 12);
    return autoUppercase ? s.toUpperCase() : s;
  };

  const randomChars = (len) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let r = '';
    for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return r;
  };

  const join = (...parts) =>
    parts.filter(Boolean).join(sep);

  /**
   * Generate a base product SKU from the product name.
   * @param {string} productName
   * @returns {string}
   */
  const generateProductSKU = (productName) => {
    const parts = [];
    if (prefix) parts.push(autoUppercase ? prefix.toUpperCase() : prefix);
    if (includeProductName && productName) {
      // Use first word, max 8 chars
      const nameCode = clean((productName.trim().split(/\s+/)[0] || productName).slice(0, 8));
      if (nameCode) parts.push(nameCode);
    }
    if (useRandom) parts.push(randomChars(randomLength));
    return join(...parts) || randomChars(6);
  };

  /**
   * Generate a variant SKU, building on top of the product's base SKU.
   * @param {string} baseSKU   - the product's base SKU (already generated)
   * @param {string} attrName  - e.g. "Color"
   * @param {string} attrValue - e.g. "Red"
   * @returns {string}
   */
  const generateVariantSKU = (baseSKU, attrName, attrValue) => {
    const parts = [baseSKU || generateProductSKU('')];
    if (includeAttributeName && attrName) parts.push(clean(attrName));
    if (includeAttributeValue && attrValue) parts.push(clean(attrValue));
    return join(...parts);
  };

  return { generateProductSKU, generateVariantSKU };
};

export default useSKUGenerator;
