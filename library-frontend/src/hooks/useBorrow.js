import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import {
  fetchBorrowHistoryStart,
  fetchBorrowHistorySuccess,
  fetchBorrowHistoryFailure,
  addBorrowRequest,
} from '../store/slices/borrowSlice';
import { borrowService } from '../services/borrowService';

export const useBorrow = () => {
  const dispatch = useDispatch();
  const { borrowHistory, pendingRequests, loading, error } = useSelector(state => state.borrow);

  const fetchBorrowHistory = useCallback(async () => {
    dispatch(fetchBorrowHistoryStart());
    try {
      const response = await borrowService.getBorrowHistory();
      dispatch(fetchBorrowHistorySuccess(response.data));
    } catch (err) {
      dispatch(fetchBorrowHistoryFailure(err.message));
    }
  }, [dispatch]);

  const borrowBook = useCallback(async (bookId) => {
    try {
      const response = await borrowService.borrowRequest(bookId);
      dispatch(addBorrowRequest(response.data));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [dispatch]);

  const returnBook = useCallback(async (recordId) => {
    try {
      const response = await borrowService.returnRequest(recordId);
      // 重新获取借阅历史以更新状态
      await fetchBorrowHistory();
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [fetchBorrowHistory]);

  return {
    borrowHistory,
    pendingRequests,
    loading,
    error,
    fetchBorrowHistory,
    borrowBook,
    returnBook,
  };
};