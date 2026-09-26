import api from './api';

export const getAllSettings = async () => {
  const response = await api.get('/settings');
  return response.data.data;
};

export const getSettingsGroup = async (groupName) => {
  const response = await api.get(`/settings/${groupName}`);
  return response.data.data;
};

export const getDesignState = async () => {
  const response = await api.get('/settings/design-state');
  return response.data.data;
};

export const resetDesignSetting = async (group, key = null) => {
  const response = await api.post('/settings/design-reset', { group, key });
  return response.data.data;
};

export const getDesignDraft = async () => {
  const response = await api.get('/settings/design-draft');
  return response.data.data;
};

export const getDesignVersions = async (limit = 30) => {
  const response = await api.get('/settings/design-versions', { params: { limit } });
  return response.data.data;
};

export const saveDesignDraft = async (settings, expectedRevision = undefined) => {
  const response = await api.post('/settings/design-draft', {
    settings,
    ...(expectedRevision == null ? {} : { expectedRevision }),
  });
  return response.data.data;
};

export const publishDesignDraft = async (expectedRevision = undefined) => {
  const response = await api.post('/settings/design-draft/publish', expectedRevision == null ? {} : { expectedRevision });
  return response.data.data;
};

export const restoreDesignVersion = async (versionId, expectedRevision = undefined) => {
  const response = await api.post(`/settings/design-versions/${versionId}/restore`, expectedRevision == null ? {} : { expectedRevision });
  return response.data.data;
};

export const discardDesignDraft = async () => {
  const response = await api.delete('/settings/design-draft');
  return response.data.data;
};

/**
 * Returns the fully resolved feature map for the current APP_MODE.
 * Mode-core features always override DB settings.
 * Response shape: { mode: 'ecommerce' | 'catalog', features: { pricing: bool, cart: bool, ... } }
 */
export const getFeatures = async () => {
  const response = await api.get('/settings/features');
  return response.data.data; // { mode, features }
};

export const updateSettingsBulk = async (settingsObject) => {
  const response = await api.put('/settings/bulk', settingsObject);
  return response.data;
};

export const updateSingleSetting = async (key, value, group) => {
  const response = await api.put(`/settings/${key}?group=${group}`, { value });
  return response.data;
};

const settingsService = {
  getAllSettings,
  getSettingsGroup,
  getDesignState,
  resetDesignSetting,
  getDesignDraft,
  getDesignVersions,
  saveDesignDraft,
  publishDesignDraft,
  restoreDesignVersion,
  discardDesignDraft,
  getFeatures,
  updateSettingsBulk,
  updateSingleSetting,
};

export default settingsService;
