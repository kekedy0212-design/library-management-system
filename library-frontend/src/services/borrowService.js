import api from './api';

export const borrowService = {
  borrowRequest: (bookId, copyId, requestedDueDate = null) =>
    api.post('/borrow-requests', {
      book_id: bookId,
      copy_id: copyId,
      requested_due_date: requestedDueDate,
    }),
  reserveRequest: (bookId) => api.post('/reserve-requests', { book_id: bookId }),
  // 支持传入额外条码信息：{ barcode, barcode_number, isbn, copy_id }
  returnRequest: (recordId, payload = {}) =>
    api.post('/return-requests', { borrow_record_id: recordId, ...payload }),
  renewRequest: (recordId, requestedDueDate = null) =>
    api.post('/renew-requests', {
      borrow_record_id: recordId,
      requested_due_date: requestedDueDate,
    }),
  returnRequestBatch: (recordIds) => api.post('/return-requests/batch', { borrow_record_ids: recordIds }),
  getPendingRequests: () => api.get('/requests/pending'),
  getAllBorrowRecords: () => api.get('/borrow-records'),
  processRequest: (requestId, action, notes = '') => api.put(`/requests/${requestId}/process`, { action, notes }),
  processRequestsBatch: (requestIds, action, notes = '') =>
    api.post('/requests/process-batch', { request_ids: requestIds, action, notes }),
  getBorrowHistory: () => api.get('/users/me/borrow-history'),
};