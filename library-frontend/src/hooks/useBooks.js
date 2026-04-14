import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import {
  fetchBooksStart,
  fetchBooksSuccess,
  fetchBooksFailure,
  setCurrentBook,
  addBook,
  updateBook as updateBookAction,
  deleteBook as deleteBookAction,
} from '../store/slices/bookSlice';
import { bookService } from '../services/bookService';

export const useBooks = () => {
  const dispatch = useDispatch();
  const { books, currentBook, loading, error, searchQuery } = useSelector(state => state.books);

  const fetchBooks = useCallback(async (query = '') => {
    dispatch(fetchBooksStart());
    try {
      const response = await bookService.getBooks({ q: query });
      dispatch(fetchBooksSuccess(response.data));
    } catch (err) {
      dispatch(fetchBooksFailure(err.message));
    }
  }, [dispatch]);

  const fetchBookById = useCallback(async (id) => {
    try {
      const response = await bookService.getBook(id);
      dispatch(setCurrentBook(response.data));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [dispatch]);

  const createBook = useCallback(async (bookData) => {
    try {
      const response = await bookService.createBook(bookData);
      dispatch(addBook(response.data));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [dispatch]);

  const updateBook = useCallback(async (id, bookData) => {
    try {
      const response = await bookService.updateBook(id, bookData);
      dispatch(updateBookAction(response.data));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [dispatch]);

  const deleteBook = useCallback(async (id) => {
    try {
      const response = await bookService.deleteBook(id);
      dispatch(deleteBookAction(id));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [dispatch]);

  return {
    books,
    currentBook,
    loading,
    error,
    searchQuery,
    fetchBooks,
    fetchBookById,
    createBook,
    updateBook,
    deleteBook,
  };
};