import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  borrowHistory: [],
  pendingRequests: [],
  loading: false,
  error: null,
};

const borrowSlice = createSlice({
  name: 'borrow',
  initialState,
  reducers: {
    fetchBorrowHistoryStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchBorrowHistorySuccess: (state, action) => {
      state.loading = false;
      state.borrowHistory = action.payload;
    },
    fetchBorrowHistoryFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    fetchPendingRequestsStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchPendingRequestsSuccess: (state, action) => {
      state.loading = false;
      state.pendingRequests = action.payload;
    },
    fetchPendingRequestsFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    addBorrowRequest: (state, action) => {
      state.pendingRequests.push(action.payload);
    },
    updateBorrowRequest: (state, action) => {
      const index = state.pendingRequests.findIndex(req => req.id === action.payload.id);
      if (index !== -1) {
        state.pendingRequests[index] = action.payload;
      }
    },
  },
});

export const {
  fetchBorrowHistoryStart,
  fetchBorrowHistorySuccess,
  fetchBorrowHistoryFailure,
  fetchPendingRequestsStart,
  fetchPendingRequestsSuccess,
  fetchPendingRequestsFailure,
  addBorrowRequest,
  updateBorrowRequest,
} = borrowSlice.actions;

export default borrowSlice.reducer;