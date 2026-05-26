/** Backend stores UTC; display in China Standard Time (UTC+8). */
const BEIJING_TZ = 'Asia/Shanghai';

const parseServerDate = (dateString) => {
  if (!dateString) return null;
  const raw = String(dateString).trim();
  const normalized = /Z|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (dateString) => {
  const date = parseServerDate(dateString);
  if (!date) return '';
  return date.toLocaleDateString('zh-CN', {
    timeZone: BEIJING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatDateTime = (dateString) => {
  const date = parseServerDate(dateString);
  if (!date) return '';
  return date.toLocaleString('zh-CN', {
    timeZone: BEIJING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const getStatusColor = (status) => {
  const colors = {
    pending: '#ffa500',
    approved: '#28a745',
    rejected: '#dc3545',
    return_pending: '#007bff',
    returned: '#6c757d',
    overdue: '#ffc107',
  };
  return colors[status] || '#6c757d';
};

export const getStatusText = (status) => {
  const texts = {
    pending: 'Pending',
    approved: 'Borrowed',
    rejected: 'Rejected',
    return_pending: 'Return pending',
    returned: 'Returned',
    overdue: 'Overdue',
  };
  return texts[status] || status;
};
