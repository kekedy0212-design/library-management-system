import api from './api';

export const authService = {
  login: (credentials) => {
    const body = new URLSearchParams();
    body.append('username', credentials.username);
    body.append('password', credentials.password);
    return api.post('/auth/login', body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
};