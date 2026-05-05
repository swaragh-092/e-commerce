import api from './api';

const settingsService = {
  getAllSettings: async () => {
    const response = await api.get('/settings');
    return response.data.data;
  },

  getSettingsGroup: async (groupName) => {
    const response = await api.get(`/settings/${groupName}`);
    return response.data.data;
  },

  /**
   * Returns the fully resolved feature map for the current APP_MODE.
   * Mode-core features always override DB settings.
   * Response shape: { mode: 'ecommerce' | 'catalog', features: { pricing: bool, cart: bool, ... } }
   */
  getFeatures: async () => {
    const response = await api.get('/settings/features');
    return response.data.data; // { mode, features }
  },

  updateSettingsBulk: async (settingsObject) => {
    const response = await api.put('/settings/bulk', settingsObject);
    return response.data;
  },
  
  updateSingleSetting: async (key, value, group) => {
      const response = await api.put(`/settings/${key}?group=${group}`, { value });
      return response.data;
  }
};

export default settingsService;
