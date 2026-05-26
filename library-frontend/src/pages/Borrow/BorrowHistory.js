import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchBorrowHistoryStart, fetchBorrowHistorySuccess, fetchBorrowHistoryFailure } from '../../store/slices/borrowSlice';
import { borrowService } from '../../services/borrowService';
import { formatDate } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard';
import ReturnScannerDialog from '../../components/ReturnScannerDialog';
import fineService from '../../services/fineService';

const BorrowHistory = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { borrowHistory, loading, error } = useSelector(state => state.borrow);
  const [returnLoading, setReturnLoading] = useState(null);
  const [batchReturning, setBatchReturning] = useState(false);
  const [selectedReturnIds, setSelectedReturnIds] = useState([]);
  const [renewLoading, setRenewLoading] = useState(null);
  const [returnScannerOpen, setReturnScannerOpen] = useState(false);
  const [unpaidFineSummary, setUnpaidFineSummary] = useState(null);

  const isRenewRequestRecord = useCallback(
    (record) => (record?.librarian_notes || '').startsWith('__RENEW__:'),
    []
  );
  const visibleHistory = useMemo(
    () => borrowHistory.filter(record => !isRenewRequestRecord(record)),
    [borrowHistory, isRenewRequestRecord]
  );

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
    fineService.getMyFines()
      .then((res) => setUnpaidFineSummary(res.data))
      .catch(() => setUnpaidFineSummary(null));
  }, [borrowHistory]);

  useEffect(() => {
    const eligibleIds = new Set(
      visibleHistory
        .filter(record => record.status === 'approved')
        .map(record => record.id)
    );
    setSelectedReturnIds(prev => {
      const next = prev.filter(id => eligibleIds.has(id));
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [visibleHistory]);

  const handleReturn = async (recordId) => {
    if (!window.confirm('Return this book now?')) {
      return;
    }

    setReturnLoading(recordId);
    try {
      const response = await borrowService.returnRequest(recordId);
      const data = response.data;
      if (data?.overdue_fine_created && data?.fine_message) {
        alert(`${data.fine_message}\n\nReturn completed.`);
      } else {
        alert('Book returned successfully.');
      }
      await fetchHistory();
      const fineRes = await fineService.getMyFines();
      setUnpaidFineSummary(fineRes.data);
    } catch (err) {
      alert(`Return failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setReturnLoading(null);
    }
  };

  const returnableRecords = visibleHistory.filter(record => record.status === 'approved');
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
    if (!window.confirm(`Return ${selectedReturnIds.length} book(s) now?`)) {
      return;
    }

    setBatchReturning(true);
    try {
      const response = await borrowService.returnRequestBatch(selectedReturnIds);
      const { success_count, failure_count } = response.data;
      alert(`Batch return completed. Success: ${success_count}, Failed: ${failure_count}.`);
      setSelectedReturnIds([]);
      await fetchHistory();
    } catch (err) {
      alert(`Batch return request failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBatchReturning(false);
    }
  };

  const handleRenew = async (recordId) => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);
    const defaultText = defaultDate.toISOString().slice(0, 10);
    const input = window.prompt('Enter your preferred return date (YYYY-MM-DD):', defaultText);
    if (input === null) {
      return;
    }

    const trimmed = input.trim();
    let requestedDueDateIso = null;
    if (trimmed) {
      const parsed = new Date(`${trimmed}T23:59:59`);
      if (Number.isNaN(parsed.getTime())) {
        alert('Invalid date format. Please use YYYY-MM-DD.');
        return;
      }
      const currentDueDate = recordId
        ? new Date((visibleHistory.find(item => item.id === recordId)?.due_date) || 0)
        : null;
      if (currentDueDate && currentDueDate.getTime() > 0 && parsed <= currentDueDate) {
        alert('Preferred renew date must be later than current due date.');
        return;
      }
      requestedDueDateIso = parsed.toISOString();
    }

    if (!window.confirm('Submit a renew request for this book?')) {
      return;
    }
    setRenewLoading(recordId);
    try {
      await borrowService.renewRequest(recordId, requestedDueDateIso);
      alert('Renew request submitted. Please wait for librarian approval.');
      await fetchHistory();
    } catch (err) {
      alert(`Renew failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setRenewLoading(null);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading your records...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      {unpaidFineSummary?.has_unpaid && (
        <div
          style={{
            marginBottom: '20px',
            padding: '14px 16px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)',
          }}
        >
          You have {unpaidFineSummary.unpaid_count} unpaid overdue fine
          {unpaidFineSummary.unpaid_count !== 1 ? 's' : ''} (total ¥
          {unpaidFineSummary.unpaid_total}). Pay them on the Fines page before
          borrowing other books.
        </div>
      )}
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '400', margin: 0 }}>Borrowing Activity</h2>
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Track your library history and pending requests</p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* <button
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
            </button> */}
            <button
              onClick={() => setReturnScannerOpen(true)}
              style={actionButtonStyle}
            >
              Scan Return
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

      <div
        style={{
          marginBottom: '12px',
          color: 'var(--md-sys-color-error)',
          fontSize: '0.9rem',
          fontWeight: '600',
        }}
      >
        Red highlight means this book is due within 3 days.
      </div>

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
              {visibleHistory
                .filter(record => record.book)
                .map(record => (
                  <tr
                    key={record.id}
                    style={{
                      borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <td style={tableCellStyle}>
                      <input
                        type="checkbox"
                        checked={selectedReturnIds.includes(record.id)}
                        onChange={() => toggleSelectReturn(record.id)}
                        disabled={
                          record.status !== 'approved' ||
                          batchReturning ||
                          returnLoading !== null
                        }
                        aria-label={`Select borrow record ${record.id} for return`}
                      />
                    </td>

                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: '500' }}>
                        {record.book.title}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#666' }}>
                        ISBN: {record.book.isbn}
                      </div>
                    </td>

                    <td style={tableCellStyle}>
                      {formatDate(record.request_date)}
                    </td>

                    <td style={tableCellStyle}>
                      {record.due_date ? (
                        <span
                          style={{
                            color: shouldHighlightDueDate(record)
                              ? 'var(--md-sys-color-error)'
                              : 'inherit'
                          }}
                        >
                          {formatDate(record.due_date)}
                        </span>
                      ) : '-'}
                    </td>

                    <td style={tableCellStyle}>
                      <StatusBadge
                        status={record.status}
                        notes={record.librarian_notes}
                      />

                      {isAutoAssignedReservation(record) && (
                        <div
                          style={{
                            marginTop: '6px',
                            display: 'inline-block',
                            backgroundColor: '#e8f5e9',
                            color: '#1b5e20',
                            border: '1px solid #a5d6a7',
                            borderRadius: '10px',
                            padding: '2px 8px',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                          }}
                        >
                          Auto assigned from reservation
                        </div>
                      )}
                    </td>

                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                      {record.status === 'approved' && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'flex-end'
                          }}
                        >
                          <button
                            onClick={() => handleRenew(record.id)}
                            disabled={
                              renewLoading === record.id ||
                              returnLoading === record.id ||
                              batchReturning
                            }
                            style={actionButtonStyle}
                          >
                            {renewLoading === record.id
                              ? 'Processing...'
                              : 'Renew'}
                          </button>

                          {/* <button
                            onClick={() => handleReturn(record.id)}
                            disabled={
                              returnLoading === record.id ||
                              renewLoading === record.id ||
                              batchReturning
                            }
                            style={actionButtonStyle}
                          >
                            {returnLoading === record.id
                              ? 'Processing...'
                              : 'Return Book'}
                          </button> */}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {visibleHistory.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              No borrowing history found.
            </div>
          )}
        </div>
      </MdCard>
      <ReturnScannerDialog
        open={returnScannerOpen}
        onClose={() =>
          setReturnScannerOpen(false)
        }
        borrowHistory={borrowHistory}
        onSuccess={fetchHistory}
      />
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

const StatusBadge = ({ status, notes = '' }) => {
  // MD3 Color Mapping for Statuses
  const colors = {
    pending: { bg: '#fff7e6', text: '#b26b00', label: 'Pending' },
    approved: { bg: '#e8f5e9', text: '#2e7d32', label: 'On Loan' },
    return_pending: { bg: '#e3f2fd', text: '#0d47a1', label: 'Return Pending' },
    returned: { bg: '#f0f0f0', text: '#555555', label: 'Returned' },
    rejected: { bg: '#f9e8e8', text: '#b3261e', label: 'Rejected' }
  };

  const config = colors[status] || { bg: '#eee', text: '#333', label: status };
  if (status === 'pending' && (notes || '').startsWith('__RESERVE__')) {
    config.label = 'Reservation Pending';
  }

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

const isAutoAssignedReservation = (record) => {
  const notes = record?.librarian_notes || '';
  return notes.startsWith('__RESERVE__|AUTO_ASSIGNED');
};

const isDueWithinThreeDays = (dateString) => {
  if (!dateString) return false;
  const now = new Date();
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const due = new Date(dateString);
  return due >= now && due <= threeDaysLater;
};

const shouldHighlightDueDate = (record) => {
  if (!record || record.status !== 'approved') return false;
  return isDueWithinThreeDays(record.due_date);
};

export default BorrowHistory;