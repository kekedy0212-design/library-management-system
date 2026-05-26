import React, { useCallback, useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { isAdmin } from '../../utils/auth';
import MdCard from '../../components/MdCard';
import { formatDateTime } from '../../utils/helpers';

const formatMoney = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return '¥0.00';
  return `¥${num.toFixed(2)}`;
};

const DailyRevenue = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminService.getDailyRevenue(selectedDate);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (isAdmin()) {
      fetchRevenue();
    }
  }, [fetchRevenue]);

  if (!isAdmin()) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>
        Access Denied. Administrator credentials required.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <header
        style={{
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '400', margin: 0 }}>Daily Revenue</h2>
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            Successful deposit and fine payments (UTC calendar day).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="revenue-date"
              style={{
                fontSize: '0.75rem',
                fontWeight: '500',
                color: 'var(--md-sys-color-on-surface-variant)',
              }}
            >
              Date (UTC)
            </label>
            <input
              id="revenue-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={dateInputStyle}
            />
          </div>
          <button type="button" onClick={fetchRevenue} disabled={loading} style={refreshBtnStyle}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div style={errorBannerStyle}>
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      )}

      {data && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <SummaryCard label="Deposit income" value={formatMoney(data.deposit_total)} sub={`${data.deposit_count} payment(s)`} />
            <SummaryCard label="Fine income" value={formatMoney(data.fine_total)} sub={`${data.fine_count} payment(s)`} />
            <SummaryCard
              label="Total income"
              value={formatMoney(data.total)}
              sub={`${data.deposit_count + data.fine_count} payment(s)`}
              highlight
            />
          </div>

          <MdCard style={{ padding: '0' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500' }}>Transactions</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                {data.date} — refunds are not included
              </p>
            </div>

            {data.transactions?.length === 0 ? (
              <p style={{ padding: '24px', margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>
                No successful payments on this day.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Order No.</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Paid at (UTC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((tx) => (
                      <tr key={`${tx.type}-${tx.out_trade_no}`}>
                        <td style={tdStyle}>
                          <TypeBadge type={tx.type} />
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.85rem' }}>{tx.out_trade_no}</td>
                        <td style={tdStyle}>{formatMoney(tx.amount)}</td>
                        <td style={tdStyle}>{formatDateTime(tx.paid_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </MdCard>
        </>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, sub, highlight }) => (
  <MdCard
    style={{
      padding: '20px',
      backgroundColor: highlight
        ? 'var(--md-sys-color-primary-container)'
        : 'var(--md-sys-color-surface-container-lowest)',
    }}
  >
    <div style={{ fontSize: '0.875rem', color: 'var(--md-sys-color-on-surface-variant)' }}>{label}</div>
    <div
      style={{
        fontSize: '1.75rem',
        fontWeight: '500',
        marginTop: '8px',
        color: highlight ? 'var(--md-sys-color-on-primary-container)' : 'inherit',
      }}
    >
      {value}
    </div>
    <div style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--md-sys-color-on-surface-variant)' }}>{sub}</div>
  </MdCard>
);

const TypeBadge = ({ type }) => {
  const isDeposit = type === 'deposit';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '100px',
        fontSize: '0.75rem',
        fontWeight: '500',
        backgroundColor: isDeposit
          ? 'var(--md-sys-color-secondary-container)'
          : 'var(--md-sys-color-tertiary-container)',
        color: isDeposit
          ? 'var(--md-sys-color-on-secondary-container)'
          : 'var(--md-sys-color-on-tertiary-container)',
      }}
    >
      {isDeposit ? 'Deposit' : 'Fine'}
    </span>
  );
};

const dateInputStyle = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--md-sys-color-outline)',
  backgroundColor: 'var(--md-sys-color-surface)',
  color: 'var(--md-sys-color-on-surface)',
  fontSize: '0.95rem',
};

const refreshBtnStyle = {
  padding: '10px 20px',
  borderRadius: '100px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '500',
  backgroundColor: 'var(--md-sys-color-primary)',
  color: 'var(--md-sys-color-on-primary)',
};

const errorBannerStyle = {
  padding: '16px',
  marginBottom: '24px',
  borderRadius: '12px',
  backgroundColor: 'var(--md-sys-color-error-container)',
  color: 'var(--md-sys-color-on-error-container)',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle = {
  textAlign: 'left',
  padding: '12px 24px',
  fontSize: '0.75rem',
  fontWeight: '600',
  color: 'var(--md-sys-color-on-surface-variant)',
  borderBottom: '1px solid var(--md-sys-color-outline-variant)',
};

const tdStyle = {
  padding: '14px 24px',
  borderBottom: '1px solid var(--md-sys-color-outline-variant)',
  fontSize: '0.9rem',
};

export default DailyRevenue;
