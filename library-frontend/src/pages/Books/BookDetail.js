import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooks } from '../../hooks/useBooks';
import { useBorrow } from '../../hooks/useBorrow';
import { formatDate } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';

const BookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentBook, loading, error, fetchBookById, deleteBook } = useBooks();
  const { borrowBook } = useBorrow();
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBookById(parseInt(id));
    }
  }, [id, fetchBookById]);

  const handleBorrow = async () => {
    setBorrowLoading(true);
    try {
      await borrowBook(currentBook.id);
      alert('借书请求已提交，请等待管理员审批');
      navigate('/borrow');
    } catch (err) {
      alert(`借书失败: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBorrowLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/books/${id}/edit`);
  };

  const handleDelete = async () => {
    if (!window.confirm('确定要删除这本书吗？此操作不可恢复。')) {
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteBook(currentBook.id);
      alert('书籍已删除');
      navigate('/books');
    } catch (err) {
      alert(`删除失败: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!currentBook) return <div className="error">书籍不存在</div>;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>{currentBook.title}</h2>
          <button className="btn btn-secondary" onClick={() => navigate('/books')}>
            返回列表
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h3>基本信息</h3>
            <table className="table" style={{ marginBottom: '2rem' }}>
              <tbody>
                <tr>
                  <td><strong>书名：</strong></td>
                  <td>{currentBook.title}</td>
                </tr>
                <tr>
                  <td><strong>作者：</strong></td>
                  <td>{currentBook.author}</td>
                </tr>
                <tr>
                  <td><strong>ISBN：</strong></td>
                  <td>{currentBook.isbn}</td>
                </tr>
                <tr>
                  <td><strong>出版社：</strong></td>
                  <td>{currentBook.publisher || '未设置'}</td>
                </tr>
                <tr>
                  <td><strong>出版日期：</strong></td>
                  <td>{currentBook.publish_date ? formatDate(currentBook.publish_date) : '未设置'}</td>
                </tr>
                <tr>
                  <td><strong>类别：</strong></td>
                  <td>{currentBook.category || '未设置'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3>库存信息</h3>
            <table className="table" style={{ marginBottom: '2rem' }}>
              <tbody>
                <tr>
                  <td><strong>总藏书：</strong></td>
                  <td>{currentBook.total_copies}</td>
                </tr>
                <tr>
                  <td><strong>可借数量：</strong></td>
                  <td>{currentBook.available_copies}</td>
                </tr>
                <tr>
                  <td><strong>已借出：</strong></td>
                  <td>{currentBook.total_copies - currentBook.available_copies}</td>
                </tr>
                <tr>
                  <td><strong>位置：</strong></td>
                  <td>{currentBook.location || '未设置'}</td>
                </tr>
                <tr>
                  <td><strong>状态：</strong></td>
                  <td>
                    {currentBook.available_copies > 0 ? (
                      <span style={{ color: 'green' }}>可借阅</span>
                    ) : (
                      <span style={{ color: 'red' }}>暂无库存</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {currentBook.description && (
          <div style={{ marginBottom: '2rem' }}>
            <h3>书籍简介</h3>
            <p style={{ lineHeight: '1.6', color: '#555' }}>{currentBook.description}</p>
          </div>
        )}

        <div style={{ marginBottom: '2rem' }}>
          <h3>其他信息</h3>
          <table className="table">
            <tbody>
              <tr>
                <td><strong>创建时间：</strong></td>
                <td>{formatDate(currentBook.created_at)}</td>
              </tr>
              <tr>
                <td><strong>最后更新：</strong></td>
                <td>{currentBook.updated_at ? formatDate(currentBook.updated_at) : '从未更新'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {currentBook.available_copies > 0 && (
            <button
              className="btn btn-primary"
              onClick={handleBorrow}
              disabled={borrowLoading}
            >
              {borrowLoading ? '处理中...' : '借阅此书'}
            </button>
          )}

          {hasPermission(ROLES.LIBRARIAN) && (
            <>
              <button className="btn btn-warning" onClick={handleEdit}>
                编辑书籍
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? '删除中...' : '删除书籍'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookDetail;