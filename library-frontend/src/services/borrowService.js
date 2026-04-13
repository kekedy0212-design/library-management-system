import api from './api';

export const borrowService = {
  borrowRequest: (bookId) => api.post('/borrow-requests', { book_id: bookId }),
  returnRequest: (recordId) => api.post('/return-requests', { borrow_record_id: recordId }),
  getPendingRequests: () => api.get('/requests/pending'),
  processRequest: (requestId, action, notes = '') => api.put(`/requests/${requestId}/process`, { action, notes }),
  getBorrowHistory: () => api.get('/users/me/borrow-history'),
};