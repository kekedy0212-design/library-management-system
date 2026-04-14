import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooks } from '../../hooks/useBooks';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard';

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

  const handleDelete = async (e, bookId) => {
    e.stopPropagation(); // Prevent navigating to detail
    if (!window.confirm('Are you sure you want to delete this book? This action is permanent.')) {
      return;
    }
    try {
      await deleteBook(bookId);
      alert('Book deleted successfully');
    } catch (err) {
      alert(`Delete failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Searching collection...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* Search Header Section */}
      <header style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '400', marginBottom: '24px' }}>Library Collection</h1>

        <form onSubmit={handleSearch} style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, author, or ISBN..."
            style={{
              width: '100%',
              padding: '16px 24px',
              paddingRight: '100px',
              borderRadius: '28px',
              border: '1px solid var(--md-sys-color-outline)',
              backgroundColor: 'var(--md-sys-color-surface-container-high, #f0f0f0)',
              fontSize: '1rem',
              outline: 'none',
              transition: 'box-shadow 0.2s'
            }}
          />
          <button
            type="submit"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '8px 20px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-primary, #6750a4)',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Search
          </button>
        </form>
      </header>

      {/* Admin Actions */}
      {hasPermission(ROLES.LIBRARIAN) && (
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => navigate('/books/new')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-primary-container, #eaddff)',
              color: 'var(--md-sys-color-on-primary-container, #21005d)',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <span>+</span> Add New Book
          </button>
        </div>
      )}

      {/* Results Count */}
      <div style={{ marginBottom: '16px', color: 'var(--md-sys-color-on-surface-variant)' }}>
        {books.length} {books.length === 1 ? 'book' : 'books'} found
      </div>

      {/* Books Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {books.map(book => (
          <MdCard
            key={book.id}
            variant="outlined"
            className="book-card"
          >
            <div
              onClick={() => navigate(`/books/${book.id}`)}
              style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ marginBottom: 'auto' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: '500' }}>{book.title}</h3>
                <p style={{ margin: '0 0 12px 0', color: 'var(--md-sys-color-secondary)' }}>{book.author}</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  <Badge label={book.isbn} />
                  <Badge
                    label={book.available_copies > 0 ? 'Available' : 'Out of Stock'}
                    color={book.available_copies > 0 ? '#2e7d32' : '#b3261e'}
                    light={book.available_copies > 0 ? '#e8f5e9' : '#f9e8e8'}
                  />
                </div>
              </div>

              <div style={{
                borderTop: '1px solid var(--md-sys-color-outline-variant)',
                paddingTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                  {book.location || 'No Location'}
                </span>

                <div style={{ display: 'flex', gap: '4px' }}>
                  {hasPermission(ROLES.LIBRARIAN) && (
                    <>
                      <IconButton onClick={(e) => { e.stopPropagation(); navigate(`/books/${book.id}/edit`); }}>
                        Edit
                      </IconButton>
                      <IconButton color="var(--md-sys-color-error)" onClick={(e) => handleDelete(e, book.id)}>
                        Delete
                      </IconButton>
                    </>
                  )}
                </div>
              </div>
            </div>
          </MdCard>
        ))}
      </div>

      {books.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--md-sys-color-on-surface-variant)' }}>
          <p style={{ fontSize: '1.2rem' }}>
            {searchQuery ? `No results found for "${searchQuery}"` : "The library collection is currently empty."}
          </p>
        </div>
      )}
    </div>
  );
};

// UI Components
const Badge = ({ label, color = '#444', light = '#f0f0f0' }) => (
  <span style={{
    padding: '2px 10px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '500',
    backgroundColor: light,
    color: color,
  }}>
    {label}
  </span>
);

const IconButton = ({ children, onClick, color = 'var(--md-sys-color-primary)' }) => (
  <button
    onClick={onClick}
    style={{
      background: 'transparent',
      border: 'none',
      color: color,
      padding: '6px 10px',
      borderRadius: '8px',
      fontSize: '0.8rem',
      fontWeight: '500',
      cursor: 'pointer',
      textTransform: 'uppercase'
    }}
  >
    {children}
  </button>
);

export default BookList;