import api from './api';

export const getAllSettings = async () => {
  const response = await api.get('/settings');
  return response.data.data;
};

export const getPublicSettings = async () => {
  const response = await api.get('/settings/public');
  return response.data.data;
};

export const getPublicSettingsGroup = async (groupName) => {
  const response = await api.get(`/settings/public/${groupName}`);
  return response.data.data;
};

export const getSettingsGroup = async (groupName) => {
  const response = await api.get(`/settings/${groupName}`);
  return response.data.data;
};

export const getUnitUsage = async () => {
  const response = await api.get('/settings/unit-usage');
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

export const getDesignDraft = async (draftKey) => {
  const response = await api.get('/settings/design-draft', draftKey ? { params: { draftKey } } : undefined);
  return response.data.data;
};
export const getNamedDesignDrafts = async () => (await api.get('/settings/design-drafts')).data.data;
export const createNamedDesignDraft = async (name, sourceDraftKey) =>
  (await api.post('/settings/design-drafts', { name, sourceDraftKey })).data.data;
export const renameNamedDesignDraft = async (draftKey, name, expectedRevision) =>
  (await api.patch('/settings/design-drafts', { draftKey, name, expectedRevision })).data.data;

export const getDesignVersions = async (limit = 30) => {
  const response = await api.get('/settings/design-versions', { params: { limit } });
  return response.data.data;
};

export const saveDesignDraft = async (settings, expectedRevision = undefined, draftKey) => {
  const response = await api.post('/settings/design-draft', {
    settings,
    ...(draftKey && { draftKey }),
    ...(expectedRevision == null ? {} : { expectedRevision }),
  });
  return response.data.data;
};

export const publishDesignDraft = async (expectedRevision = undefined, conflictToken = undefined, draftKey) => {
  const response = await api.post('/settings/design-draft/publish', { expectedRevision, conflictToken, ...(draftKey && { draftKey }) });
  return response.data.data;
};

export const restoreDesignVersion = async (versionId, expectedRevision = undefined) => {
  const response = await api.post(`/settings/design-versions/${versionId}/restore`, expectedRevision == null ? {} : { expectedRevision });
  return response.data.data;
};

export const getDraftArchives = async () => {
  const response = await api.get('/settings/design-draft/archives');
  return response.data.data;
};

export const restoreDraftArchive = async (archiveId, expectedRevision) => {
  const response = await api.post(`/settings/design-draft/archives/${archiveId}/restore`, { expectedRevision });
  return response.data.data;
};

export const discardDesignDraft = async (expectedRevision, draftKey) => {
  const response = await api.delete('/settings/design-draft', { data: { expectedRevision, ...(draftKey && { draftKey }) } });
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
  getPublicSettings,
  getPublicSettingsGroup,
  getSettingsGroup,
  getUnitUsage,
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
