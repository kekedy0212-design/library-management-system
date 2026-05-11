import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBooks } from '../../hooks/useBooks';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard';

const BookForm = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);

  const navigate = useNavigate();

  const {
    currentBook,
    loading,
    fetchBookById,
    createBook,
    updateBook,
  } = useBooks();

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

  // Metadata fetching states
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState(null);

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

  // Fetch metadata from Open Library API
  const fetchBookMetadata = async () => {
    const isbn = formData.isbn?.trim();

    if (!isbn) {
      setMetadataError('Please enter an ISBN first');
      return;
    }

    setFetchingMetadata(true);
    setMetadataError(null);

    try {
      // Normalize ISBN
      const normalizedIsbn = isbn.replace(/[-\s]/g, '');

      // Basic validation
      if (
        normalizedIsbn.length !== 10 &&
        normalizedIsbn.length !== 13
      ) {
        throw new Error('ISBN must be 10 or 13 digits');
      }

      const response = await fetch(
        `https://openlibrary.org/isbn/${normalizedIsbn}.json`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No book found for this ISBN');
        }

        throw new Error('Failed to fetch book metadata');
      }

      const data = await response.json();

      // Fetch author information
      let authorName = '';

      if (data.authors?.length > 0) {
        try {
          const authorKey = data.authors[0].key;

          const authorResponse = await fetch(
            `https://openlibrary.org${authorKey}.json`
          );

          if (authorResponse.ok) {
            const authorData = await authorResponse.json();
            authorName = authorData.name || '';
          }
        } catch (authorErr) {
          console.error('Failed to fetch author info:', authorErr);
        }
      }

      // Handle description
      let description = '';

      if (typeof data.description === 'string') {
        description = data.description;
      } else if (data.description?.value) {
        description = data.description.value;
      }

      // Only fill empty fields to avoid overwriting user input
      setFormData((prev) => ({
        ...prev,
        title: prev.title || data.title || '',
        author: prev.author || authorName || '',
        description: prev.description || description || '',
      }));
    } catch (err) {
      setMetadataError(
        err.message || 'Unable to fetch metadata'
      );
    } finally {
      setFetchingMetadata(false);
    }
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
      setSubmitError(
        err.response?.data?.detail ||
        err.message ||
        'Save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!hasPermission(ROLES.LIBRARIAN)) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--md-sys-color-error)',
        }}
      >
        Access Denied. Only librarians can manage the collection.
      </div>
    );
  }

  if (loading && isEdit && !currentBook) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
        }}
      >
        Loading book details...
      </div>
    );
  }

  // MD3 styles
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
    borderRadius: '12px',
    border: '1px solid var(--md-sys-color-outline)',
    backgroundColor: 'var(--md-sys-color-surface)',
    fontSize: '1rem',
    color: 'var(--md-sys-color-on-surface)',
    outline: 'none',
    transition:
      'border-color 0.2s ease, box-shadow 0.2s ease',
  };

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '24px',
      }}
    >
      <header style={{ marginBottom: '32px' }}>
        <h2
          style={{
            fontSize: '2rem',
            fontWeight: '400',
            margin: '0 0 8px 0',
          }}
        >
          {isEdit ? 'Edit Book' : 'Add New Book'}
        </h2>

        <p
          style={{
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          {isEdit
            ? 'Modify the book information in the system'
            : 'Enter the details to register a new book to the library'}
        </p>
      </header>

      <MdCard variant="elevated">
        <form
          onSubmit={handleSubmit}
          style={{ padding: '8px' }}
        >
          {/* Title */}
          <div style={inputWrapperStyle}>
            <label style={labelStyle} htmlFor="title">
              Book Title
            </label>

            <input
              style={inputStyle}
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. The Great Gatsby"
              required
            />
          </div>

          {/* Author + ISBN */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            {/* Author */}
            <div style={inputWrapperStyle}>
              <label style={labelStyle} htmlFor="author">
                Author
              </label>

              <input
                style={inputStyle}
                id="author"
                name="author"
                value={formData.author}
                onChange={handleChange}
                required
              />
            </div>

            {/* ISBN + Autofill */}
            <div style={inputWrapperStyle}>
              <label style={labelStyle} htmlFor="isbn">
                ISBN
              </label>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <input
                  style={{
                    ...inputStyle,
                    flex: 1,
                  }}
                  id="isbn"
                  name="isbn"
                  value={formData.isbn}
                  onChange={(e) => {
                    handleChange(e);

                    if (metadataError) {
                      setMetadataError(null);
                    }
                  }}
                  required
                />

                <button
                  type="button"
                  onClick={fetchBookMetadata}
                  disabled={
                    fetchingMetadata ||
                    !formData.isbn.trim()
                  }
                  style={{
                    height: '48px',
                    padding: '0 20px',
                    borderRadius: '999px',
                    border: 'none',
                    backgroundColor: fetchingMetadata
                      ? 'var(--md-sys-color-surface-variant)'
                      : 'var(--md-sys-color-secondary-container)',
                    color:
                      'var(--md-sys-color-on-secondary-container)',
                    fontWeight: '500',
                    fontSize: '0.95rem',
                    cursor:
                      fetchingMetadata ||
                        !formData.isbn.trim()
                        ? 'not-allowed'
                        : 'pointer',
                    transition:
                      'background-color 0.2s ease, transform 0.15s ease',
                    whiteSpace: 'nowrap',
                    boxShadow:
                      'var(--md-sys-elevation-level1)',
                  }}
                >
                  {fetchingMetadata
                    ? 'Fetching...'
                    : 'Auto Fill'}
                </button>
              </div>

              {metadataError && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor:
                      'var(--md-sys-color-error-container)',
                    color:
                      'var(--md-sys-color-on-error-container)',
                    fontSize: '0.875rem',
                    lineHeight: '1.4',
                  }}
                >
                  {metadataError}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div style={inputWrapperStyle}>
            <label style={labelStyle} htmlFor="description">
              Brief Description
            </label>

            <textarea
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: '120px',
              }}
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
          </div>

          {/* Copies + Location */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            {/* Total Copies */}
            <div style={inputWrapperStyle}>
              <label
                style={labelStyle}
                htmlFor="total_copies"
              >
                Total Copies
              </label>

              <input
                style={inputStyle}
                id="total_copies"
                name="total_copies"
                type="number"
                min="1"
                value={formData.total_copies}
                onChange={handleChange}
                required
              />
            </div>

            {/* Location */}
            <div style={inputWrapperStyle}>
              <label style={labelStyle} htmlFor="location">
                Shelf Location
              </label>

              <input
                style={inputStyle}
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="A-101"
              />
            </div>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div
              style={{
                color:
                  'var(--md-sys-color-on-error-container)',
                backgroundColor:
                  'var(--md-sys-color-error-container)',
                padding: '12px',
                borderRadius: '12px',
                marginBottom: '20px',
                fontSize: '0.875rem',
                lineHeight: '1.4',
              }}
            >
              {submitError}
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
              justifyContent: 'flex-end',
              borderTop:
                '1px solid var(--md-sys-color-outline-variant)',
              paddingTop: '24px',
            }}
          >
            {/* Cancel */}
            <button
              type="button"
              onClick={() => navigate('/books')}
              style={{
                padding: '10px 24px',
                borderRadius: '999px',
                border:
                  '1px solid var(--md-sys-color-outline)',
                background: 'transparent',
                color: 'var(--md-sys-color-primary)',
                fontWeight: '500',
                cursor: 'pointer',
                transition:
                  'background-color 0.2s ease',
              }}
            >
              Cancel
            </button>

            {/* Save */}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 32px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor:
                  'var(--md-sys-color-primary, #6750a4)',
                color: 'white',
                fontWeight: '500',
                cursor: saving
                  ? 'not-allowed'
                  : 'pointer',
                boxShadow:
                  'var(--md-sys-elevation-level1)',
                transition:
                  'background-color 0.2s ease',
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