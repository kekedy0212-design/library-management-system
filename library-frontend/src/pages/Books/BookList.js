import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooks } from '../../hooks/useBooks';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';

const BookList = () => {
  const navigate = useNavigate();
  const { books, loading, error, fetchBooks, deleteBook } = useBooks();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBooks(searchQuery);
  };

  const handleViewDetail = (bookId) => {
    navigate(`/books/${bookId}`);
  };

  const handleCreate = () => {
    navigate('/books/new');
  };

  const handleEdit = (bookId) => {
    navigate(`/books/${bookId}/edit`);
  };

  const handleDelete = async (bookId) => {
    if (!window.confirm('确定要删除这本书吗？此操作不可恢复。')) {
      return;
    }

    try {
      await deleteBook(bookId);
      alert('书籍已删除');
    } catch (err) {
      alert(`删除失败: ${err.response?.data?.detail || err.message}`);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h2>书籍搜索</h2>

      <div className="card">
        <form onSubmit={handleSearch}>
          <div className="form-group">
            <label htmlFor="search">搜索书籍</label>
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="输入书名、作者或ISBN"
            />
          </div>
          <button type="submit" className="btn">搜索</button>
        </form>
      </div>

      {hasPermission(ROLES.LIBRARIAN) && (
        <div className="card">
          <button className="btn" onClick={handleCreate}>添加新书</button>
        </div>
      )}

      <div className="card">
        <h3>搜索结果 ({books.length} 本书籍)</h3>
        <table className="table">
          <thead>
            <tr>
              <th>书名</th>
              <th>作者</th>
              <th>ISBN</th>
              <th>总藏书</th>
              <th>可借数量</th>
              <th>位置</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {books.map(book => (
              <tr key={book.id}>
                <td>{book.title}</td>
                <td>{book.author}</td>
                <td>{book.isbn}</td>
                <td>{book.total_copies}</td>
                <td>{book.available_copies}</td>
                <td>{book.location || '未设置'}</td>
                <td>
                  {book.available_copies > 0 ? (
                    <span style={{ color: 'green' }}>可借阅</span>
                  ) : (
                    <span style={{ color: 'red' }}>暂无库存</span>
                  )}
                </td>
                <td>
                  <button className="btn" onClick={() => handleViewDetail(book.id)}>
                    查看详情
                  </button>
                  {hasPermission(ROLES.LIBRARIAN) && (
                    <>
                      <button className="btn" onClick={() => handleEdit(book.id)}>编辑</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(book.id)}>删除</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {books.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            {searchQuery ? '未找到匹配的书籍' : '暂无书籍数据'}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookList;