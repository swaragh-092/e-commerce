'use strict';

const { sequelize, Setting } = require('../index');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { ACTIONS, ENTITIES } = require('../../config/constants');

// Read local config/default.json for fallback defaults
// Path: server/src/modules/settings/ → ../../../config/default.json = server/config/default.json
let defaultSettings = {};
try {
  defaultSettings = require('../../../../config/default.json');
} catch (e) {
  // Ignore if not found — DB values are used instead
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
    tax: { ...defaultSettings.tax }
  };

  settings.forEach(s => {
    if (grouped[s.group]) {
      grouped[s.group][s.key] = s.value;
    }
  });

  return grouped;
};

const getByGroup = async (groupName) => {
  const validGroups = ['theme', 'features', 'seo', 'general', 'shipping', 'tax'];
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

const bulkUpdate = async (settingsObj, actingUserId) => {
    const validGroups = ['theme', 'features', 'seo', 'general', 'shipping', 'tax'];
    return sequelize.transaction(async (t) => {
        let updatedCount = 0;
        for (const [key, value] of Object.entries(settingsObj)) {
            // Find which group this key belongs to (based on defaults or existing)
            let setting = await Setting.findOne({ where: { key }, transaction: t });
            
            if (setting) {
                await setting.update({ value, updatedBy: actingUserId }, { transaction: t });
                updatedCount++;
            } else {
                // If it's brand new, we try to guess the group from defaults
                let guessedGroup = 'general';
                for (const g of validGroups) {
                    if (defaultSettings[g] && defaultSettings[g][key] !== undefined) {
                        guessedGroup = g;
                        break;
                    }
                }
                await Setting.create({ key, value, group: guessedGroup, updatedBy: actingUserId }, { transaction: t });
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
