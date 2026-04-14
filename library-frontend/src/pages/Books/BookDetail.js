import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooks } from '../../hooks/useBooks';
import { useBorrow } from '../../hooks/useBorrow';
import { formatDate } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard'; // Adjusted path to your component

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
      alert('Borrow request submitted. Please wait for librarian approval.');
      navigate('/borrow');
    } catch (err) {
      alert(`Borrowing failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBorrowLoading(false);
    }
  };

  const handleEdit = () => navigate(`/books/${id}/edit`);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteBook(currentBook.id);
      alert('Book deleted successfully.');
      navigate('/books');
    } catch (err) {
      alert(`Deletion failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-on-surface)' }}>Loading...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>{error}</div>;
  if (!currentBook) return <div style={{ padding: '40px', textAlign: 'center' }}>Book not found.</div>;

  // Internal MD3 Styled Components
  const labelStyle = {
    fontSize: '0.875rem',
    color: 'var(--md-sys-color-on-surface-variant, #49454f)',
    marginBottom: '4px'
  };

  const valueStyle = {
    fontSize: '1rem',
    color: 'var(--md-sys-color-on-surface, #1d1b20)',
    fontWeight: '500'
  };

  const sectionTitleStyle = {
    fontSize: '1.25rem',
    fontWeight: '400',
    color: 'var(--md-sys-color-primary, #6750a4)',
    marginBottom: '16px',
    marginTop: '8px'
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '400', margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
            {currentBook.title}
          </h1>
          <p style={{ color: 'var(--md-sys-color-secondary)', fontSize: '1.1rem' }}>by {currentBook.author}</p>
        </div>
        <button
          onClick={() => navigate('/books')}
          style={{
            padding: '10px 24px',
            borderRadius: '20px',
            border: '1px solid var(--md-sys-color-outline)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          Back to Collection
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

        {/* Left Column: Basic Info */}
        <MdCard variant="elevated">
          <h3 style={sectionTitleStyle}>General Information</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            <InfoField label="ISBN" value={currentBook.isbn} />
            <InfoField label="Publisher" value={currentBook.publisher || 'Not Set'} />
            <InfoField label="Publication Date" value={currentBook.publish_date ? formatDate(currentBook.publish_date) : 'Not Set'} />
            <InfoField label="Category" value={currentBook.category || 'Uncategorized'} />
          </div>
        </MdCard>

        {/* Right Column: Inventory & Status */}
        <MdCard variant="outlined">
          <h3 style={sectionTitleStyle}>Availability</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <InfoField label="Stock Status" value={
                currentBook.available_copies > 0
                  ? <span style={{ color: '#2e7d32' }}>In Stock</span>
                  : <span style={{ color: '#d32f2f' }}>Out of Stock</span>
              } />
              <InfoField label="Location" value={currentBook.location || 'Main Shelf'} />
            </div>
            <hr style={{ border: '0', borderTop: '1px solid var(--md-sys-color-outline-variant)', opacity: 0.3 }} />
            <div style={{ display: 'flex', gap: '32px' }}>
              <InfoField label="Total" value={currentBook.total_copies} />
              <InfoField label="Available" value={currentBook.available_copies} />
              <InfoField label="On Loan" value={currentBook.total_copies - currentBook.available_copies} />
            </div>
          </div>
        </MdCard>

        {/* Description - Full Width */}
        {currentBook.description && (
          <div style={{ gridColumn: '1 / -1' }}>
            <MdCard variant="filled">
              <h3 style={sectionTitleStyle}>Description</h3>
              <p style={{ lineHeight: '1.6', margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>
                {currentBook.description}
              </p>
            </MdCard>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div style={{
        marginTop: '32px',
        padding: '24px',
        display: 'flex',
        gap: '12px',
        borderTop: '1px solid var(--md-sys-color-outline-variant)'
      }}>
        {currentBook.available_copies > 0 && (
          <button
            onClick={handleBorrow}
            disabled={borrowLoading}
            style={{
              backgroundColor: 'var(--md-sys-color-primary, #6750a4)',
              color: 'white',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '100px',
              fontWeight: '500',
              cursor: borrowLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {borrowLoading ? 'Processing...' : 'Borrow this book'}
          </button>
        )}

        {hasPermission(ROLES.LIBRARIAN) && (
          <>
            <button
              onClick={handleEdit}
              style={{
                backgroundColor: 'var(--md-sys-color-secondary-container, #e8def8)',
                color: 'var(--md-sys-color-on-secondary-container, #1d192b)',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '100px',
                cursor: 'pointer'
              }}
            >
              Edit Details
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--md-sys-color-error, #b3261e)',
                border: '1px solid var(--md-sys-color-error)',
                padding: '12px 24px',
                borderRadius: '100px',
                cursor: 'pointer'
              }}
            >
              {deleteLoading ? 'Deleting...' : 'Delete Book'}
            </button>
          </>
        )}
      </div>

      {/* System Metadata */}
      <p style={{ fontSize: '0.75rem', color: '#777', textAlign: 'center', marginTop: '24px' }}>
        Record created: {formatDate(currentBook.created_at)} |
        Last updated: {currentBook.updated_at ? formatDate(currentBook.updated_at) : 'Never'}
      </p>
    </div>
  );
};

// Small helper component for consistent layout
const InfoField = ({ label, value }) => (
  <div>
    <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    <div style={{ fontSize: '1rem', fontWeight: '500' }}>{value}</div>
  </div>
);

export default BookDetail;