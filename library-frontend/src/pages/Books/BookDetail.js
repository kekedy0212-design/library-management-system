import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooks } from '../../hooks/useBooks';
import { useBorrow } from '../../hooks/useBorrow';
import { formatDate } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import MdCard from '../../components/MdCard';

const BookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentBook, loading, error, fetchBookById, deleteBook } = useBooks();
  const { borrowBook } = useBorrow();
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (id) fetchBookById(parseInt(id));
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
    if (!window.confirm('Are you sure you want to delete this book?')) return;
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

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>{error}</div>;
  if (!currentBook) return <div style={{ padding: '40px', textAlign: 'center' }}>Book not found.</div>;

  const sectionTitleStyle = {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--md-sys-color-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05rem',
    marginBottom: '16px',
    marginTop: '0'
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '400', margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
            {currentBook.title}
          </h1>
          <p style={{ color: 'var(--md-sys-color-secondary)', fontSize: '1.2rem', margin: '4px 0 0 0' }}>
            {currentBook.author}
          </p>
        </div>
        <button
          onClick={() => navigate('/books')}
          style={{
            padding: '8px 20px',
            borderRadius: '20px',
            border: '1px solid var(--md-sys-color-outline)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          Back to List
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '350px 1fr', // 左侧固定宽度，右侧自适应
        gap: '32px',
        alignItems: 'start'
      }}>

        {/* Left Column: Status & Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Availability Card */}
          <MdCard variant="outlined" style={{ padding: '24px' }}>
            <h3 style={sectionTitleStyle}>Availability</h3>
            <div style={{ display: 'grid', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--md-sys-color-outline)' }}>Status</span>
                <StatusBadge count={currentBook.available_copies} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--md-sys-color-outline)' }}>Location</span>
                <span style={{ fontWeight: '500' }}>{currentBook.location || 'Main Shelf'}</span>
              </div>

              <hr style={{ border: '0', borderTop: '1px solid var(--md-sys-color-outline-variant)', margin: '8px 0', opacity: 0.5 }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', gap: '8px' }}>
                <InfoField label="Total" value={currentBook.total_copies} />
                <InfoField label="Available" value={currentBook.available_copies} />
                <InfoField label="On Loan" value={currentBook.total_copies - currentBook.available_copies} />
              </div>
            </div>
          </MdCard>

          {/* Identifiers Card */}
          <MdCard variant="outlined" style={{ padding: '24px', backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
            <h3 style={sectionTitleStyle}>Identifiers</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--md-sys-color-outline)' }}>ISBN</span>
              <span style={{
                fontFamily: 'monospace',
                fontWeight: '600',
                fontSize: '1rem',
                letterSpacing: '0.5px'
              }}>
                {currentBook.isbn}
              </span>
            </div>
          </MdCard>
        </div>

        {/* Right Column: Description & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <MdCard variant="filled" style={{ padding: '32px', minHeight: '300px' }}>
            <h3 style={sectionTitleStyle}>Description</h3>
            <p style={{
              lineHeight: '1.8',
              fontSize: '1.05rem',
              margin: 0,
              color: 'var(--md-sys-color-on-surface-variant)',
              whiteSpace: 'pre-line', minHeight: '200px'
            }}>
              {currentBook.description || "No description provided for this book."}
            </p>
          </MdCard>

          {/* Action Footer - 右对齐处理 */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end', // 关键修改：按钮右对齐
            alignItems: 'center',
            gap: '12px',
            marginTop: '8px'
          }}>
            {hasPermission(ROLES.LIBRARIAN) && (
              <>
                <button onClick={handleDelete} disabled={deleteLoading} style={dangerBtnStyle}>
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
                <button onClick={handleEdit} style={secondaryBtnStyle}>Edit Details</button>
              </>
            )}

            {currentBook.available_copies > 0 && (
              <button
                onClick={handleBorrow}
                disabled={borrowLoading}
                style={primaryBtnStyle}
              >
                {borrowLoading ? 'Processing...' : 'Request to Borrow'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metadata Footer */}
      <footer style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid var(--md-sys-color-outline-variant)', display: 'flex', justifyContent: 'center', gap: '24px' }}>
        <span style={footerTextStyle}>Created: {formatDate(currentBook.created_at)}</span>
        <span style={footerTextStyle}>Updated: {currentBook.updated_at ? formatDate(currentBook.updated_at) : 'N/A'}</span>
      </footer>
    </div>
  );
};

// --- Helper Components ---

const InfoField = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <div style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-outline)', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{value}</div>
  </div>
);

const StatusBadge = ({ count }) => {
  const inStock = count > 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        backgroundColor: inStock ? '#4caf50' : '#f44336'
      }} />
      <span style={{
        color: inStock ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)',
        fontSize: '0.9rem',
        fontWeight: '600'
      }}>
        {inStock ? 'In Stock' : 'Out of Stock'}
      </span>
    </div>
  );
};

// --- Styles ---

const footerTextStyle = {
  fontSize: '0.75rem',
  color: 'var(--md-sys-color-outline)',
  fontStyle: 'italic'
};

const primaryBtnStyle = {
  backgroundColor: 'var(--md-sys-color-primary)',
  color: 'white',
  border: 'none',
  padding: '12px 32px',
  borderRadius: '100px',
  fontWeight: '600',
  cursor: 'pointer',
  boxShadow: 'var(--md-sys-elevation-level1)'
};

const secondaryBtnStyle = {
  backgroundColor: 'var(--md-sys-color-secondary-container)',
  color: 'var(--md-sys-color-on-secondary-container)',
  border: 'none',
  padding: '12px 24px',
  borderRadius: '100px',
  fontWeight: '500',
  cursor: 'pointer'
};

const dangerBtnStyle = {
  backgroundColor: 'transparent',
  color: 'var(--md-sys-color-error)',
  border: '1px solid var(--md-sys-color-error)',
  padding: '12px 24px',
  borderRadius: '100px',
  fontWeight: '500',
  cursor: 'pointer'
};

export default BookDetail;