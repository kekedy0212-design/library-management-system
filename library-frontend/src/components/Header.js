import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <h1>图书馆管理系统</h1>
      <div className="user-info">
        {isAuthenticated ? (
          <>
            <span>欢迎, {user?.username} ({user?.role})</span>
            <button className="btn" onClick={handleLogout}>退出</button>
          </>
        ) : (
          <Link to="/login" className="btn">登录</Link>
        )}
      </div>
    </header>
  );
};

export default Header;