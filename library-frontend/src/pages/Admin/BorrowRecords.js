import React, { useEffect, useMemo, useState } from 'react';
import { borrowService } from '../../services/borrowService';
import { formatDate } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard';

const BorrowRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await borrowService.getAllBorrowRecords();
        setRecords(response.data || []);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Failed to load borrow records');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const visibleRecords = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return records.filter((item) => {
      const requestDate = item.request_date ? new Date(item.request_date) : null;
      const statusMatches = statusFilter === 'all' || item.status === statusFilter;
      const startMatches = !startDate || (requestDate && requestDate >= new Date(`${startDate}T00:00:00`));
      const endMatches = !endDate || (requestDate && requestDate <= new Date(`${endDate}T23:59:59`));
      if (!statusMatches || !startMatches || !endMatches) return false;

      if (!text) return true;
      const title = item.book?.title?.toLowerCase() || '';
      const username = item.user?.username?.toLowerCase() || '';
      const isbn = item.book?.isbn?.toLowerCase() || '';
      const status = item.status?.toLowerCase() || '';
      return title.includes(text) || username.includes(text) || isbn.includes(text) || status.includes(text);
    }).sort((a, b) => {
      const titleA = (a.book?.title || '').toLowerCase();
      const titleB = (b.book?.title || '').toLowerCase();
      const byTitle = titleA.localeCompare(titleB);
      if (byTitle !== 0) return byTitle;

      // 同书名下按请求时间新到旧，便于查看最新变更
      const timeA = a.request_date ? new Date(a.request_date).getTime() : 0;
      const timeB = b.request_date ? new Date(b.request_date).getTime() : 0;
      return timeB - timeA;
    });
  }, [records, keyword, statusFilter, startDate, endDate]);

  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(records.map((item) => item.status).filter(Boolean)));
    return ['all', ...statuses];
  }, [records]);

  if (!hasPermission(ROLES.LIBRARIAN)) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>Access denied.</div>;
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading borrow records...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <header style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '400' }}>Borrow Records</h2>
        <p style={{ margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>
          View all borrow, reserve, renew, and return records.
        </p>
      </header>

      <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search by title, user, ISBN, status..."
          style={{
            width: '100%',
            maxWidth: '360px',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid var(--md-sys-color-outline)',
            background: 'var(--md-sys-color-surface)',
            color: 'var(--md-sys-color-on-surface)',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={filterControlStyle}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status === 'all' ? 'All Statuses' : status}
            </option>
          ))}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={filterControlStyle} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={filterControlStyle} />
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
            setStartDate('');
            setEndDate('');
            setKeyword('');
          }}
          style={resetBtnStyle}
        >
          Reset
        </button>
      </div>

      <MdCard variant="outlined">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--md-sys-color-surface-container-lowest)' }}>
                <th style={thStyle}>Book</th>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Request Date</th>
                <th style={thStyle}>Due Date</th>
                <th style={thStyle}>Returned At</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500 }}>{item.book?.title || `#${item.book_id}`}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>ISBN: {item.book?.isbn || '-'}</div>
                  </td>
                  <td style={tdStyle}>{item.user?.username || `#${item.user_id}`}</td>
                  <td style={tdStyle}>{item.status}</td>
                  <td style={tdStyle}>{formatDate(item.request_date)}</td>
                  <td style={tdStyle}>{item.due_date ? formatDate(item.due_date) : '-'}</td>
                  <td style={tdStyle}>{item.actual_return_date ? formatDate(item.actual_return_date) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRecords.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              No records found.
            </div>
          )}
        </div>
      </MdCard>
    </div>
  );
};

const thStyle = {
  textAlign: 'left',
  padding: '12px 14px',
  fontSize: '0.82rem',
  color: 'var(--md-sys-color-on-surface-variant)',
  textTransform: 'uppercase',
};

const tdStyle = {
  padding: '12px 14px',
  fontSize: '0.92rem',
  verticalAlign: 'middle',
};

const filterControlStyle = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid var(--md-sys-color-outline)',
  background: 'var(--md-sys-color-surface)',
  color: 'var(--md-sys-color-on-surface)',
};

const resetBtnStyle = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid var(--md-sys-color-outline)',
  background: 'transparent',
  color: 'var(--md-sys-color-primary)',
  cursor: 'pointer',
};

export default BorrowRecords;
