'use strict';

const { sequelize, Setting } = require('../index');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { buildFeatures, isTier1Feature, TIER1_KEYS } = require('../../config/modes');
const { invalidateFeature } = require('../../middleware/featureGate.middleware');

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { encrypt, decrypt } = require('../../utils/crypto');

// Read local config/default.json for fallback defaults
// Path: server/src/modules/settings/ → ../../../config/default.json = server/config/default.json
let defaultSettings = {};
const configPath = path.resolve(__dirname, '../../../../config/default.json');

if (fs.existsSync(configPath)) {
    try {
        defaultSettings = require(configPath);
    } catch (e) {
        logger.error('Failed to parse default.json', e);
    }
} else {
    logger.warn(`WARNING: Default settings file not found at ${configPath}. Using empty defaults.`);
}

const getAll = async () => {
  const settings = await Setting.findAll();
  
  // Group settings by group type
  const grouped = {
    theme: { ...defaultSettings.theme },
    features: { ...defaultSettings.features },
    payments: { ...defaultSettings.payments },
    sales: { ...defaultSettings.sales },
    seo: { ...defaultSettings.seo },
    general: { ...defaultSettings.general },
    shipping: { ...defaultSettings.shipping },
    tax: { ...defaultSettings.tax },
    sku: { ...defaultSettings.sku },
    logo: { ...defaultSettings.logo },
    hero: { ...defaultSettings.hero },
    footer: { ...defaultSettings.footer },
    announcement: { ...defaultSettings.announcement },
    nav: { ...defaultSettings.nav },
    catalog: { ...defaultSettings.catalog },
    homepage: { ...defaultSettings.homepage },
    productPage: { ...defaultSettings.productPage },
    admin: { ...defaultSettings.admin },
    invoice: { ...defaultSettings.invoice },
    messaging: { ...defaultSettings.messaging },
    gateway_credentials: { ...defaultSettings.gateway_credentials },
    messaging_credentials: { ...defaultSettings.messaging_credentials },
  };

  settings.forEach(s => {
    if (grouped[s.group]) {
      let parsedValue = s.value;

      // Auto-decrypt if it's an encrypted object (credentials)
      if (typeof parsedValue === 'object' && parsedValue !== null && parsedValue.ciphertext) {
        try {
          parsedValue = decrypt(parsedValue);
        } catch (err) {
          logger.error(`Failed to decrypt setting ${s.key}:`, err);
          parsedValue = null;
        }
      }

      // Mask sensitive values before sending to client
      const isSensitive = /pass|token|secret|key_secret|private/i.test(s.key) && !/id|public|publishable/i.test(s.key);
      if (isSensitive && parsedValue) {
        parsedValue = '********';
      }

      if (parsedValue === 'true') parsedValue = true;
      else if (parsedValue === 'false') parsedValue = false;
      grouped[s.group][s.key] = parsedValue;
    }
  });

  return grouped;
};

const getByGroup = async (groupName) => {
  const validGroups = ['theme', 'features', 'payments', 'sales', 'seo', 'general', 'shipping', 'tax', 'sku', 'logo', 'hero', 'footer', 'announcement', 'nav', 'catalog', 'homepage', 'productPage', 'admin', 'invoice', 'gateway_credentials', 'messaging_credentials', 'messaging'];
  if (!validGroups.includes(groupName)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid setting group');
  }

  const settings = await Setting.findAll({ where: { group: groupName } });
  
  const result = { ...(defaultSettings[groupName] || {}) };
  settings.forEach(s => {
    let parsedValue = s.value;

    // Auto-decrypt if it's an encrypted object
    if (typeof parsedValue === 'object' && parsedValue !== null && parsedValue.ciphertext) {
        try {
            parsedValue = decrypt(parsedValue);
        } catch (err) {
            logger.error(`Failed to decrypt setting ${s.key}:`, err);
            parsedValue = null;
        }
    }

    if (parsedValue === 'true') parsedValue = true;
    else if (parsedValue === 'false') parsedValue = false;
    
    // Mask sensitive values
    const isSensitive = /pass|token|secret|key_secret|private/i.test(s.key) && !/id|public|publishable/i.test(s.key);
    if (isSensitive && parsedValue) {
        parsedValue = '********';
    }

    result[s.key] = parsedValue;
  });

  return result;
};

