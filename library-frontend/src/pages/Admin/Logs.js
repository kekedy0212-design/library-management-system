import React, { useEffect, useState, useCallback } from 'react';
import { adminService } from '../../services/adminService';
import { isAdmin } from '../../utils/auth';

const Logs = () => {
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lines, setLines] = useState(100);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminService.getLogs(lines);
      setLogs(response.data.logs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [lines]);

  useEffect(() => {
    if (isAdmin()) {
      fetchLogs();
    }
  }, [fetchLogs]);

  if (!isAdmin()) {
    return <div className="error">权限不足</div>;
  }

  return (
    <div>
      <h2>系统日志</h2>
      
      <div className="card">
        <div className="form-group">
          <label htmlFor="lines">显示行数</label>
          <select
            id="lines"
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </div>
        <button className="btn" onClick={fetchLogs} disabled={loading}>
          刷新日志
        </button>
      </div>

      {loading && <div className="loading">加载中...</div>}
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h3>日志内容</h3>
        <pre style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '1rem', 
          borderRadius: '4px',
          fontSize: '0.9rem',
          overflow: 'auto',
          maxHeight: '600px'
        }}>
          {logs || '暂无日志'}
        </pre>
      </div>
    </div>
  );
};

export default Logs;