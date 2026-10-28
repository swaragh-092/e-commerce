import api from './api';

const base = '/notifications';
export const notificationService = {
  events: () => api.get(`${base}/events`).then(response => response.data.data),
  options: () => api.get(`${base}/recipient-options`).then(response => response.data.data),
  read: event => api.get(`${base}/events/${event}`).then(response => response.data.data),
  save: (event, data) => api.put(`${base}/events/${event}`, data).then(response => response.data.data),
  history: event => api.get(`${base}/events/${event}/history`).then(response => response.data.data),
  preview: (event, message) => api.post(`${base}/events/${event}/preview`, { message }).then(response => response.data.data),
  test: (event, data) => api.post(`${base}/events/${event}/test`, data).then(response => response.data.data),
};
