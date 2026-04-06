'use strict';

const { sequelize, Setting } = require('../index');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { ACTIONS, ENTITIES } = require('../../config/constants');

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

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
  };

  settings.forEach(s => {
    if (grouped[s.group]) {
      grouped[s.group][s.key] = s.value;
    }
  });

  return grouped;
};

const getByGroup = async (groupName) => {
  const validGroups = ['theme', 'features', 'seo', 'general', 'shipping', 'tax', 'sku', 'logo', 'hero', 'footer', 'announcement', 'nav', 'catalog', 'homepage', 'productPage'];
  if (!validGroups.includes(groupName)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid setting group');
  }

  const settings = await Setting.findAll({ where: { group: groupName } });
  
  const result = { ...(defaultSettings[groupName] || {}) };
  settings.forEach(s => {
    result[s.key] = s.value;
  });

  return result;
};

const updateKey = async (key, value, group, actingUserId) => {
  return sequelize.transaction(async (t) => {
    let setting = await Setting.findOne({ where: { key }, transaction: t });
    let before = setting ? setting.toJSON() : null;

    if (setting) {
      await setting.update({ value, updatedBy: actingUserId }, { transaction: t });
    } else {
      if (!group) throw new AppError('VALIDATION_ERROR', 400, 'Group is required for new settings');
      setting = await Setting.create({ key, value, group, updatedBy: actingUserId }, { transaction: t });
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
};

const bulkUpdate = async (settingsInput, actingUserId) => {
    const validGroups = ['theme', 'features', 'seo', 'general', 'shipping', 'tax', 'sku', 'logo', 'hero', 'footer', 'announcement', 'nav', 'catalog', 'homepage', 'productPage'];
    
    // Normalize input to an array of { key, value, group }
    const settingsArray = Array.isArray(settingsInput) 
        ? settingsInput 
        : Object.entries(settingsInput).map(([key, value]) => ({ key, value }));

    return sequelize.transaction(async (t) => {
        let updatedCount = 0;
        for (const { key, value, group } of settingsArray) {
            // Resolve the group for this key upfront so lookups are always scoped
            // to (key + group) — prevents different groups sharing the same key name
            // from accidentally overwriting each other's DB row.
            let resolvedGroup = group || 'general';
            if (!group) {
                for (const g of validGroups) {
                    if (defaultSettings[g] && defaultSettings[g][key] !== undefined) {
                        resolvedGroup = g;
                        break;
                    }
                }
            }

            // Look up by (key, group) — not key alone — to avoid cross-group collisions
            let setting = await Setting.findOne({ where: { key, group: resolvedGroup }, transaction: t });
            
            if (setting) {
                await setting.update({ value, updatedBy: actingUserId }, { transaction: t });
                updatedCount++;
            } else {
                await Setting.create({ key, value, group: resolvedGroup, updatedBy: actingUserId }, { transaction: t });
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

        return true;
    });
};

module.exports = { getAll, getByGroup, updateKey, bulkUpdate };
