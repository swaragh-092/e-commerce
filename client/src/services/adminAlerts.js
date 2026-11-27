import api from './api';

const request = (method, path, data) => api.request({
  method, url: '/notifications' + path, data,
}).then(result => result.data.data);

export const adminAlerts = {
  inbox: (unread = false, limit = 30, offset = 0, signal) => api.get('/notifications/inbox', {
    params: { unread, limit, offset }, signal,
  }).then(result => result.data.data),
  mark: (id, read) => request('patch', '/inbox/' + id, { read }),
  markAll: () => request('post', '/inbox/read-all'),
  preferences: () => request('get', '/preferences'),
  savePreferences: value => request('put', '/preferences', value),
  rules: () => request('get', '/internal-rules'),
  setInboxEnabled: enabled => request('put', '/internal-rules/inbox-policy', { enabled }),
  setEmailEnabled: enabled => request('put', '/internal-rules/email-policy', { paused: !enabled }),
  create: (event, config) => request('post', '/internal-rules', { event, config }),
  publish: ({ id, version }, config) => request('put', '/internal-rules/' + id, { version, config }),
  preview: (id, config) => request('post', '/internal-rules/' + id + '/preview', { config }),
  test: (id, config, channel) => request('post', '/internal-rules/' + id + '/test', { config, channel }),
  history: id => request('get', '/internal-rules/' + id + '/history'),
  restore: (rule, version) => request('post', '/internal-rules/' + rule.id + '/restore', { currentVersion: rule.version, version }),
  grant: (id, user, fields, audience) => request('put', '/internal-rules/' + id + '/delegations/' + user, { fields, audience }),
  revoke: (id, user) => request('delete', '/internal-rules/' + id + '/delegations/' + user),
};

export const refreshAdminAlerts = () => window.dispatchEvent(new Event('admin-alerts-changed'));
