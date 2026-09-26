'use strict';

const { sequelize, Setting } = require('../index');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { buildFeatures, isTier1Feature, TIER1_KEYS } = require('../../config/modes');
const { getPermissionsForUser, PERMISSIONS } = require('../../config/permissions');
const { invalidateFeature } = require('../../middleware/featureGate.middleware');
const { DESIGN_SETTINGS_GROUPS, isDesignSettingTarget } = require('./designSettings');

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { encrypt, decrypt } = require('../../utils/crypto');

const isMaskedSecretPlaceholder = (value) =>
  typeof value === 'string' && value.trim() === '********';

const isSensitiveSettingKey = (key) => {
  const normalizedKey = String(key || '').toLowerCase();
  const isSecret = /pass|token|secret|api[_-]?key|privatekey/i.test(normalizedKey);
  const isPublicIdentifier = /id|public|publishable/i.test(normalizedKey);
  return isSecret && !isPublicIdentifier;
};

const PAYMENT_GATEWAY_ENABLED_KEYS = {
  razorpayEnabled: 'razorpay',
  cashfreeEnabled: 'cashfree',
  stripeEnabled: 'stripe',
  payuEnabled: 'payu',
  codEnabled: 'cod',
};

const isTruthySetting = (value) => value === true || value === 'true';

const hasAdvancedSettingsPermission = (user) =>
  getPermissionsForUser(user || {}).includes(PERMISSIONS.SETTINGS_ADVANCED);

const isAdvancedSettingsGroup = (group) =>
  ['advanced', 'ai', 'ai_credentials'].includes(group);

const ensureAdvancedSettingsAllowed = (settingsArray, actingUser) => {
  const touchesAdvanced = settingsArray.some(({ key, group }) =>
    isAdvancedSettingsGroup(resolveSettingGroup(key, group))
  );
  if (touchesAdvanced && !hasAdvancedSettingsPermission(actingUser)) {
    throw new AppError(
      'SETTINGS_ADVANCED_REQUIRED',
      403,
      'Advanced settings require the settings.advanced permission.'
    );
  }
};

const resolveSettingGroup = (key, group) => {
  if (group) return group;
  for (const candidateGroup of Object.keys(defaultSettings || {})) {
    if (defaultSettings[candidateGroup]?.[key] !== undefined) return candidateGroup;
  }
  return 'general';
};

const ensurePaymentGatewaySettingsAreValid = async (settingsArray) => {
  const touchesPayments = settingsArray.some(({ key, group }) => {
    const resolvedGroup = resolveSettingGroup(key, group);
    return resolvedGroup === 'payments' && (
      PAYMENT_GATEWAY_ENABLED_KEYS[key] || key === 'defaultMethod'
    );
  });

  if (!touchesPayments) return;

  const currentPayments = await getByGroup('payments', { maskSensitive: false });
  const nextPayments = { ...currentPayments };

  for (const { key, value, group } of settingsArray) {
    const resolvedGroup = resolveSettingGroup(key, group);
    if (resolvedGroup === 'payments' && value !== null && value !== undefined) {
      nextPayments[key] = value;
    }
  }

  const PaymentService = require('../payment/payment.service');
  const statuses = await PaymentService.getGatewayStatuses();
  const statusById = new Map(statuses.map((gateway) => [gateway.id, gateway]));

  for (const { key, value, group } of settingsArray) {
    const resolvedGroup = resolveSettingGroup(key, group);
    const gatewayId = PAYMENT_GATEWAY_ENABLED_KEYS[key];
    const wasEnabled = isTruthySetting(currentPayments[key]);
    const willBeEnabled = isTruthySetting(value);
    if (resolvedGroup !== 'payments' || !gatewayId || !willBeEnabled || wasEnabled) continue;

    const gateway = statusById.get(gatewayId);
    if (!gateway?.connected) {
      throw new AppError(
        'PAYMENT_GATEWAY_SETUP_REQUIRED',
        400,
        `${gateway?.name || gatewayId} must be configured before it can be enabled.`
      );
    }
  }

  const defaultMethodUpdate = settingsArray.find(({ key, group }) =>
    resolveSettingGroup(key, group) === 'payments' && key === 'defaultMethod'
  );
  const defaultMethod = nextPayments.defaultMethod;
  const defaultMethodChanged = defaultMethodUpdate && defaultMethod !== currentPayments.defaultMethod;
  if (defaultMethodChanged && defaultMethod) {
    const defaultEnabledKey = `${defaultMethod}Enabled`;
    const defaultGateway = statusById.get(defaultMethod);

    if (!PAYMENT_GATEWAY_ENABLED_KEYS[defaultEnabledKey] || !defaultGateway) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid default payment method.');
    }

    if (!isTruthySetting(nextPayments[defaultEnabledKey])) {
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        'Default payment method must be enabled first.'
      );
    }

    if (!defaultGateway.connected) {
      throw new AppError(
        'PAYMENT_GATEWAY_SETUP_REQUIRED',
        400,
        `${defaultGateway.name} must be configured before it can be the default payment method.`
      );
    }
  }
};

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
    componentStyles: { ...defaultSettings.componentStyles },
    sectionPresets: { ...defaultSettings.sectionPresets },
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
    auth: { ...defaultSettings.auth },
    footer: { ...defaultSettings.footer },
    announcement: { ...defaultSettings.announcement },
    nav: { ...defaultSettings.nav },
    catalog: { ...defaultSettings.catalog },
    homepage: { ...defaultSettings.homepage },
    productPage: { ...defaultSettings.productPage },
    categoryPage: { ...defaultSettings.categoryPage },
    blogPage: { ...defaultSettings.blogPage },
    brandsPage: { ...defaultSettings.brandsPage },
    cartPage: { ...defaultSettings.cartPage },
    accountPage: { ...defaultSettings.accountPage },
    checkoutPage: { ...defaultSettings.checkoutPage },
    wishlistPage: { ...defaultSettings.wishlistPage },
    searchPage: { ...defaultSettings.searchPage },
    notFoundPage: { ...defaultSettings.notFoundPage },
    ordersPage: { ...defaultSettings.ordersPage },
    admin: { ...defaultSettings.admin },
    invoice: { ...defaultSettings.invoice },
    messaging: { ...defaultSettings.messaging },
    gateway_credentials: { ...defaultSettings.gateway_credentials },
    messaging_credentials: { ...defaultSettings.messaging_credentials },
    ai: { ...defaultSettings.ai },
    ai_credentials: { ...defaultSettings.ai_credentials },
    advanced: { ...defaultSettings.advanced },
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
      if (isSensitiveSettingKey(s.key) && parsedValue) {
        parsedValue = '********';
      }

      if (parsedValue === 'true') parsedValue = true;
      else if (parsedValue === 'false') parsedValue = false;
      grouped[s.group][s.key] = parsedValue;
    }
  });

  return grouped;
};

