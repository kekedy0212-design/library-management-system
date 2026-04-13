import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import { fetchBooksStart, fetchBooksFailure } from '../store/slices/bookSlice';

export const useBooks = () => {
  const dispatch = useDispatch();
  const { books, loading, error, searchQuery } = useSelector(state => state.books);

  const fetchBooks = useCallback(async (query = '') => {
    dispatch(fetchBooksStart());
    try {
      // API call will be implemented
      // const response = await bookService.getBooks(query);
      // dispatch(fetchBooksSuccess(response.data));
    } catch (err) {
      dispatch(fetchBooksFailure(err.message));
    }
  }, [dispatch]);

  return {
    books,
    loading,
    error,
    searchQuery,
    fetchBooks,
  };
};