const updateKey = async (key, value, group, actingUserId) => {
  const credentialGroups = ['gateway_credentials', 'messaging_credentials'];

  // Tier 1 feature keys are mode-locked — reject any attempt to modify them via settings.
  // This is the server-side enforcement regardless of who calls the API.
  if (group === 'features' && isTier1Feature(key)) {
    throw new AppError(
      'FEATURE_LOCKED',
      403,
      `Feature '${key}' is controlled by store mode and cannot be modified via settings.`
    );
  }

  // Capture the transaction result so we can invalidate the feature cache
  // AFTER it commits — ensuring we never bust the cache on a rollback.
  const result = await sequelize.transaction(async (t) => {
    let setting = await Setting.findOne({ where: { key }, transaction: t });
    let before = setting ? setting.toJSON() : null;

    if (value !== null && value !== undefined && String(value).trim() === '********') return null;

    // Auto-encrypt if it's a credential group and value is not empty
    let finalValue = value;
    if (credentialGroups.includes(group) && value !== null && value !== undefined && String(value).trim() !== '') {
        finalValue = encrypt(String(value).trim());
    }

    if (setting) {
      await setting.update({ value: finalValue, updatedBy: actingUserId }, { transaction: t });
    } else {
      if (!group) throw new AppError('VALIDATION_ERROR', 400, 'Group is required for new settings');
      setting = await Setting.create({ key, value: finalValue, group, updatedBy: actingUserId }, { transaction: t });
    }

    // Attempt to log but wrap in try/catch in case Audit Logs aren't fully migrated yet 
    // or AuditService is not fully implemented in Phase 1
    try {
        if (AuditService && AuditService.log) {
            await AuditService.log({
                userId: actingUserId,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.SETTING,
                entityId: key,
                changes: { before, after: setting.toJSON() }
            }, t);
        }
    } catch(err) {
        // ignore if audit fails
    }

    return setting;
  });

  // Bust the feature cache after the transaction commits so the next gated
  // request immediately picks up the new value without waiting for TTL expiry.
  if (group === 'features') invalidateFeature(key);

  return result;
};

