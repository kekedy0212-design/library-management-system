export const ROLES = {
  ADMIN: 'admin',
  LIBRARIAN: 'librarian',
  READER: 'reader',
};

export const BORROW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RETURN_PENDING: 'return_pending',
  RETURNED: 'returned',
  OVERDUE: 'overdue',
};

export const API_ENDPOINTS = {
  AUTH: '/auth',
  BOOKS: '/books',
  USERS: '/users',
  BORROW: '/borrow-requests',
  RETURN: '/return-requests',
  REQUESTS: '/requests',
  ADMIN: '/admin',
};