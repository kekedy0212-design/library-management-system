import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchBorrowHistoryStart, fetchBorrowHistorySuccess, fetchBorrowHistoryFailure } from '../../store/slices/borrowSlice';
import { borrowService } from '../../services/borrowService';
import { formatDate, getStatusText, getStatusColor } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard';

const BorrowHistory = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { borrowHistory, loading, error } = useSelector(state => state.borrow);
  const [returnLoading, setReturnLoading] = useState(null);
  const [batchReturning, setBatchReturning] = useState(false);
  const [selectedReturnIds, setSelectedReturnIds] = useState([]);

  const fetchHistory = useCallback(async () => {
    dispatch(fetchBorrowHistoryStart());
    try {
      const response = await borrowService.getBorrowHistory();
      dispatch(fetchBorrowHistorySuccess(response.data));
    } catch (err) {
      dispatch(fetchBorrowHistoryFailure(err.message));
    }
  }, [dispatch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const eligibleIds = new Set(
      borrowHistory
        .filter(record => record.status === 'approved')
        .map(record => record.id)
    );
    setSelectedReturnIds(prev => prev.filter(id => eligibleIds.has(id)));
  }, [borrowHistory]);

  const handleReturn = async (recordId) => {
    if (!window.confirm('Are you sure you want to request to return this book?')) {
      return;
    }

    setReturnLoading(recordId);
    try {
      await borrowService.returnRequest(recordId);
      alert('Return request submitted. Please wait for librarian approval.');
      await fetchHistory();
    } catch (err) {
      alert(`Return failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setReturnLoading(null);
    }
  };

  const returnableRecords = borrowHistory.filter(record => record.status === 'approved');
  const allReturnableSelected =
    returnableRecords.length > 0 && selectedReturnIds.length === returnableRecords.length;

  const toggleSelectAllReturnable = () => {
    if (allReturnableSelected) {
      setSelectedReturnIds([]);
      return;
    }
    setSelectedReturnIds(returnableRecords.map(record => record.id));
  };

  const toggleSelectReturn = (recordId) => {
    setSelectedReturnIds(prev => (
      prev.includes(recordId) ? prev.filter(id => id !== recordId) : [...prev, recordId]
    ));
  };

  const handleBatchReturn = async () => {
    if (selectedReturnIds.length === 0) {
      alert('Please select at least one borrowed book.');
      return;
    }
    if (!window.confirm(`Submit return request for ${selectedReturnIds.length} book(s)?`)) {
      return;
    }

    setBatchReturning(true);
    try {
      const response = await borrowService.returnRequestBatch(selectedReturnIds);
      const { success_count, failure_count } = response.data;
      alert(`Batch return submitted. Success: ${success_count}, Failed: ${failure_count}`);
      setSelectedReturnIds([]);
      await fetchHistory();
    } catch (err) {
      alert(`Batch return failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBatchReturning(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading your records...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '400', margin: 0 }}>Borrowing Activity</h2>
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Track your library history and pending requests</p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleBatchReturn}
              disabled={batchReturning || returnLoading !== null || selectedReturnIds.length === 0}
              style={actionButtonStyle}
            >
              {batchReturning ? 'Processing...' : `Return Selected (${selectedReturnIds.length})`}
            </button>
            <button
              onClick={toggleSelectAllReturnable}
              disabled={batchReturning || returnLoading !== null || returnableRecords.length === 0}
              style={actionButtonStyle}
            >
              {allReturnableSelected ? 'Clear Selection' : 'Select All Returnable'}
            </button>
          </div>
        </div>

        {hasPermission(ROLES.LIBRARIAN) && (
          <button
            onClick={() => navigate('/admin/requests')}
            style={{
              padding: '12px 24px',
              borderRadius: '100px',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-tertiary-container, #ffd8e4)',
              color: 'var(--md-sys-color-on-tertiary-container, #31111d)',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Review Requests
          </button>
        )}
      </header>

      <MdCard variant="outlined">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                <th style={tableHeaderStyle}>Select</th>
                <th style={tableHeaderStyle}>Book Details</th>
                <th style={tableHeaderStyle}>Requested</th>
                <th style={tableHeaderStyle}>Due Date</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {borrowHistory.map(record => (
                <tr key={record.id} style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)', transition: 'background 0.2s' }}>
                  <td style={tableCellStyle}>
                    <input
                      type="checkbox"
                      checked={selectedReturnIds.includes(record.id)}
                      onChange={() => toggleSelectReturn(record.id)}
                      disabled={record.status !== 'approved' || batchReturning || returnLoading !== null}
                      aria-label={`Select borrow record ${record.id} for return`}
                    />
                  </td>
                  <td style={tableCellStyle}>
                    <div style={{ fontWeight: '500' }}>{record.book?.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>ISBN: {record.book?.isbn}</div>
                  </td>
                  <td style={tableCellStyle}>{formatDate(record.request_date)}</td>
                  <td style={tableCellStyle}>
                    {record.due_date ? (
                      <span style={{ color: isOverdue(record.due_date) ? 'var(--md-sys-color-error)' : 'inherit' }}>
                        {formatDate(record.due_date)}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={tableCellStyle}>
                    <StatusBadge status={record.status} />
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                    {record.status === 'approved' && (
                      <button
                        onClick={() => handleReturn(record.id)}
                        disabled={returnLoading === record.id || batchReturning}
                        style={actionButtonStyle}
                      >
                        {returnLoading === record.id ? 'Processing...' : 'Return Book'}
                      </button>
                    )}
                    {hasPermission(ROLES.LIBRARIAN) && record.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button style={actionButtonStyle}>Approve</button>
                        <button style={{ ...actionButtonStyle, color: 'var(--md-sys-color-error)' }}>Deny</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {borrowHistory.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              No borrowing history found.
            </div>
          )}
        </div>
      </MdCard>
    </div>
  );
};

// --- Styled Helpers ---

const tableHeaderStyle = {
  padding: '16px',
  fontSize: '0.85rem',
  color: 'var(--md-sys-color-on-surface-variant)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const tableCellStyle = {
  padding: '16px',
  fontSize: '0.95rem',
  verticalAlign: 'middle'
};

const actionButtonStyle = {
  background: 'transparent',
  border: '1px solid var(--md-sys-color-outline)',
  borderRadius: '8px',
  padding: '6px 16px',
  fontSize: '0.875rem',
  fontWeight: '500',
  color: 'var(--md-sys-color-primary)',
  cursor: 'pointer',
};

const StatusBadge = ({ status }) => {
  // MD3 Color Mapping for Statuses
  const colors = {
    pending: { bg: '#fff7e6', text: '#b26b00', label: 'Pending' },
    approved: { bg: '#e8f5e9', text: '#2e7d32', label: 'On Loan' },
    returned: { bg: '#f0f0f0', text: '#555555', label: 'Returned' },
    rejected: { bg: '#f9e8e8', text: '#b3261e', label: 'Rejected' }
  };

  const config = colors[status] || { bg: '#eee', text: '#333', label: status };

  return (
    <span style={{
      backgroundColor: config.bg,
      color: config.text,
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: '600',
      display: 'inline-block'
    }}>
      {config.label}
    </span>
  );
};

const isOverdue = (dateString) => {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
};

export default BorrowHistory;