const bulkUpdate = async (settingsInput, actingUserId, actingUser = null) => {
  const validGroups = ['theme', 'features', 'payments', 'sales', 'seo', 'general', 'shipping', 'tax', 'sku', 'logo', 'hero', 'footer', 'announcement', 'nav', 'catalog', 'homepage', 'productPage', 'admin', 'invoice', 'gateway_credentials', 'messaging_credentials', 'messaging'];
  const credentialGroups = ['gateway_credentials', 'messaging_credentials'];

    // Normalize input to an array of { key, value, group }
    const settingsArray = Array.isArray(settingsInput) 
        ? settingsInput 
        : Object.entries(settingsInput).map(([key, value]) => ({ key, value }));

    // ── Superadmin guard ─────────────────────────────────────────────────────
    // Tier 2 feature toggles (group === 'features', non-Tier-1 keys) may only
    // be written by a super_admin. Regular admins can save everything else.
    const hasFeatureKeys = settingsArray.some(
      ({ key, group }) => (group || 'general') === 'features' && !isTier1Feature(key)
    );
    if (hasFeatureKeys) {
      const actingRoles = actingUser?.roles || (actingUser?.role ? [actingUser.role] : []);
      const isSuperAdmin = actingRoles.includes('super_admin');
      if (!isSuperAdmin) {
        throw new AppError(
          'SUPERADMIN_REQUIRED',
          403,
          'Only Super Admins can modify platform feature toggles.'
        );
      }
    }

    await sequelize.transaction(async (t) => {
        let updatedCount = 0;
        for (let { key, value, group } of settingsArray) {
            // Resolve the group for this key upfront so lookups are always scoped
            // to (key + group) — prevents different groups sharing the same key name
            // from accidentally overwriting each other's DB row.
            let resolvedGroup = group || 'general';

            // Tier 1 feature keys are mode-locked — silently skip them in bulk updates.
            // We don't throw here because bulk saves include everything; the frontend
            // should never send Tier 1 keys but we defend against it server-side.
            if (resolvedGroup === 'features' && isTier1Feature(key)) continue;
            if (!group) {
                for (const g of validGroups) {
                    if (defaultSettings[g] && defaultSettings[g][key] !== undefined) {
                        resolvedGroup = g;
                        break;
                    }
                }
            }

            // Auto-encrypt if it's a credential group and value is not empty
            let finalValue = value;
            if (credentialGroups.includes(resolvedGroup) && value !== null && value !== undefined && String(value).trim() !== '') {
                finalValue = encrypt(String(value).trim());
            }

            // Skip updating if the value is the sensitive placeholder (means it wasn't changed)
            if (value === '********') continue;

            // Look up by (key, group) — not key alone — to avoid cross-group collisions
            let setting = await Setting.findOne({ where: { key, group: resolvedGroup }, transaction: t });
            
            if (setting) {
                await setting.update({ value: finalValue, updatedBy: actingUserId }, { transaction: t });
                updatedCount++;
            } else {
                await Setting.create({ key, value: finalValue, group: resolvedGroup, updatedBy: actingUserId }, { transaction: t });
                updatedCount++;
            }
        }
        
        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: 'UPDATE',
                    entity: 'Setting',
                    entityId: 'bulk',
                    changes: { updatedCount }
                }, t);
            }
        } catch(err) {}
    });

    // Bust feature cache for any feature-group key that was updated
    for (const { key, group } of settingsArray) {
        if (!group || group === 'features' || key === 'mode') {
            if (key === 'mode') {
                // If mode changes, we should ideally invalidate the whole feature cache
                // But for now, we just invalidate the specific key; we might need a flush cache mechanism
                const { invalidateFeature } = require('../../middleware/featureGate.middleware');
                invalidateFeature(key); // We can just clear it, but maybe better to call something else or let loadAndCacheAllFeatures refresh it.
                // Actually `invalidateFeature` clears memory cache for a key. If mode changes, all features change.
            } else {
                const { invalidateFeature } = require('../../middleware/featureGate.middleware');
                invalidateFeature(key);
            }
        }
    }

    return true;
};

/**
 * Returns the fully resolved feature map for the current APP_MODE.
 * Combines DB feature settings (optional features) with the mode's
 * non-overridable core features. Mode always wins.
 *
 * This is the authoritative source for GET /api/features.
 *
 * @returns {Promise<Record<string, boolean>>}
 */
/**
 * Returns the fully resolved feature map for the current APP_MODE plus metadata
 * the frontend needs to render locked vs. toggleable feature controls:
 *   - features:   fully resolved map (Tier2Defaults + DB + Tier1)
 *   - lockedKeys: array of Tier 1 key names (shown greyed-out in Settings UI)
 *
 * @returns {Promise<{ features: Record<string, boolean>, lockedKeys: string[] }>}
 */
const getFeatures = async () => {
    const rows = await Setting.findAll({ where: { group: 'features' } });
    const modeRow = await Setting.findOne({ where: { group: 'general', key: 'mode' } });
    const appMode = modeRow ? modeRow.value : 'ecommerce';

    const dbFeatures = {};
    for (const row of rows) {
        dbFeatures[row.key] = row.value === true || row.value === 'true';
    }

    return {
        features:   buildFeatures(dbFeatures, appMode),
        lockedKeys: [...TIER1_KEYS],   // frontend uses this to grey out Tier 1 toggles
        mode:       appMode            // Make sure the mode is exposed to the frontend
    };
};

module.exports = { getAll, getByGroup, updateKey, bulkUpdate, getFeatures };
