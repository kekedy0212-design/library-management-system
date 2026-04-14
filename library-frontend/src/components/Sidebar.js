import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { isAuthenticated as checkAuth, hasPermission, isLibrarian, isAdmin } from '../utils/auth';

import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';

const Sidebar = ({ isOpen }) => {
  const location = useLocation();
  const { isAuthenticated: authState } = useSelector(state => state.auth);

  if (!checkAuth() || !authState) return null;

  const sidebarStyle = {
    width: isOpen ? '280px' : '0px',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflowX: 'hidden',
    backgroundColor: 'var(--md-sys-color-surface-container-low)',
    height: 'calc(100vh - 64px)',
    position: 'sticky',
    top: '64px',
    padding: isOpen ? '12px' : '0px',
    boxSizing: 'border-box',
    borderRight: '1px solid var(--md-sys-color-outline-variant)'
  };

  const navItems = [
    { label: 'Dashboard', path: '/', icon: 'dashboard', visible: true },
    { label: 'Books Management', path: '/books', icon: 'library_books', visible: true },
    { label: 'User Management', path: '/users', icon: 'group', visible: isLibrarian() || isAdmin() },
    { label: 'Borrowing Requests', path: '/borrow', icon: 'book_loader', visible: isLibrarian() || isAdmin() },
    { label: 'Request Approval', path: '/admin/requests', icon: 'check_circle', visible: isLibrarian() || isAdmin() },
    { label: 'System Logs', path: '/admin/logs', icon: 'settings_ethernet', visible: isAdmin() },
  ];

  return (
    <nav style={sidebarStyle}>
      <md-list style={{ background: 'transparent', padding: 0 }}>
        {navItems.map((item) => {
          // 权限检查
          if (!item.visible) return null;

          const isActive = location.pathname === item.path;

          return (
            <Link to={item.path} key={item.path} style={{ textDecoration: 'none' }}>
              <md-list-item
                type="button"
                interactive
                style={{
                  '--md-list-item-container-color': isActive ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                  '--md-list-item-label-text-color': isActive ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)',
                  borderRadius: '100px', // MD3 导航项圆角
                  marginBottom: '4px'
                }}
              >
                <md-icon slot="start" style={{
                  color: isActive ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)'
                }}>
                  {item.icon}
                </md-icon>
                <div slot="headline" style={{ font: 'var(--md-sys-typescale-label-large-font)' }}>
                  {item.label}
                </div>
              </md-list-item>
            </Link>
          );
        })}
      </md-list>
    </nav>
  );
};

export default Sidebar;