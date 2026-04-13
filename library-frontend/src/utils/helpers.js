export const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('zh-CN');
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('zh-CN');
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
    pending: '待审批',
    approved: '已借出',
    rejected: '已拒绝',
    return_pending: '待验收',
    returned: '已归还',
    overdue: '逾期',
  };
  return texts[status] || status;
};