import api from './api';

export const adminService = {
  getLogs: (lines = 100) => api.get(`/admin/logs?lines=${lines}`),
  getDailyRevenue: (date) => {
    const params = date ? { date } : {};
    return api.get('/admin/revenue/daily', { params });
  },
};
