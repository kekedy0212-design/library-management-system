import React from 'react';

/**
 * Compact rating label for book cards and headers.
 */
const RatingBadge = ({ average, count, size = 'default' }) => {
  const isSmall = size === 'small';
  const hasRatings = count > 0 && average != null;

  if (!hasRatings) {
    return (
      <span style={badgeStyle(isSmall, 'var(--md-sys-color-surface-container-high)', 'var(--md-sys-color-on-surface-variant)')}>
        No ratings yet
      </span>
    );
  }

  const rounded = Math.round(average);
  const stars = '★'.repeat(rounded) + '☆'.repeat(5 - rounded);

  return (
    <span
      style={badgeStyle(
        isSmall,
        'var(--md-sys-color-primary-container)',
        'var(--md-sys-color-on-primary-container)',
      )}
      title={`${average.toFixed(1)} average from ${count} reader${count !== 1 ? 's' : ''}`}
    >
      <span style={{ letterSpacing: '-1px', marginRight: '4px' }} aria-hidden="true">
        {stars}
      </span>
      {average.toFixed(1)}
      <span style={{ opacity: 0.85, marginLeft: '4px', fontWeight: '400' }}>({count})</span>
    </span>
  );
};

const badgeStyle = (small, bg, color) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: small ? '3px 8px' : '4px 10px',
  borderRadius: '8px',
  fontSize: small ? '0.7rem' : '0.75rem',
  fontWeight: '600',
  backgroundColor: bg,
  color,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
});

export default RatingBadge;