const getByGroup = async (groupName, options = {}) => {
  const { maskSensitive = true } = options;
  const validGroups = ['theme', 'componentStyles', 'sectionPresets', 'features', 'payments', 'sales', 'seo', 'general', 'shipping', 'tax', 'sku', 'logo', 'hero', 'auth', 'footer', 'announcement', 'nav', 'catalog', 'homepage', 'productPage', 'categoryPage', 'blogPage', 'brandsPage', 'cartPage', 'accountPage', 'checkoutPage', 'wishlistPage', 'searchPage', 'notFoundPage', 'ordersPage', 'admin', 'invoice', 'gateway_credentials', 'messaging_credentials', 'messaging', 'ai', 'ai_credentials', 'advanced'];
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
    
    // Mask sensitive values for client-facing reads. Internal services can opt
    // out so encrypted credentials remain usable by SMTP/Twilio senders.
    if (maskSensitive && isSensitiveSettingKey(s.key) && parsedValue) {
      parsedValue = '********';
    }

    result[s.key] = parsedValue;
  });

  return result;
};

/**
 * Return resolved visual settings together with whether each value comes from
 * the server default or a persisted store override. The normal settings
 * endpoints intentionally keep returning the existing resolved shape; this
 * metadata is opt-in for Store Designer only.
 */
const getDesignState = async () => {
  const groups = {};
  const sources = {};
  const defaultsByGroup = {};

  const groupEntries = await Promise.all(DESIGN_SETTINGS_GROUPS.map(async (groupName) => {
    const defaults = { ...(defaultSettings[groupName] || {}) };
    const rows = await Setting.findAll({ where: { group: groupName } });
    const values = { ...defaults };
    const groupSources = Object.fromEntries(Object.keys(defaults).map((key) => [key, 'default']));

    rows.forEach((row) => {
      let parsedValue = row.value;
      if (parsedValue === 'true') parsedValue = true;
      else if (parsedValue === 'false') parsedValue = false;
      values[row.key] = parsedValue;
      groupSources[row.key] = 'custom';
    });

    return [groupName, { values, sources: groupSources }];
  }));

  groupEntries.forEach(([groupName, state]) => {
    groups[groupName] = state.values;
    sources[groupName] = state.sources;
    defaultsByGroup[groupName] = { ...(defaultSettings[groupName] || {}) };
  });

  const customCss = await Setting.findOne({ where: { group: 'advanced', key: 'customCSS' } });
  groups.advanced = { customCSS: customCss?.value || '' };
  sources.advanced = { customCSS: customCss ? 'custom' : 'default' };
  defaultsByGroup.advanced = { customCSS: defaultSettings.advanced?.customCSS || '' };

  return { groups, sources, defaults: defaultsByGroup };
};

