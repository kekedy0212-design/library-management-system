import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MdCard from '../../components/MdCard';
import fineService from '../../services/fineService';

const FinesCenter = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [polling, setPolling] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');

  const loadFines = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fineService.getMyFines();
      setSummary(response.data);
      return response.data;
    } catch (err) {
      if (!silent) {
        alert(
          `Failed to load fines: ${err.response?.data?.detail || err.message}`
        );
      }
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFines();
  }, [loadFines]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasReturn =
      params.has('out_trade_no') || params.has('trade_no');
    if (!hasReturn) return;

    const outTradeNo = params.get('out_trade_no');
    setStatusNotice('Payment callback received. Confirming fine status…');
    setPolling(true);

    let attempt = 0;
    const maxAttempts = 8;
    const intervalMs = 1500;
    let timer = null;

    const checkStatus = async () => {
      attempt += 1;
      if (attempt === 1 && outTradeNo) {
        try {
          await fineService.confirmPayment(outTradeNo);
        } catch {
          // ignore, keep polling
        }
      }

      const data = await loadFines(true);
      if (!data?.has_unpaid) {
        if (timer) clearInterval(timer);
        setPolling(false);
        setStatusNotice(
          'All fines are paid. You can borrow other books again.'
        );
        navigate('/fines', { replace: true });
        return;
      }

      if (attempt >= maxAttempts) {
        if (timer) clearInterval(timer);
        setPolling(false);
        setStatusNotice(
          'Payment is still processing. Please click Refresh Status shortly.'
        );
        navigate('/fines', { replace: true });
      }
    };

    checkStatus();
    timer = setInterval(checkStatus, intervalMs);
    return () => clearInterval(timer);
  }, [location.search, loadFines, navigate]);

  const handlePay = async () => {
    setPaying(true);
    try {
      const response = await fineService.createPaymentOrder();
      window.location.href = response.data.pay_url;
    } catch (err) {
      alert(
        `Failed to create payment order: ${err.response?.data?.detail || err.message}`
      );
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        Loading fines…
      </div>
    );
  }

  const unpaidFines =
    summary?.fines?.filter((f) => f.status === 'unpaid') || [];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Overdue Fines</h2>
        <p
          style={{
            color: 'var(--md-sys-color-on-surface-variant)',
            marginTop: '8px',
          }}
        >
          Books returned after the due date incur a fine of 10 CNY per item.
          You cannot borrow other books until all fines are paid.
        </p>
      </header>

      {summary?.has_unpaid && (
        <div
          style={{
            marginBottom: '20px',
            padding: '14px 16px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)',
            fontSize: '0.95rem',
          }}
        >
          You have {summary.unpaid_count} unpaid fine
          {summary.unpaid_count !== 1 ? 's' : ''} totaling ¥
          {summary.unpaid_total}. Please pay before borrowing again.
        </div>
      )}

      <MdCard variant="outlined" style={{ padding: '20px', marginBottom: '20px' }}>
        {statusNotice && (
          <div
            style={{
              marginBottom: '14px',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              fontSize: '0.9rem',
            }}
          >
            {statusNotice}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <Info label="Unpaid items" value={summary?.unpaid_count ?? 0} />
          <Info
            label="Unpaid total"
            value={
              summary?.unpaid_total != null
                ? `¥${summary.unpaid_total}`
                : '¥0'
            }
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handlePay}
            disabled={
              paying ||
              polling ||
              !summary?.has_unpaid
            }
            style={primaryButton}
          >
            {!summary?.has_unpaid
              ? 'No fines to pay'
              : paying
                ? 'Redirecting to Alipay…'
                : `Pay with Alipay (¥${summary.unpaid_total})`}
          </button>
          <button
            type="button"
            onClick={() => loadFines(false)}
            disabled={polling}
            style={secondaryButton}
          >
            {polling ? 'Confirming…' : 'Refresh Status'}
          </button>
        </div>
      </MdCard>

      <MdCard variant="outlined" style={{ padding: '20px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Fine History</h3>
        {!summary?.fines?.length ? (
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            No fine records yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Book</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {summary.fines.map((fine) => (
                  <tr key={fine.id}>
                    <td style={tdStyle}>
                      {fine.book_title || `Loan #${fine.borrow_record_id}`}
                    </td>
                    <td style={tdStyle}>¥{fine.amount}</td>
                    <td style={tdStyle}>{formatFineStatus(fine.status)}</td>
                    <td style={tdStyle}>
                      {formatDisplayDateTime(fine.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {unpaidFines.length > 0 && (
          <ul
            style={{
              marginTop: '16px',
              paddingLeft: '20px',
              color: 'var(--md-sys-color-on-surface-variant)',
              fontSize: '0.9rem',
            }}
          >
            {unpaidFines.map((fine) => (
              <li key={fine.id} style={{ marginBottom: '6px' }}>
                {fine.book_title || 'Book'}: {fine.reason || 'Overdue return'}
              </li>
            ))}
          </ul>
        )}
      </MdCard>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div>
    <div
      style={{
        fontSize: '0.8rem',
        color: 'var(--md-sys-color-on-surface-variant)',
      }}
    >
      {label}
    </div>
    <div style={{ fontWeight: '600', marginTop: '4px' }}>{value}</div>
  </div>
);

const formatFineStatus = (status) => {
  const map = {
    unpaid: 'Unpaid',
    pending: 'Payment pending',
    paid: 'Paid',
  };
  return map[status] || status;
};

const formatDisplayDateTime = (dateString) => {
  if (!dateString) return '-';
  const normalized = /Z|[+-]\d{2}:\d{2}$/.test(dateString)
    ? dateString
    : `${dateString}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleString('en-US', {
    hour12: false,
    timeZone: 'Asia/Shanghai',
  });
};

const thStyle = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid var(--md-sys-color-outline-variant)',
  fontSize: '0.85rem',
};

const tdStyle = {
  padding: '10px 8px',
  borderBottom: '1px solid var(--md-sys-color-outline-variant)',
  fontSize: '0.9rem',
};

const primaryButton = {
  backgroundColor: 'var(--md-sys-color-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: '999px',
  padding: '10px 18px',
  cursor: 'pointer',
  fontWeight: 600,
};

const secondaryButton = {
  backgroundColor: 'transparent',
  color: 'var(--md-sys-color-primary)',
  border: '1px solid var(--md-sys-color-outline)',
  borderRadius: '999px',
  padding: '10px 18px',
  cursor: 'pointer',
  fontWeight: 600,
};

export default FinesCenter;
