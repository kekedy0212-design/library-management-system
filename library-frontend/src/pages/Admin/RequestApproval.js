import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPendingRequestsStart, fetchPendingRequestsSuccess, fetchPendingRequestsFailure, updateBorrowRequest } from '../../store/slices/borrowSlice';
import { borrowService } from '../../services/borrowService';
import { formatDate, getStatusText, getStatusColor } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';

const RequestApproval = () => {
  const dispatch = useDispatch();
  const { pendingRequests, loading, error } = useSelector(state => state.borrow);
  const [processingId, setProcessingId] = useState(null);
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

  const handleProcessRequest = async (requestId, action) => {
    if (!window.confirm(`确定要${action === 'approve' ? '批准' : '拒绝'}这个请求吗？`)) {
      return;
    }

    setProcessingId(requestId);
    try {
      const response = await borrowService.processRequest(requestId, action, notes);
      dispatch(updateBorrowRequest(response.data));
      alert(`${action === 'approve' ? '批准' : '拒绝'}成功`);
      setNotes('');
      await fetchPendingRequests(); // 重新获取待审批请求
    } catch (err) {
      alert(`处理失败: ${err.response?.data?.detail || err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (!hasPermission(ROLES.LIBRARIAN)) {
    return <div className="error">只有图书管理员才能访问此页面。</div>;
  }

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h2>待审批请求</h2>

      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="notes">审批备注（可选）：</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="输入审批备注..."
            rows={2}
            style={{ width: '100%', marginTop: '0.5rem' }}
          />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>类型</th>
              <th>书名</th>
              <th>ISBN</th>
              <th>申请人</th>
              <th>申请时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {pendingRequests.map(request => (
              <tr key={request.id}>
                <td>
                  {request.status === 'pending' ? '借阅申请' : '归还申请'}
                </td>
                <td>{request.book?.title}</td>
                <td>{request.book?.isbn}</td>
                <td>{request.user?.username}</td>
                <td>{formatDate(request.request_date)}</td>
                <td>
                  <span style={{ color: getStatusColor(request.status) }}>
                    {getStatusText(request.status)}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-success"
                    onClick={() => handleProcessRequest(request.id, 'approve')}
                    disabled={processingId === request.id}
                    style={{ marginRight: '0.5rem' }}
                  >
                    {processingId === request.id ? '处理中...' : '批准'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleProcessRequest(request.id, 'reject')}
                    disabled={processingId === request.id}
                  >
                    拒绝
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pendingRequests.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            暂无待审批的请求
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestApproval;