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
