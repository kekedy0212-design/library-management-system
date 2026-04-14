import { useSelector, useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginFailure, logout } from '../store/slices/authSlice';
import { authService } from '../services/authService';

const decodeToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      username: payload.sub,
      role: payload.role,
      email: payload.email || null,
      is_active: payload.is_active ?? true,
    };
  } catch {
    return { username: null, role: 'reader', email: null, is_active: true };
  }
};

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated, loading, error } = useSelector(state => state.auth);

  const login = async (credentials) => {
    dispatch(loginStart());
    try {
      const response = await authService.login(credentials);
      const { access_token } = response.data;
      const payload = decodeToken(access_token);
      dispatch(loginSuccess({
        user: {
          username: payload.username || credentials.username,
          role: payload.role,
          email: payload.email || null,
          is_active: payload.is_active ?? true,
        },
        token: access_token,
      }));
      return response;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || '登录失败';
      dispatch(loginFailure(errorMsg));
      throw new Error(errorMsg);
    }
  };

  const logoutUser = () => {
    dispatch(logout());
  };

  return {
    user,
    token,
    isAuthenticated,
    loading,
    error,
    login,
    logout: logoutUser,
  };
};