import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBooks } from '../../hooks/useBooks';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';

const BookForm = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { currentBook, loading, fetchBookById, createBook, updateBook } = useBooks();
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '',
    total_copies: 1,
    available_copies: 1,
    location: '',
  });
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (isEdit) {
      fetchBookById(parseInt(id));
    }
  }, [id, isEdit, fetchBookById]);

  useEffect(() => {
    if (isEdit && currentBook) {
      setFormData({
        title: currentBook.title || '',
        author: currentBook.author || '',
        isbn: currentBook.isbn || '',
        description: currentBook.description || '',
        total_copies: currentBook.total_copies || 1,
        available_copies: currentBook.available_copies || 1,
        location: currentBook.location || '',
      });
    }
  }, [isEdit, currentBook]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name.includes('copies') ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSaving(true);

    try {
      if (isEdit) {
        await updateBook(parseInt(id), formData);
        alert('书籍更新成功');
      } else {
        await createBook(formData);
        alert('书籍已添加');
      }
      navigate('/books');
    } catch (err) {
      setSubmitError(err.response?.data?.detail || err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!hasPermission(ROLES.LIBRARIAN)) {
    return <div className="error">只有图书管理员才能管理书籍。</div>;
  }

  if (loading && isEdit && !currentBook) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <h2>{isEdit ? '编辑图书' : '添加新书'}</h2>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">书名</label>
            <input id="title" name="title" value={formData.title} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="author">作者</label>
            <input id="author" name="author" value={formData.author} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="isbn">ISBN</label>
            <input id="isbn" name="isbn" value={formData.isbn} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="description">简介</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={4} />
          </div>

          <div className="form-group">
            <label htmlFor="total_copies">总藏书</label>
            <input id="total_copies" name="total_copies" type="number" min="1" value={formData.total_copies} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="available_copies">可借数量</label>
            <input id="available_copies" name="available_copies" type="number" min="0" max={formData.total_copies} value={formData.available_copies} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="location">存放位置</label>
            <input id="location" name="location" value={formData.location} onChange={handleChange} />
          </div>

          {submitError && <div className="error" style={{ marginBottom: '1rem' }}>{submitError}</div>}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => navigate('/books')}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookForm;
