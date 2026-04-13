import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h2>404 - 页面未找到</h2>
      <p>抱歉，您访问的页面不存在。</p>
      <Link to="/" className="btn">返回首页</Link>
    </div>
  );
};

export default NotFound;