import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchBorrowHistoryStart, fetchBorrowHistorySuccess, fetchBorrowHistoryFailure } from '../../store/slices/borrowSlice';
import { borrowService } from '../../services/borrowService';
import { formatDate, getStatusText, getStatusColor } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';

const BorrowHistory = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { borrowHistory, loading, error } = useSelector(state => state.borrow);
  const [returnLoading, setReturnLoading] = useState(null);

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

  const handleReturn = async (recordId) => {
    if (!window.confirm('确定要申请归还这本书吗？')) {
      return;
    }

    setReturnLoading(recordId);
    try {
      await borrowService.returnRequest(recordId);
      alert('还书请求已提交，请等待管理员审批');
      await fetchHistory(); // 重新获取历史记录
    } catch (err) {
      alert(`还书失败: ${err.response?.data?.detail || err.message}`);
    } finally {
      setReturnLoading(null);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h2>借阅历史</h2>
      
      {hasPermission(ROLES.LIBRARIAN) && (
        <div className="card">
          <button className="btn" onClick={() => navigate('/admin/requests')}>处理待审批请求</button>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>书名</th>
              <th>ISBN</th>
              <th>申请时间</th>
              <th>审批时间</th>
              <th>到期时间</th>
              <th>归还时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {borrowHistory.map(record => (
              <tr key={record.id}>
                <td>{record.book?.title}</td>
                <td>{record.book?.isbn}</td>
                <td>{formatDate(record.request_date)}</td>
                <td>{formatDate(record.approve_date)}</td>
                <td>{formatDate(record.due_date)}</td>
                <td>{formatDate(record.actual_return_date)}</td>
                <td>
                  <span style={{ color: getStatusColor(record.status) }}>
                    {getStatusText(record.status)}
                  </span>
                </td>
                <td>
                  {record.status === 'approved' && (
                    <button
                      className="btn"
                      onClick={() => handleReturn(record.id)}
                      disabled={returnLoading === record.id}
                    >
                      {returnLoading === record.id ? '处理中...' : '申请归还'}
                    </button>
                  )}
                  {hasPermission(ROLES.LIBRARIAN) && record.status === 'pending' && (
                    <>
                      <button className="btn">批准</button>
                      <button className="btn btn-danger">拒绝</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BorrowHistory;