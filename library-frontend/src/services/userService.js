import api from './api';

export const userService = {
  getUsers: (params = {}) => api.get('/users', { params }),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { new_password: newPassword }),
};