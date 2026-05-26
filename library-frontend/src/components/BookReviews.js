import React, { useCallback, useEffect, useState } from 'react';
import { bookService } from '../services/bookService';
import { formatDateTime } from '../utils/helpers';
import { isAuthenticated, isLibrarian } from '../utils/auth';

const formatApiError = (err) => {
  const detail = err?.response?.data?.detail;
  if (!detail) return err.message || 'Request failed';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join('; ');
  }
  return JSON.stringify(detail);
};

const BookReviews = ({ bookId }) => {
  const [reviews, setReviews] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadReviews = useCallback(
    async ({ showFullLoading = false } = {}) => {
      if (!bookId) return;
      if (showFullLoading) setLoading(true);
      try {
        const response = await bookService.getBookReviews(bookId);
        const list = response.data || [];
        setReviews(list);
        const mine = list.find((r) => r.is_own);
        if (mine) {
          setContent(mine.content);
        }
      } catch (err) {
        setError(formatApiError(err));
        setReviews([]);
      } finally {
        if (showFullLoading) setLoading(false);
      }
    },
    [bookId]
  );

  useEffect(() => {
    loadReviews({ showFullLoading: true });
  }, [loadReviews]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setSuccess(null);

    if (!isAuthenticated()) {
      setError('Please sign in to post a review.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await bookService.upsertBookReview(bookId, content.trim());
      setSuccess('Review saved successfully.');
      await loadReviews({ showFullLoading: false });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const canModerateReviews = () => isLibrarian();

  const handleDelete = async (review) => {
    const canDelete = review.is_own || canModerateReviews();
    if (!canDelete) return;
    const label =
      canModerateReviews() && !review.is_own ? 'this' : 'your';
    if (!window.confirm(`Delete ${label} review by ${review.username}?`)) return;
    setSuccess(null);
    try {
      await bookService.deleteBookReview(bookId, review.id);
      if (review.is_own) {
        setContent('');
      }
      setSuccess('Review deleted.');
      await loadReviews({ showFullLoading: false });
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const myReview = reviews.find((r) => r.is_own);

  return (
    <div>
      {error && (
        <div style={bannerStyle('var(--md-sys-color-error-container)', 'var(--md-sys-color-on-error-container)')}>
          {error}
        </div>
      )}
      {success && (
        <div style={bannerStyle('var(--md-sys-color-tertiary-container)', 'var(--md-sys-color-on-tertiary-container)')}>
          {success}
        </div>
      )}

      {isAuthenticated() ? (
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <label
            htmlFor="review-content"
            style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'var(--md-sys-color-on-surface-variant)',
              marginBottom: '8px',
            }}
          >
            {myReview ? 'Edit your review' : 'Write a review'}
          </label>
          <textarea
            id="review-content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
              if (success) setSuccess(null);
            }}
            placeholder="Share your thoughts about this book..."
            rows={8}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid var(--md-sys-color-outline)',
              background: 'var(--md-sys-color-surface)',
              color: 'var(--md-sys-color-on-surface)',
              fontSize: '0.95rem',
              resize: 'vertical',
              boxSizing: 'border-box',
              minHeight: '160px',
            }}
          />
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                ...primaryBtnStyle,
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting ? 'Saving...' : myReview ? 'Update Review' : 'Post Review'}
            </button>
          </div>
        </form>
      ) : (
        <p
          style={{
            margin: '0 0 16px',
            fontSize: '0.9rem',
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          Sign in to write a review.
        </p>
      )}

      {loading ? (
        <p style={{ margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>
          Loading reviews...
        </p>
      ) : reviews.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>
          No reviews yet. Be the first to share your thoughts.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '480px',
            overflowY: 'auto',
          }}
        >
          {reviews.map((review) => (
            <li
              key={review.id}
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--md-sys-color-surface-container-low)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: '8px',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{review.username}</span>
                  {review.is_own && (
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        background: 'var(--md-sys-color-primary-container)',
                        color: 'var(--md-sys-color-on-primary-container)',
                      }}
                    >
                      You
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      marginTop: '2px',
                    }}
                  >
                    {formatDateTime(review.updated_at || review.created_at)}
                  </div>
                </div>
                {(review.is_own || canModerateReviews()) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(review)}
                    style={dangerBtnStyle}
                    title={
                      canModerateReviews() && !review.is_own
                        ? 'Remove inappropriate review (staff)'
                        : 'Delete your review'
                    }
                  >
                    Delete
                  </button>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--md-sys-color-on-surface)',
                }}
              >
                {review.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const bannerStyle = (bg, color) => ({
  margin: '0 0 12px',
  padding: '10px 14px',
  borderRadius: '10px',
  fontSize: '0.875rem',
  backgroundColor: bg,
  color,
});

const primaryBtnStyle = {
  padding: '8px 20px',
  borderRadius: '100px',
  border: 'none',
  background: 'var(--md-sys-color-primary)',
  color: 'var(--md-sys-color-on-primary)',
  fontWeight: 500,
};

const dangerBtnStyle = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--md-sys-color-error-container)',
  color: 'var(--md-sys-color-on-error-container)',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
};

export default BookReviews;
