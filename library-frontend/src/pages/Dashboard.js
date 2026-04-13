import React from 'react';
import { useSelector } from 'react-redux';
import { isAuthenticated } from '../utils/auth';

const Dashboard = () => {
  const { user } = useSelector(state => state.auth);

  if (!isAuthenticated()) {
    return (
      <div className="card">
        <h2>欢迎使用图书馆管理系统</h2>
        <p>请先 <a href="/login">登录</a> 或 <a href="/register">注册</a></p>
      </div>
    );
  }

  return (
    <div>
      <h2>仪表板</h2>
      <div className="card">
        <h3>用户信息</h3>
        <p><strong>用户名:</strong> {user?.username}</p>
        <p><strong>邮箱:</strong> {user?.email}</p>
        <p><strong>角色:</strong> {user?.role}</p>
        <p><strong>状态:</strong> {user?.is_active ? '激活' : '未激活'}</p>
      </div>
      
      <div className="card">
        <h3>快速操作</h3>
        <ul>
          <li><a href="/books">浏览书籍</a></li>
          <li><a href="/borrow">查看借阅历史</a></li>
          {user?.role === 'librarian' || user?.role === 'admin' ? (
            <>
              <li><a href="/users">管理用户</a></li>
              <li><a href="/borrow">处理借阅请求</a></li>
            </>
          ) : null}
          {user?.role === 'admin' && (
            <li><a href="/admin/logs">查看系统日志</a></li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;