import api from './api';

const fineService = {
  getMyFines: () => api.get('/fines/me'),

  createPaymentOrder: () => api.post('/fines/create-order'),

  confirmPayment: (outTradeNo) =>
    api.post('/fines/confirm', { out_trade_no: outTradeNo }),
};

export default fineService;
