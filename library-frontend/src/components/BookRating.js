import React, { useCallback, useEffect, useState } from 'react';
import { bookService } from '../services/bookService';
import { isAuthenticated } from '../utils/auth';

const STAR_VALUES = [1, 2, 3, 4, 5];

const BookRating = ({ bookId, onRated }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hoverScore, setHoverScore] = useState(null);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await bookService.getBookRating(bookId);
      setSummary(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleRate = async (score) => {
    if (!isAuthenticated()) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await bookService.rateBook(bookId, score);
      setSummary(response.data);
      onRated?.(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
        Loading ratings...
      </p>
    );
  }

  const displayScore = hoverScore ?? summary?.user_rating ?? 0;
  const average = summary?.average_rating;
  const count = summary?.rating_count ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <StarRow
          value={average ? Math.round(average) : 0}
          readonly
          filledColor="var(--md-sys-color-primary)"
        />
        <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>
          {average != null ? average.toFixed(1) : '—'}
        </span>
        <span style={{ fontSize: '0.875rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
          ({count} {count === 1 ? 'rating' : 'ratings'})
        </span>
      </div>

      <div style={{ marginTop: '16px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '8px' }}>
          {isAuthenticated() ? 'Your rating' : 'Sign in to rate this book'}
        </div>
        {isAuthenticated() && (
          <StarRow
            value={displayScore}
            readonly={false}
            disabled={submitting}
            onHover={setHoverScore}
            onLeave={() => setHoverScore(null)}
            onSelect={handleRate}
          />
        )}
        {summary?.user_rating != null && isAuthenticated() && !hoverScore && (
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            You rated {summary.user_rating} star{summary.user_rating !== 1 ? 's' : ''}. Click to change.
          </p>
        )}
      </div>

      {error && (
        <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--md-sys-color-error)' }}>{error}</p>
      )}
    </div>
  );
};

const StarRow = ({
  value,
  readonly = false,
  disabled = false,
  filledColor = 'var(--md-sys-color-primary)',
  onHover,
  onLeave,
  onSelect,
}) => (
  <div
    style={{ display: 'inline-flex', gap: '2px' }}
    onMouseLeave={readonly ? undefined : onLeave}
    role={readonly ? 'img' : 'radiogroup'}
    aria-label={readonly ? `Average ${value} of 5 stars` : 'Rate this book'}
  >
    {STAR_VALUES.map((star) => {
      const filled = star <= value;
      return (
        <button
          key={star}
          type="button"
          disabled={readonly || disabled}
          onClick={readonly ? undefined : () => onSelect?.(star)}
          onMouseEnter={readonly ? undefined : () => onHover?.(star)}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '2px',
            cursor: readonly || disabled ? 'default' : 'pointer',
            fontSize: '1.75rem',
            lineHeight: 1,
            color: filled ? filledColor : 'var(--md-sys-color-outline-variant)',
            opacity: disabled ? 0.6 : 1,
          }}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          ★
        </button>
      );
    })}
  </div>
);

export default BookRating;
