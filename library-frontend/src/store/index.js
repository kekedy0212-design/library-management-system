import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import bookReducer from './slices/bookSlice';
import userReducer from './slices/userSlice';
import borrowReducer from './slices/borrowSlice';
import uiReducer from './slices/uiSlice';
import logger from './middleware/logger';

export default configureStore({
  reducer: {
    auth: authReducer,
    books: bookReducer,
    users: userReducer,
    borrow: borrowReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger),
});