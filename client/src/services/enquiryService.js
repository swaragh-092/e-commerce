import api from './api';

export const getAdminEnquiries = (params) => api.get('/enquiries/admin', { params });
export const updateAdminEnquiryStatus = (id, status) =>
  api.patch(`/enquiries/admin/${id}/status`, { status });
export const replyToAdminEnquiry = (id, replyMessage) =>
  api.post(`/enquiries/admin/${id}/reply`, { replyMessage });
