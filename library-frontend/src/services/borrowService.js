import api from './api';

export const borrowService = {
  borrowRequest: (bookId) => api.post('/borrow-requests', { book_id: bookId }),
  returnRequest: (recordId) => api.post('/return-requests', { borrow_record_id: recordId }),
  returnRequestBatch: (recordIds) => api.post('/return-requests/batch', { borrow_record_ids: recordIds }),
  getPendingRequests: () => api.get('/requests/pending'),
  processRequest: (requestId, action, notes = '') => api.put(`/requests/${requestId}/process`, { action, notes }),
  processRequestsBatch: (requestIds, action, notes = '') =>
    api.post('/requests/process-batch', { request_ids: requestIds, action, notes }),
  getBorrowHistory: () => api.get('/users/me/borrow-history'),
};