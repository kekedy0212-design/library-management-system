import api from './api';

export const depositService = {
  getMyDeposit: () => api.get('/deposits/me'),
  createDepositOrder: () => api.post('/deposits/create-order'),
  confirmDeposit: (outTradeNo) => api.post('/deposits/confirm', { out_trade_no: outTradeNo }),
  requestRefund: (reason = '') => api.post('/deposits/refund', { reason }),
  confirmRefund: (outRefundNo) => api.post('/deposits/confirm-refund', { out_refund_no: outRefundNo }),
};
