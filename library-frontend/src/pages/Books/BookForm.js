import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBooks } from '../../hooks/useBooks';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard'; // Adjust path as necessary

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
        alert('Book updated successfully');
      } else {
        await createBook(formData);
        alert('Book added successfully');
      }
      navigate('/books');
    } catch (err) {
      setSubmitError(err.response?.data?.detail || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!hasPermission(ROLES.LIBRARIAN)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>
        Access Denied. Only librarians can manage the collection.
      </div>
    );
  }

  if (loading && isEdit && !currentBook) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading book details...</div>;
  }

  // MD3 Styled Input Group
  const inputWrapperStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '20px',
  };

  const labelStyle = {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--md-sys-color-on-surface-variant)',
    marginLeft: '4px',
  };

  const inputStyle = {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid var(--md-sys-color-outline)',
    backgroundColor: 'var(--md-sys-color-surface)',
    fontSize: '1rem',
    color: 'var(--md-sys-color-on-surface)',
    outline: 'none',
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '400', margin: '0 0 8px 0' }}>
          {isEdit ? 'Edit Book' : 'Add New Book'}
        </h2>
        <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          {isEdit ? 'Modify the book information in the system' : 'Enter the details to register a new book to the library'}
        </p>
      </header>

      <MdCard variant="elevated">
        <form onSubmit={handleSubmit} style={{ padding: '8px' }}>

          <div style={inputWrapperStyle}>
            <label style={labelStyle} htmlFor="title">Book Title</label>
            <input
              style={inputStyle}
              id="title" name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. The Great Gatsby"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={inputWrapperStyle}>
              <label style={labelStyle} htmlFor="author">Author</label>
              <input
                style={inputStyle}
                id="author" name="author"
                value={formData.author}
                onChange={handleChange}
                required
              />
            </div>
            <div style={inputWrapperStyle}>
              <label style={labelStyle} htmlFor="isbn">ISBN</label>
              <input
                style={inputStyle}
                id="isbn" name="isbn"
                value={formData.isbn}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div style={inputWrapperStyle}>
            <label style={labelStyle} htmlFor="description">Brief Description</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical' }}
              id="description" name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div style={inputWrapperStyle}>
              <label style={labelStyle} htmlFor="total_copies">Total Copies</label>
              <input
                style={inputStyle}
                id="total_copies" name="total_copies"
                type="number" min="1"
                value={formData.total_copies}
                onChange={handleChange}
                required
              />
            </div>
            <div style={inputWrapperStyle}>
              <label style={labelStyle} htmlFor="available_copies">Available</label>
              <input
                style={inputStyle}
                id="available_copies" name="available_copies"
                type="number" min="0" max={formData.total_copies}
                value={formData.available_copies}
                onChange={handleChange}
                required
              />
            </div>
            <div style={inputWrapperStyle}>
              <label style={labelStyle} htmlFor="location">Shelf Location</label>
              <input
                style={inputStyle}
                id="location" name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="A-101"
              />
            </div>
          </div>

          {submitError && (
            <div style={{
              color: 'var(--md-sys-color-error)',
              backgroundColor: 'var(--md-sys-color-error-container)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '0.875rem'
            }}>
              {submitError}
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '24px',
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            paddingTop: '24px'
          }}>
            <button
              type="button"
              onClick={() => navigate('/books')}
              style={{
                padding: '10px 24px',
                borderRadius: '100px',
                border: '1px solid var(--md-sys-color-outline)',
                background: 'transparent',
                color: 'var(--md-sys-color-primary)',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 32px',
                borderRadius: '100px',
                border: 'none',
                backgroundColor: 'var(--md-sys-color-primary, #6750a4)',
                color: 'white',
                fontWeight: '500',
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--md-sys-elevation-level1)'
              }}
            >
              {saving ? 'Saving...' : 'Save Book'}
            </button>
          </div>
        </form>
      </MdCard>
    </div>
  );
};

export default BookForm;