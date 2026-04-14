import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { isAuthenticated as checkAuth, isLibrarian, isAdmin } from '../utils/auth';

import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated: authState } = useSelector(state => state.auth);

  if (!checkAuth() || !authState) return null;

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const sidebarStyle = {
    width: isOpen ? '280px' : '68px',
    transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    backgroundColor: 'var(--md-sys-color-surface-container-low)',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 10px', // 稍微调窄 padding 保证圆点居中
    boxSizing: 'border-box',
    borderRight: '1px solid var(--md-sys-color-outline-variant)',
    zIndex: 100,
    overflow: 'hidden'
  };

  // 通用列表项样式函数
  const getListItemStyle = (isActive, isDanger = false) => ({
    '--md-list-item-container-color': isActive ? 'var(--md-sys-color-secondary-container)' : 'transparent',
    '--md-list-item-label-text-color': isDanger ? 'var(--md-sys-color-error)' : (isActive ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)'),
    '--md-list-item-leading-space': isOpen ? '16px' : '12px', // 收缩时减小左侧间距以居中
    borderRadius: '100px',
    marginBottom: '8px',
    height: '48px',
    width: isOpen ? '100%' : '48px', // 收缩时变为圆形按钮
    minWidth: isOpen ? 'auto' : '48px',
    display: 'flex',
    justifyContent: isOpen ? 'flex-start' : 'center',
    transition: 'all 0.2s ease',
    cursor: 'pointer'
  });

  const navItems = [
    { label: 'Dashboard', path: '/', icon: 'dashboard', visible: true },
    { label: 'Books', path: '/books', icon: 'library_books', visible: true },
    { label: 'Users', path: '/users', icon: 'group', visible: isLibrarian() || isAdmin() },
    { label: 'History', path: '/borrow', icon: 'history', visible: true },
    { label: 'Requests', path: '/admin/requests', icon: 'pending_actions', visible: isLibrarian() || isAdmin() },
    { label: 'Logs', path: '/admin/logs', icon: 'settings_ethernet', visible: isAdmin() },
  ];

  return (
    <nav style={sidebarStyle}>
      {/* 1. Toggle Button - 保持与下方图标对齐 */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: isOpen ? 'flex-start' : 'center', paddingLeft: isOpen ? '4px' : '0' }}>
        <md-icon-button onClick={toggleSidebar}>
          <md-icon>menu</md-icon>
        </md-icon-button>
      </div>

      {/* 2. Navigation Items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: isOpen ? 'stretch' : 'center' }}>
        <md-list style={{ background: 'transparent', padding: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: isOpen ? 'stretch' : 'center' }}>
          {navItems.map((item) => {
            if (!item.visible) return null;
            const isActive = location.pathname === item.path;

            return (
              <Link to={item.path} key={item.path} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
                <md-list-item
                  type="button"
                  interactive
                  style={getListItemStyle(isActive)}
                >
                  <md-icon slot="start" style={{
                    color: isActive ? 'var(--md-sys-color-on-secondary-container)' : 'inherit',
                    margin: isOpen ? '0' : '0 auto' // 强制居中
                  }}>
                    {item.icon}
                  </md-icon>
                  {isOpen && (
                    <div slot="headline" style={{ font: 'var(--md-sys-typescale-label-large-font)', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </div>
                  )}
                </md-list-item>
              </Link>
            );
          })}
        </md-list>
      </div>

      {/* 3. Logout Button */}
      <div style={{
        borderTop: '1px solid var(--md-sys-color-outline-variant)',
        paddingTop: '8px',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <md-list-item
          type="button"
          interactive
          onClick={handleLogout}
          style={getListItemStyle(false, true)}
        >
          <md-icon slot="start" style={{
            color: 'var(--md-sys-color-error)',
            margin: isOpen ? '0' : '0 auto'
          }}>
            logout
          </md-icon>
          {isOpen && <div slot="headline">Sign Out</div>}
        </md-list-item>
      </div>
    </nav>
  );
};

export default Sidebar;