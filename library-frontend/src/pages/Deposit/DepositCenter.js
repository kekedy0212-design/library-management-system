import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MdCard from '../../components/MdCard';
import { depositService } from '../../services/depositService';

const DepositCenter = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [deposit, setDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [polling, setPolling] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');
  const [toast, setToast] = useState({ visible: false, type: 'info', text: '' });

  const loadDeposit = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await depositService.getMyDeposit();
      setDeposit(response.data);
      return response.data;
    } catch (err) {
      if (!silent) {
        alert(`Failed to load deposit info: ${err.response?.data?.detail || err.message}`);
      }
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeposit();
  }, [loadDeposit]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasAlipayReturn = params.has('out_trade_no') || params.has('trade_no');
    if (!hasAlipayReturn) return;
    const outTradeNo = params.get('out_trade_no');

    setStatusNotice('Payment callback received. Checking deposit status...');
    setPolling(true);

    let attempt = 0;
    const maxAttempts = 8;
    const intervalMs = 1500;
    let timer = null;

    const checkStatus = async () => {
      attempt += 1;

      // First round: actively query Alipay once as fallback.
      if (attempt === 1 && outTradeNo) {
        try {
          await depositService.confirmDeposit(outTradeNo);
        } catch {
          // Ignore confirm errors here, polling below remains the fallback.
        }
      }

      const data = await loadDeposit(true);
      if (data?.status === 'paid') {
        if (timer) clearInterval(timer);
        setPolling(false);
        setStatusNotice('Deposit payment confirmed. You can borrow books now.');
        setToast({
          visible: true,
          type: 'success',
          text: 'Payment successful. Your deposit is now active.',
        });
        navigate('/deposit', { replace: true });
        return;
      }

      if (attempt >= maxAttempts) {
        if (timer) clearInterval(timer);
        setPolling(false);
        setStatusNotice('Still processing payment. Please click "Refresh Status" after a few seconds.');
        setToast({
          visible: true,
          type: 'warning',
          text: 'Payment is still being confirmed. Please refresh status shortly.',
        });
        navigate('/deposit', { replace: true });
      }
    };

    // Run immediately once, then continue polling.
    checkStatus();
    timer = setInterval(checkStatus, intervalMs);

    return () => clearInterval(timer);
  }, [location.search, loadDeposit, navigate]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  const handlePay = async () => {
    setPaying(true);
    try {
      const response = await depositService.createDepositOrder();
      window.location.href = response.data.pay_url;
    } catch (err) {
      alert(`Failed to create payment order: ${err.response?.data?.detail || err.message}`);
      setPaying(false);
    }
  };

  const handleRefundClick = async () => {
    if (!deposit || refunding) return;
    setRefunding(true);
    try {
      const resp = await depositService.requestRefund();
      const outRefundNo = resp.data.out_refund_no;

      // poll for refund status
      let attempt = 0;
      const maxAttempts = 8;
      const intervalMs = 1500;
      let timer = null;

      const checkStatus = async () => {
        attempt += 1;
        if (attempt === 1) {
          try {
            await depositService.confirmRefund(outRefundNo);
          } catch {
            // ignore
          }
        }

        const data = await loadDeposit(true);
        if (data?.status === 'refunded') {
          if (timer) clearInterval(timer);
          setRefunding(false);
          setToast({ visible: true, type: 'success', text: '退款成功，押金已退回。' });
          return;
        }

        if (attempt >= maxAttempts) {
          if (timer) clearInterval(timer);
          setRefunding(false);
          setToast({ visible: true, type: 'warning', text: '退款正在处理中，请稍后查看状态。' });
        }
      };

      checkStatus();
      timer = setInterval(checkStatus, intervalMs);

    } catch (err) {
      setToast({ visible: true, type: 'error', text: `退款失败: ${err.response?.data?.detail || err.message}` });
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading deposit info...</div>;
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {toast.visible && (
        <div style={{
          ...toastBaseStyle,
          ...(toast.type === 'success' ? toastSuccessStyle : toastWarningStyle),
        }}>
          {toast.text}
        </div>
      )}

      <header style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Deposit Center</h2>
        <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          Readers must pay a refundable deposit before sending borrow requests.
        </p>
      </header>

      <MdCard variant="outlined" style={{ padding: '20px' }}>
        {statusNotice && (
          <div style={{
            marginBottom: '14px',
            padding: '10px 12px',
            borderRadius: '10px',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            color: 'var(--md-sys-color-on-surface)',
            fontSize: '0.9rem',
          }}>
            {statusNotice}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <Info label="Deposit Amount" value={deposit?.amount ? `$${deposit.amount}` : '-'} />
          <Info label="Current Status" value={formatStatus(deposit?.status)} />
          <Info label="Paid At" value={formatDisplayDateTime(deposit?.paid_at)} />
          <Info label="Refunded At" value={formatDisplayDateTime(deposit?.refunded_at)} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handlePay}
            disabled={paying || polling || deposit?.status === 'paid'}
            style={primaryButton}
          >
            {deposit?.status === 'paid' ? 'Deposit Already Paid' : (paying ? 'Redirecting to Alipay...' : 'Pay Deposit with Alipay')}
          </button>
          <button onClick={() => loadDeposit(false)} disabled={polling} style={secondaryButton}>
            {polling ? 'Checking...' : 'Refresh Status'}
          </button>
          {deposit?.status === 'paid' && (
              <button
                onClick={handleRefundClick}
                disabled={refunding}
                style={secondaryButton}
              >
                {refunding ? 'Processing...' : 'Request Refund'}
              </button>
          )}
        </div>
        
      </MdCard>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div>
    <div style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>{label}</div>
    <div style={{ fontWeight: '600', marginTop: '4px' }}>{value}</div>
  </div>
);

const formatStatus = (status) => {
  if (!status) return '-';
  return status
    .split('_')
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(' ');
};

const formatDisplayDateTime = (dateString) => {
  if (!dateString) return '-';

  // Backend currently stores naive UTC-like timestamps.
  // Normalize to UTC first, then render in Asia/Shanghai.
  const normalized = /Z|[+-]\d{2}:\d{2}$/.test(dateString) ? dateString : `${dateString}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleString('zh-CN', {
    hour12: false,
    timeZone: 'Asia/Shanghai',
  });
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

const toastBaseStyle = {
  position: 'fixed',
  right: '24px',
  top: '24px',
  zIndex: 1000,
  padding: '12px 16px',
  borderRadius: '10px',
  boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
  fontWeight: 500,
  maxWidth: '360px',
};

const toastSuccessStyle = {
  backgroundColor: '#e8f5e9',
  color: '#1b5e20',
  border: '1px solid #a5d6a7',
};

const toastWarningStyle = {
  backgroundColor: '#fff8e1',
  color: '#8d6e00',
  border: '1px solid #ffe082',
};

export default DepositCenter;
