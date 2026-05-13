import React, { useEffect } from 'react';

const Toast = ({ visible, type = 'info', text = '', onClose, duration = 3500 }) => {
  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => {
      onClose && onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onClose]);

  if (!visible) return null;

  const palette = TOAST_PALETTE[type] || TOAST_PALETTE.info;

  return (
    <div style={{ ...baseStyle, ...palette }} role="status" aria-live="polite">
      {text}
    </div>
  );
};

const baseStyle = {
  position: 'fixed',
  right: '24px',
  top: '24px',
  zIndex: 4000,
  padding: '12px 16px',
  borderRadius: '10px',
  boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
  fontWeight: 500,
  maxWidth: '360px',
  whiteSpace: 'pre-line',
};

const TOAST_PALETTE = {
  success: {
    backgroundColor: '#e8f5e9',
    color: '#1b5e20',
    border: '1px solid #a5d6a7',
  },
  warning: {
    backgroundColor: '#fff8e1',
    color: '#8d6e00',
    border: '1px solid #ffe082',
  },
  error: {
    backgroundColor: '#fdecea',
    color: '#b71c1c',
    border: '1px solid #f5a3a3',
  },
  info: {
    backgroundColor: '#e3f2fd',
    color: '#0d47a1',
    border: '1px solid #90caf9',
  },
};

export default Toast;
