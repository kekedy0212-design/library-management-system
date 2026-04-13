import React, { useEffect, useState } from 'react';
import { useBooks } from '../../hooks/useBooks';
import { formatDate } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';

const BookList = () => {
  const { books, loading, error, fetchBooks } = useBooks();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBooks(searchQuery);
  }, [fetchBooks, searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBooks(searchQuery);
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h2>书籍管理</h2>
      
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
          <button className="btn">添加新书</button>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>书名</th>
              <th>作者</th>
              <th>ISBN</th>
              <th>总藏书</th>
              <th>可借数量</th>
              <th>位置</th>
              <th>创建时间</th>
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
                <td>{formatDate(book.created_at)}</td>
                <td>
                  <button className="btn">查看</button>
                  {hasPermission(ROLES.LIBRARIAN) && (
                    <>
                      <button className="btn">编辑</button>
                      <button className="btn btn-danger">删除</button>
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

export default BookList;