/**
 * Remove only a visual override so the existing server default becomes
 * effective again. The group/key guard is deliberately stricter than the
 * generic settings update API.
 */
const resetDesignSetting = async ({ group, key }, actingUserId) => {
  if (!isDesignSettingTarget(group, key)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Only visual design settings can be reset.');
  }
  if (group === 'advanced' && key !== 'customCSS') {
    throw new AppError('VALIDATION_ERROR', 400, 'Only custom CSS can be reset from Store Designer.');
  }

  const where = { group };
  if (key) where.key = key;

  const deletedCount = await sequelize.transaction(async (t) => {
    const deleted = await Setting.destroy({ where, transaction: t });
    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId: actingUserId,
          action: ACTIONS.UPDATE,
          entity: ENTITIES.SETTING,
          entityId: key ? `${group}.${key}` : group,
          changes: { reset: true, group, key: key || null },
        }, t);
      }
    } catch (err) {
      // Audit failures must not prevent a safe reset from completing.
    }
    return deleted;
  });

  return { group, key: key || null, deletedCount };
};

const updateKey = async (key, value, group, actingUserId, actingUser = null) => {
  const credentialGroups = ['gateway_credentials', 'messaging_credentials', 'ai_credentials'];

  // Tier 1 feature keys are mode-locked — reject any attempt to modify them via settings.
  // This is the server-side enforcement regardless of who calls the API.
  if (group === 'features' && isTier1Feature(key)) {
    throw new AppError(
      'FEATURE_LOCKED',
      403,
      `Feature '${key}' is controlled by store mode and cannot be modified via settings.`
    );
  }

  ensureAdvancedSettingsAllowed([{ key, value, group }], actingUser);
  await ensurePaymentGatewaySettingsAreValid([{ key, value, group }]);

  // Capture the transaction result so we can invalidate the feature cache
  // AFTER it commits — ensuring we never bust the cache on a rollback.
  const result = await sequelize.transaction(async (t) => {
    // Look up by (key, group) to avoid cross-group collisions for shared key names.
    let setting = await Setting.findOne({ where: { key, group }, transaction: t });
    let before = setting ? setting.toJSON() : null;

    if (isMaskedSecretPlaceholder(value)) return null;

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
  if (group === 'features' || key === 'mode') invalidateFeature(key);

  return result;
};

const bulkUpdate = async (settingsInput, actingUserId, actingUser = null, options = {}) => {
  const { transaction: outerTransaction = null } = options;
  const validGroups = ['theme', 'componentStyles', 'sectionPresets', 'features', 'payments', 'sales', 'seo', 'general', 'shipping', 'tax', 'sku', 'logo', 'hero', 'auth', 'footer', 'announcement', 'nav', 'catalog', 'homepage', 'productPage', 'categoryPage', 'blogPage', 'brandsPage', 'cartPage', 'accountPage', 'checkoutPage', 'wishlistPage', 'searchPage', 'notFoundPage', 'ordersPage', 'admin', 'invoice', 'gateway_credentials', 'messaging_credentials', 'messaging', 'ai', 'ai_credentials', 'advanced'];
  const credentialGroups = ['gateway_credentials', 'messaging_credentials', 'ai_credentials'];

    // Normalize input to an array of { key, value, group }
    const settingsArray = Array.isArray(settingsInput) 
        ? settingsInput 
        : Object.entries(settingsInput).map(([key, value]) => ({ key, value }));

    ensureAdvancedSettingsAllowed(settingsArray, actingUser);
    await ensurePaymentGatewaySettingsAreValid(settingsArray);

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

    const writeSettings = async (t) => {
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

            // Skip entries with null/undefined values — DB column is NOT NULL
            if (value === null || value === undefined) continue;

            // Skip updating if the value is the sensitive placeholder (means it wasn't changed)
            if (isMaskedSecretPlaceholder(value)) continue;

            // Auto-encrypt if it's a credential group and value is not empty
            let finalValue = value;
            if (credentialGroups.includes(resolvedGroup) && value !== null && value !== undefined && String(value).trim() !== '') {
                finalValue = encrypt(String(value).trim());
            }

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
    };

    if (outerTransaction) {
      await writeSettings(outerTransaction);
    } else {
      await sequelize.transaction(writeSettings);
    }

    // Bust feature cache for any feature-group key that was updated
    for (const { key, group } of settingsArray) {
        if (!group || group === 'features' || key === 'mode') {
            invalidateFeature(key);
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

module.exports = {
  getAll,
  getByGroup,
  getDesignState,
  resetDesignSetting,
  updateKey,
  bulkUpdate,
  getFeatures,
};
