import { ROLES } from './constants';

export const isAuthenticated = () => {
  return !!sessionStorage.getItem('token');
};

export const getUserRole = () => {
  const token = sessionStorage.getItem('token');
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role;
  } catch {
    return null;
  }
};

export const hasPermission = (requiredRole) => {
  const userRole = getUserRole();
  if (!userRole) return false;

  const roleHierarchy = {
    [ROLES.READER]: 1,
    [ROLES.LIBRARIAN]: 2,
    [ROLES.ADMIN]: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

export const isAdmin = () => getUserRole() === ROLES.ADMIN;
export const isLibrarian = () => hasPermission(ROLES.LIBRARIAN);
export const isReader = () => hasPermission(ROLES.READER);