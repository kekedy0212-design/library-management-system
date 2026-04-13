import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  books: [],
  currentBook: null,
  loading: false,
  error: null,
  searchQuery: '',
};

const bookSlice = createSlice({
  name: 'books',
  initialState,
  reducers: {
    fetchBooksStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchBooksSuccess: (state, action) => {
      state.loading = false;
      state.books = action.payload;
    },
    fetchBooksFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    setCurrentBook: (state, action) => {
      state.currentBook = action.payload;
    },
    addBook: (state, action) => {
      state.books.push(action.payload);
    },
    updateBook: (state, action) => {
      const index = state.books.findIndex(book => book.id === action.payload.id);
      if (index !== -1) {
        state.books[index] = action.payload;
      }
    },
    deleteBook: (state, action) => {
      state.books = state.books.filter(book => book.id !== action.payload);
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
  },
});

export const {
  fetchBooksStart,
  fetchBooksSuccess,
  fetchBooksFailure,
  setCurrentBook,
  addBook,
  updateBook,
  deleteBook,
  setSearchQuery,
} = bookSlice.actions;

export default bookSlice.reducer;