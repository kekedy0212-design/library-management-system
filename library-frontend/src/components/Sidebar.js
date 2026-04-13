import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { isAuthenticated, hasPermission } from '../utils/auth';
import { ROLES } from '../utils/constants';

const Sidebar = () => {
  const { isAuthenticated: authState } = useSelector(state => state.auth);

  if (!isAuthenticated() || !authState) {
    return null;
  }

  return (
    <nav className="sidebar">
      <ul>
        <li><Link to="/">仪表板</Link></li>
        <li><Link to="/books">书籍管理</Link></li>
        {hasPermission(ROLES.LIBRARIAN) && (
          <>
            <li><Link to="/users">用户管理</Link></li>
            <li><Link to="/borrow">借阅管理</Link></li>
          </>
        )}
        {hasPermission(ROLES.ADMIN) && (
          <li><Link to="/admin/logs">系统日志</Link></li>
        )}
      </ul>
    </nav>
  );
};

export default Sidebar;