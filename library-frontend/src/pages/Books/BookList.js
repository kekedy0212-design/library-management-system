import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooks } from '../../hooks/useBooks';
import { useBorrow } from '../../hooks/useBorrow';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard';
import RatingBadge from '../../components/RatingBadge';
import RecommendedBooks from '../../components/RecommendedBooks';
import BorrowScannerDialog from '../../components/BorrowScannerDialog';
import Toast from '../../components/Toast';

const BookList = () => {
  const navigate = useNavigate();

  const {
    books,
    loading,
    error,
    fetchBooks,
    deleteBook,
  } = useBooks();

  const { borrowBook } = useBorrow();

  const [searchQuery, setSearchQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [toast, setToast] = useState({ visible: false, type: 'info', text: '' });

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleSearch = async (e) => {
    e.preventDefault();

    try {
      await fetchBooks(searchQuery);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (e, bookId) => {
    e.stopPropagation();

    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this book?'
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteBook(bookId);

      alert('Book deleted successfully');
    } catch (err) {
      alert(
        `Delete failed: ${err.response?.data?.detail ||
        err.message ||
        'Unknown error'
        }`
      );
    }
  };

  const handleQuickBorrow = async (e, bookId) => {
    e.stopPropagation();

    try {
      await borrowBook({ book_id: bookId });
      setToast({
        visible: true,
        type: 'success',
        text: 'Borrow request submitted. Please wait for librarian approval.',
      });
    } catch (err) {
      setToast({
        visible: true,
        type: 'error',
        text:
          err.response?.data?.detail ||
          err.message ||
          'Borrow failed',
      });
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--md-sys-color-on-surface-variant)',
        }}
      >
        Loading library collection...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--md-sys-color-error)',
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px',
        }}
      >
        {/* Header */}
        <header
          style={{
            marginBottom: '32px',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: '400',
              marginBottom: '24px',
              color: 'var(--md-sys-color-on-surface)',
            }}
          >
            Library Collection
          </h1>

          {/* Search + Scan */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              maxWidth: '860px',
              margin: '0 auto',
            }}
          >
            <form
              onSubmit={handleSearch}
              style={{
                flex: 1,
                position: 'relative',
              }}
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                placeholder="Search by title, author, or ISBN..."
                style={{
                  width: '100%',
                  height: '56px',
                  padding: '0 24px',
                  paddingRight: '110px',
                  borderRadius: '28px',
                  border:
                    '1px solid var(--md-sys-color-outline)',
                  backgroundColor:
                    'var(--md-sys-color-surface-container-high)',
                  color:
                    'var(--md-sys-color-on-surface)',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                }}
              />

              <button
                type="submit"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor:
                    'var(--md-sys-color-primary)',
                  color:
                    'var(--md-sys-color-on-primary)',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                }}
              >
                Search
              </button>
            </form>

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              style={{
                height: '56px',
                padding: '0 24px',
                borderRadius: '20px',
                border: 'none',
                background:
                  'var(--md-sys-color-secondary-container)',
                color:
                  'var(--md-sys-color-on-secondary-container)',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.95rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              <md-icon >
                qr_code_scanner
              </md-icon>
            </button>
          </div>
        </header>

        {/* Librarian Actions */}
        {hasPermission(ROLES.LIBRARIAN) && (
          <div
            style={{
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={() => navigate('/books/new')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '18px',
                border: 'none',
                background:
                  'var(--md-sys-color-primary-container)',
                color:
                  'var(--md-sys-color-on-primary-container)',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span
                style={{
                  fontSize: '1.1rem',
                  lineHeight: 1,
                }}
              >
                +
              </span>
              Add New Book
            </button>
          </div>
        )}

        <MdCard variant="filled" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: '500' }}>
            Recommended For You
          </h3>
          <RecommendedBooks limit={6} compact />
        </MdCard>

        {/* Result Count */}
        <div
          style={{
            marginBottom: '16px',
            color:
              'var(--md-sys-color-on-surface-variant)',
            fontSize: '0.95rem',
          }}
        >
          {books.length}{' '}
          {books.length === 1 ? 'book' : 'books'} found
        </div>

        {/* Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {books.map((book) => (
            <MdCard
              key={book.id}
              variant="outlined"
              className="book-card"
            >
              <div
                onClick={() =>
                  navigate(`/books/${book.id}`)
                }
                style={{
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Main Content */}
                <div style={{ marginBottom: 'auto' }}>
                  <h3
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '1.25rem',
                      fontWeight: '500',
                      color:
                        'var(--md-sys-color-on-surface)',
                    }}
                  >
                    {book.title}
                  </h3>

                  <p
                    style={{
                      margin: '0 0 12px 0',
                      color:
                        'var(--md-sys-color-secondary)',
                    }}
                  >
                    {book.author}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    <Badge label={book.isbn} />

                    <Badge
                      label={
                        book.available_copies > 0
                          ? 'Available'
                          : 'Out of Stock'
                      }
                      color={
                        book.available_copies > 0
                          ? 'var(--md-sys-color-on-tertiary-container)'
                          : 'var(--md-sys-color-on-error-container)'
                      }
                      light={
                        book.available_copies > 0
                          ? 'var(--md-sys-color-tertiary-container)'
                          : 'var(--md-sys-color-error-container)'
                      }
                    />

                    <Badge
                      label={`${book.available_copies || 0} copies`}
                    />

                    <RatingBadge
                      average={book.average_rating}
                      count={book.rating_count ?? 0}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    borderTop:
                      '1px solid var(--md-sys-color-outline-variant)',
                    paddingTop: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.875rem',
                      color:
                        'var(--md-sys-color-on-surface-variant)',
                    }}
                  >
                    {book.location || 'No Location'}
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {/* {book.available_copies > 0 && (
                      <IconButton
                        onClick={(e) =>
                          handleQuickBorrow(
                            e,
                            book.id
                          )
                        }
                      >
                        Borrow
                      </IconButton>
                    )} */}

                    {hasPermission(
                      ROLES.LIBRARIAN
                    ) && (
                        <>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();

                              navigate(
                                `/books/${book.id}/edit`
                              );
                            }}
                          >
                            Edit
                          </IconButton>

                          <IconButton
                            color="var(--md-sys-color-error)"
                            onClick={(e) =>
                              handleDelete(
                                e,
                                book.id
                              )
                            }
                          >
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

        {/* Empty State */}
        {books.length === 0 && !loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 24px',
              color:
                'var(--md-sys-color-on-surface-variant)',
            }}
          >
            <p
              style={{
                fontSize: '1.15rem',
                marginBottom: '8px',
              }}
            >
              {searchQuery
                ? `No results found for "${searchQuery}"`
                : 'The library collection is currently empty.'}
            </p>

            <p
              style={{
                fontSize: '0.95rem',
                opacity: 0.8,
              }}
            >
              Try adjusting your search keywords.
            </p>
          </div>
        )}
      </div>

      {/* Scanner Dialog */}
      <BorrowScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />

      <Toast
        visible={toast.visible}
        type={toast.type}
        text={toast.text}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </>
  );
};

/* ---------- UI Components ---------- */

const Badge = ({
  label,
  color = 'var(--md-sys-color-on-surface-variant)',
  light = 'var(--md-sys-color-surface-container-high)',
}) => (
  <span
    style={{
      padding: '4px 10px',
      borderRadius: '8px',
      fontSize: '0.75rem',
      fontWeight: '500',
      backgroundColor: light,
      color: color,
      lineHeight: 1.4,
    }}
  >
    {label}
  </span>
);

const IconButton = ({
  children,
  onClick,
  color = 'var(--md-sys-color-primary)',
}) => (
  <button
    onClick={onClick}
    style={{
      background: 'transparent',
      border: 'none',
      color: color,
      padding: '8px 10px',
      borderRadius: '10px',
      fontSize: '0.8rem',
      fontWeight: '600',
      cursor: 'pointer',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      transition: 'all 0.15s ease',
    }}
  >
    {children}
  </button>
);

export default BookList;