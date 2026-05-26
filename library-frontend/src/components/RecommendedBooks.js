import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookService } from '../services/bookService';
import MdCard from './MdCard';
import RatingBadge from './RatingBadge';

const RecommendedBooks = ({ limit = 8, compact = false }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [strategy, setStrategy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await bookService.getRecommendations(limit);
      setItems(response.data.items || []);
      setStrategy(response.data.strategy || '');
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <p style={{ margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>
        Loading top-rated books...
      </p>
    );
  }

  if (error) {
    return (
      <p style={{ margin: 0, color: 'var(--md-sys-color-error)' }}>{error}</p>
    );
  }

  if (items.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>
        No books have an average rating of 4.0 or higher yet.
      </p>
    );
  }

  const subtitle =
    strategy === 'rated_4_plus'
      ? 'Recommended books with 4+ average ratings.'
      : 'Recommended books.';

  // Dashboard（compact=false）：简洁列表，只显示书名 + 评分
  if (!compact) {
    return (
      <div>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: '0.9rem',
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          {subtitle}
        </p>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {items.map(({ book }) => (
            <li key={book.id}>
              <button
                type="button"
                onClick={() => navigate(`/books/${book.id}`)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    color: 'var(--md-sys-color-on-surface)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={book.title}
                >
                  {book.title}
                </span>
                <RatingBadge
                  average={book.average_rating}
                  count={book.rating_count ?? 0}
                  size="small"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // 书目页（compact=true）：保留原来的卡片形式，信息更丰富
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '14px',
      }}
    >
      {items.map(({ book, match_score, reason }) => (
        <MdCard
          key={book.id}
          variant="outlined"
          style={{
            padding: '16px',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s ease',
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/books/${book.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate(`/books/${book.id}`);
              }
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <h4
                style={{
                  margin: '0 0 4px',
                  fontSize: '1.05rem',
                  fontWeight: '500',
                  flex: 1,
                }}
              >
                {book.title}
              </h4>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  background: 'var(--md-sys-color-tertiary-container)',
                  color: 'var(--md-sys-color-on-tertiary-container)',
                  whiteSpace: 'nowrap',
                }}
                title="Recommendation strength"
              >
                {match_score.toFixed(1)}
              </span>
            </div>
            <p
              style={{
                margin: '0 0 10px',
                fontSize: '0.875rem',
                color: 'var(--md-sys-color-secondary)',
              }}
            >
              {book.author}
            </p>
            <div style={{ marginBottom: '10px' }}>
              <RatingBadge
                average={book.average_rating}
                count={book.rating_count ?? 0}
                size="small"
              />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '0.8rem',
                color: 'var(--md-sys-color-on-surface-variant)',
                lineHeight: 1.4,
              }}
            >
              {reason}
            </p>
            {book.available_copies > 0 && (
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: '0.75rem',
                  color: 'var(--md-sys-color-primary)',
                  fontWeight: '500',
                }}
              >
                {book.available_copies} copy
                {book.available_copies !== 1 ? 'ies' : ''} available
              </p>
            )}
          </div>
        </MdCard>
      ))}
    </div>
  );
};

export default RecommendedBooks;
