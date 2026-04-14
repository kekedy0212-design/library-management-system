import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// 导入 Material Web 组件
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';

const Header = ({ onMenuClick }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: 'var(--md-sys-color-surface)',
    color: 'var(--md-sys-color-on-surface)',
    height: '64px',
    position: 'sticky',
    top: 0,
    zIndex: 1000
  };

  return (
    <header style={headerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <md-icon-button onClick={onMenuClick}>
          <md-icon>menu</md-icon>
        </md-icon-button>
        <span style={{
          font: 'var(--md-sys-typescale-title-large-font)',
          marginLeft: '8px'
        }}>
          Library System
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {isAuthenticated ? (
          <>
            <div style={{ textAlign: 'right', display: 'none', md: 'block' }}>
              <div style={{ font: 'var(--md-sys-typescale-label-large-font)' }}>
                {user?.username}
              </div>
              <div style={{
                font: 'var(--md-sys-typescale-body-small-font)',
                color: 'var(--md-sys-color-on-surface-variant)'
              }}>
                {user?.role?.toUpperCase()}
              </div>
            </div>
            <md-filled-button onClick={handleLogout}>
              Logout
            </md-filled-button>
          </>
        ) : (
          <md-text-button href="/login">Login</md-text-button>
        )}
      </div>
    </header>
  );
};

export default Header;