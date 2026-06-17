import api from './api';

const themeService = {
  getBuiltinThemes: () => api.get('/themes/builtin').then(r => r.data.data),
  getLibraryThemes: (params = {}) => api.get('/themes/library', { params }).then(r => {
    const data = r.data.data;
    // Support both paginated response { themes, total, ... } and legacy array
    if (data && data.themes) return data;
    return { themes: data || [], total: (data || []).length, page: 1, pageSize: 20, totalPages: 1 };
  }),
  getActivations: () => api.get('/themes/activations').then(r => r.data.data),
  getStoreStatus: () => api.get('/themes/store-status').then(r => r.data.data),
  validateTheme: (packageData) => api.post('/themes/validate', { packageData }).then(r => r.data.data),
  previewTheme: (packageData, scopes) => api.post('/themes/preview', { packageData, scopes }).then(r => r.data.data),
  importTheme: (packageData) => api.post('/themes/import', { packageData }).then(r => r.data.data),
  exportTheme: (options = {}) => api.post('/themes/export', options).then(r => r.data.data),
  applyTheme: (packageData, scopes, replaceDemoContent = false) => api.post('/themes/apply', { packageData, scopes, replaceDemoContent }).then(r => r.data.data),
  rollbackTheme: (activationId) => api.post(`/themes/activations/${activationId}/rollback`).then(r => r.data.data),
  removeLibraryTheme: (id) => api.delete(`/themes/library/${id}`).then(r => r.data),
};

export default themeService;
