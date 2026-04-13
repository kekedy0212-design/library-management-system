import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import {
  fetchUsersStart,
  fetchUsersSuccess,
  fetchUsersFailure,
  updateUser,
  resetPasswordStart,
  resetPasswordSuccess,
  resetPasswordFailure
} from '../store/slices/userSlice';
import { userService } from '../services/userService';

export const useUsers = () => {
  const dispatch = useDispatch();
  const { users, loading, error } = useSelector(state => state.users);

  const fetchUsers = useCallback(async () => {
    dispatch(fetchUsersStart());
    try {
      const response = await userService.getUsers();
      dispatch(fetchUsersSuccess(response.data));
    } catch (err) {
      dispatch(fetchUsersFailure(err.message));
    }
  }, [dispatch]);

  const updateUserStatus = useCallback(async (userId, isActive) => {
    try {
      const response = await userService.updateUser(userId, { is_active: isActive });
      dispatch(updateUser(response.data));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [dispatch]);

  const updateUserRole = useCallback(async (userId, role) => {
    try {
      const response = await userService.updateUser(userId, { role });
      dispatch(updateUser(response.data));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [dispatch]);

  const resetUserPassword = useCallback(async (userId, newPassword) => {
    dispatch(resetPasswordStart());
    try {
      await userService.resetPassword(userId, newPassword);
      dispatch(resetPasswordSuccess());
      return { success: true };
    } catch (err) {
      dispatch(resetPasswordFailure(err.message));
      return { success: false, error: err.message };
    }
  }, [dispatch]);

  return {
    users,
    loading,
    error,
    fetchUsers,
    updateUserStatus,
    updateUserRole,
    resetUserPassword,
  };
};