import api from './api';

export const bookService = {
  getBooks: (params = {}) => api.get('/books', { params }),
  getBook: (id) => api.get(`/books/${id}`),
  getBookRating: (id) => api.get(`/books/${id}/rating`),
  rateBook: (id, score) => api.put(`/books/${id}/rating`, { score }),
  getRecommendations: (limit = 8) =>
    api.get('/books/recommendations', { params: { limit } }),
  getBookReviews: (bookId) => api.get(`/books/${bookId}/reviews`),
  upsertBookReview: (bookId, content) =>
    api.put(`/books/${bookId}/reviews`, { content }),
  deleteBookReview: (bookId, reviewId) =>
    api.delete(`/books/${bookId}/reviews/${reviewId}`),
  createBook: (bookData) => api.post('/books', bookData),
  updateBook: (id, bookData) => api.put(`/books/${id}`, bookData),
  deleteBook: (id) => api.delete(`/books/${id}`),
};