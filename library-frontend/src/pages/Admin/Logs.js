import React, { useEffect, useState, useCallback } from 'react';
import { adminService } from '../../services/adminService';
import { isAdmin } from '../../utils/auth';
import MdCard from '../../components/MdCard';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lines, setLines] = useState(100);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminService.getLogs(lines);
      setLogs(Array.isArray(response.data.logs) ? response.data.logs : [String(response.data.logs)]);
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
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>
        Access Denied. Administrator credentials required.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '400', margin: 0 }}>System Logs</h2>
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            Monitor real-time backend events and error reports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="lines" style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Lines to display
            </label>
            <select
              id="lines"
              value={lines}
              onChange={(e) => setLines(Number(e.target.value))}
              style={selectStyle}
            >
              {[50, 100, 200, 500, 1000].map(val => (
                <option key={val} value={val}>{val} lines</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{
              ...refreshBtnStyle,
              backgroundColor: loading ? 'var(--md-sys-color-surface-variant)' : 'var(--md-sys-color-primary-container)'
            }}
          >
            {loading ? 'Fetching...' : 'Refresh Logs'}
          </button>
        </div>
      </header>

      {error && (
        <div style={errorBannerStyle}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <MdCard variant="outlined" style={{ padding: 0, backgroundColor: '#1C1B1F', overflow: 'hidden' }}>
        <div style={terminalHeaderStyle}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ ...dotStyle, backgroundColor: '#FF5F56' }} />
            <div style={{ ...dotStyle, backgroundColor: '#FFBD2E' }} />
            <div style={{ ...dotStyle, backgroundColor: '#27C93F' }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: '#938F99', fontFamily: 'monospace' }}>server.log</span>
        </div>

        <div style={logContainerStyle}>
          {loading ? (
            <div style={logLineStyle}>
              <span style={{ color: '#938F99' }}>Synchronizing with server...</span>
            </div>
          ) : logs.length > 0 ? (
            logs.map((line, index) => (
              <div key={index} style={logLineStyle}>
                <span style={{ color: line.includes('ERROR') || line.includes('CRITICAL') ? '#FFB4AB' :
                              line.includes('WARNING') ? '#FFAB40' :
                              line.includes('INFO') ? '#A5D6A7' :
                              line.includes('DEBUG') ? '#90CAF9' : '#E6E1E5' }}>
                  {line || '\u00A0'}
                </span>
              </div>
            ))
          ) : (
            <div style={logLineStyle}>
              <span style={{ color: '#938F99' }}>No log entries found for this period.</span>
            </div>
          )}
        </div>
      </MdCard>

      <footer style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--md-sys-color-outline)' }}>
        Last updated: {new Date().toLocaleTimeString()}
      </footer>
    </div>
  );
};

// --- Styles ---

const selectStyle = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid var(--md-sys-color-outline)',
  backgroundColor: 'var(--md-sys-color-surface)',
  fontSize: '0.9rem',
  color: 'var(--md-sys-color-on-surface)',
  outline: 'none',
  cursor: 'pointer'
};

const refreshBtnStyle = {
  height: '40px',
  padding: '0 20px',
  borderRadius: '20px',
  border: 'none',
  color: 'var(--md-sys-color-on-primary-container)',
  fontWeight: '500',
  fontSize: '0.875rem',
  cursor: 'pointer',
  transition: 'opacity 0.2s',
  marginTop: '18px'
};

const terminalHeaderStyle = {
  backgroundColor: '#2B2930',
  padding: '12px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #49454F'
};

const dotStyle = {
  width: '10px',
  height: '10px',
  borderRadius: '50%'
};

const logContainerStyle = {
  padding: '20px',
  backgroundColor: '#1C1B1F',
  fontSize: '0.85rem',
  fontFamily: '"Roboto Mono", "Fira Code", monospace',
  overflow: 'auto',
  maxHeight: '650px',
  borderRadius: '0 0 12px 12px'
};

const logLineStyle = {
  lineHeight: '1.6',
  padding: '2px 0',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  wordBreak: 'break-all',
  whiteSpace: 'pre-wrap'
};

const errorBannerStyle = {
  backgroundColor: 'var(--md-sys-color-error-container)',
  color: 'var(--md-sys-color-on-error-container)',
  padding: '16px',
  borderRadius: '12px',
  marginBottom: '24px',
  fontSize: '0.9rem'
};

export default Logs;