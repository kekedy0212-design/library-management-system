import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPendingRequestsStart, fetchPendingRequestsSuccess, fetchPendingRequestsFailure, updateBorrowRequest } from '../../store/slices/borrowSlice';
import { borrowService } from '../../services/borrowService';
import { formatDate, getStatusText, getStatusColor } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard';

const RequestApproval = () => {
  const dispatch = useDispatch();
  const { pendingRequests, loading, error } = useSelector(state => state.borrow);
  const [processingId, setProcessingId] = useState(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState([]);
  const [notes, setNotes] = useState('');

  const fetchPendingRequests = useCallback(async () => {
    dispatch(fetchPendingRequestsStart());
    try {
      const response = await borrowService.getPendingRequests();
      dispatch(fetchPendingRequestsSuccess(response.data));
    } catch (err) {
      dispatch(fetchPendingRequestsFailure(err.message));
    }
  }, [dispatch]);

  useEffect(() => {
    if (hasPermission(ROLES.LIBRARIAN)) {
      fetchPendingRequests();
    }
  }, [fetchPendingRequests]);

  useEffect(() => {
    const pendingIds = new Set(pendingRequests.map(request => request.id));
    setSelectedRequestIds(prev => prev.filter(id => pendingIds.has(id)));
  }, [pendingRequests]);

  const handleProcessRequest = async (requestId, action) => {
    const actionLabel = action === 'approve' ? 'approve' : 'reject';
    if (!window.confirm(`Are you sure you want to ${actionLabel} this request?`)) {
      return;
    }

    setProcessingId(requestId);
    try {
      const response = await borrowService.processRequest(requestId, action, notes);
      dispatch(updateBorrowRequest(response.data));
      alert(`Request ${actionLabel}d successfully`);
      setNotes('');
      await fetchPendingRequests();
    } catch (err) {
      alert(`Operation failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const allSelected = pendingRequests.length > 0 && selectedRequestIds.length === pendingRequests.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRequestIds([]);
      return;
    }
    setSelectedRequestIds(pendingRequests.map(request => request.id));
  };

  const toggleSelectOne = (requestId) => {
    setSelectedRequestIds(prev => {
      if (prev.includes(requestId)) {
        return prev.filter(id => id !== requestId);
      }
      return [...prev, requestId];
    });
  };

  const handleBatchProcess = async (action) => {
    const actionLabel = action === 'approve' ? 'approve' : 'reject';
    if (selectedRequestIds.length === 0) {
      alert('Please select at least one request.');
      return;
    }
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${selectedRequestIds.length} selected request(s)?`)) {
      return;
    }

    setBatchProcessing(true);
    try {
      const response = await borrowService.processRequestsBatch(selectedRequestIds, action, notes);
      const { success_count, failure_count } = response.data;
      alert(`Batch ${actionLabel} completed. Success: ${success_count}, Failed: ${failure_count}`);
      setSelectedRequestIds([]);
      setNotes('');
      await fetchPendingRequests();
    } catch (err) {
      alert(`Batch operation failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBatchProcessing(false);
    }
  };

  if (!hasPermission(ROLES.LIBRARIAN)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>
        Access Denied. Only librarians can access this management portal.
      </div>
    );
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Loading requests...</div>;
  if (error) return <div style={{ color: 'var(--md-sys-color-error)', padding: '20px' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '400', margin: '0 0 8px 0' }}>Pending Approvals</h2>
        <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          Review and process book loan or return requests from library members.
        </p>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleBatchProcess('approve')}
            disabled={batchProcessing || selectedRequestIds.length === 0 || processingId !== null}
            style={approveBtnStyle}
          >
            {batchProcessing ? 'Processing...' : `Approve Selected `}
          </button>
          <button
            onClick={() => handleBatchProcess('reject')}
            disabled={batchProcessing || selectedRequestIds.length === 0 || processingId !== null}
            style={rejectBtnStyle}
          >
            Reject Selected
          </button>
        </div>
      </header>

      <MdCard variant="outlined">
        {/* Global Notes Field */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
          <label
            htmlFor="notes"
            style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--md-sys-color-on-surface-variant)' }}
          >
            Approval Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for rejection or special instructions for approval..."
            rows={2}
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid var(--md-sys-color-outline)',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              resize: 'none',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}>
                <th style={thStyle}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={pendingRequests.length === 0 || batchProcessing || processingId !== null}
                    aria-label="Select all requests"
                  />
                </th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Book Title</th>
                <th style={thStyle}>Member</th>
                <th style={thStyle}>Request Date</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map(request => (
                <tr key={request.id} style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={selectedRequestIds.includes(request.id)}
                      onChange={() => toggleSelectOne(request.id)}
                      disabled={batchProcessing || processingId !== null}
                      aria-label={`Select request ${request.id}`}
                    />
                  </td>
                  <td style={tdStyle}>
                    <TypeBadge status={request.status} />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: '500' }}>{request.book?.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>ISBN: {request.book?.isbn}</div>
                  </td>
                  <td style={tdStyle}>{request.user?.username}</td>
                  <td style={tdStyle}>{formatDate(request.request_date)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleProcessRequest(request.id, 'approve')}
                        disabled={processingId === request.id || batchProcessing}
                        style={approveBtnStyle}
                      >
                        {processingId === request.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleProcessRequest(request.id, 'reject')}
                        disabled={processingId === request.id || batchProcessing}
                        style={rejectBtnStyle}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pendingRequests.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>Inbox</div>
              <p>All clear! There are no pending requests to process.</p>
            </div>
          )}
        </div>
      </MdCard>
    </div>
  );
};

// --- MD3 Helpers ---

const thStyle = { padding: '16px', fontSize: '0.85rem', fontWeight: '500', color: 'var(--md-sys-color-on-surface-variant)' };
const tdStyle = { padding: '16px', verticalAlign: 'middle' };

const approveBtnStyle = {
  backgroundColor: 'var(--md-sys-color-primary)',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '100px',
  fontWeight: '500',
  cursor: 'pointer',
  fontSize: '0.875rem'
};

const rejectBtnStyle = {
  backgroundColor: 'transparent',
  color: 'var(--md-sys-color-error)',
  border: '1px solid var(--md-sys-color-error)',
  padding: '8px 16px',
  borderRadius: '100px',
  fontWeight: '500',
  cursor: 'pointer',
  fontSize: '0.875rem'
};

const TypeBadge = ({ status }) => {
  const isBorrow = status === 'pending';
  return (
    <span style={{
      padding: '4px 12px',
      borderRadius: '8px',
      fontSize: '0.75rem',
      fontWeight: '600',
      backgroundColor: isBorrow ? 'var(--md-sys-color-secondary-container)' : 'var(--md-sys-color-tertiary-container)',
      color: isBorrow ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-tertiary-container)',
    }}>
      {isBorrow ? 'BORROW' : 'RETURN'}
    </span>
  );
};

export default RequestApproval;