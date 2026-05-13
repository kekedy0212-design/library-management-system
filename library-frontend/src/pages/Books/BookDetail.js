import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooks } from '../../hooks/useBooks';
import { useBorrow } from '../../hooks/useBorrow';
import { formatDate } from '../../utils/helpers';
import { hasPermission } from '../../utils/auth';
import { ROLES } from '../../utils/constants';
import { borrowService } from '../../services/borrowService';
import MdCard from '../../components/MdCard';
import Toast from '../../components/Toast';
import JsBarcode from 'jsbarcode';

const BookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentBook, loading, error, fetchBookById, deleteBook } = useBooks();
  const { borrowBook } = useBorrow();
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [reserveLoading, setReserveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [requestedDueDate, setRequestedDueDate] = useState('');
  const [toast, setToast] = useState({ visible: false, type: 'info', text: '' });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [barcodeSettings, setBarcodeSettings] = useState({
    copyRange: '',
    itemsPerRow: 2,
    itemGap: 24,
    height: 110,
    fontSize: 18,
    textMargin: 15,
    width: 2
  });

  const handleSettingChange = (key, value) => {
    setBarcodeSettings(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (id) fetchBookById(parseInt(id));
  }, [id, fetchBookById]);

  useEffect(() => {
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 14);
    setRequestedDueDate(defaultDue.toISOString().slice(0, 10));
  }, []);

  const handleBorrow = async () => {
    setBorrowLoading(true);
    try {
      const requestedDueDateIso = requestedDueDate
        ? new Date(`${requestedDueDate}T23:59:59`).toISOString()
        : null;
      await borrowBook({
        book_id: currentBook.id,
        requested_due_date: requestedDueDateIso,
      });
      setToast({
        visible: true,
        type: 'success',
        text: 'Borrow request submitted. Please wait for librarian approval.',
      });
      setTimeout(() => navigate('/borrow'), 1200);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      if (detail === 'Deposit required before borrowing') {
        if (window.confirm('You need to pay the deposit before borrowing. Go to Deposit Center now?')) {
          navigate('/deposit');
          return;
        }
      }
      setToast({
        visible: true,
        type: 'error',
        text: `Borrowing failed: ${detail}`,
      });
    } finally {
      setBorrowLoading(false);
    }
  };

  const handleEdit = () => navigate(`/books/${id}/edit`);

  const handleReserve = async () => {
    setReserveLoading(true);
    try {
      await borrowService.reserveRequest(currentBook.id);
      setToast({
        visible: true,
        type: 'success',
        text: 'Reservation request submitted. Please wait for librarian approval.',
      });
      setTimeout(() => navigate('/borrow'), 1200);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      if (detail === 'Deposit required before reservation') {
        if (window.confirm('You need to pay the deposit before reservation. Go to Deposit Center now?')) {
          navigate('/deposit');
          return;
        }
      }
      setToast({
        visible: true,
        type: 'error',
        text: `Reservation failed: ${detail}`,
      });
    } finally {
      setReserveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this book?')) return;
    setDeleteLoading(true);
    try {
      await deleteBook(currentBook.id);
      alert('Book deleted successfully.');
      navigate('/books');
    } catch (err) {
      alert(`Deletion failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--md-sys-color-error)' }}>{error}</div>;
  if (!currentBook) return <div style={{ padding: '40px', textAlign: 'center' }}>Book not found.</div>;

  const sectionTitleStyle = {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--md-sys-color-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05rem',
    marginBottom: '16px',
    marginTop: '0'
  };

  // 解析打印范围的逻辑
  const parseRange = (rangeStr, max) => {
    if (!rangeStr.trim()) return Array.from({ length: max }, (_, i) => i + 1);
    const parts = rangeStr.split(',');
    const result = new Set();
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        for (let i = start; i <= Math.min(end, max); i++) result.add(i);
      } else {
        const val = Number(part.trim());
        if (val > 0 && val <= max) result.add(val);
      }
    });
    return result.size > 0 ? Array.from(result).sort((a, b) => a - b) : [1];
  };

  const handlePrint = () => {
    const { copyRange, itemsPerRow, itemGap, height, fontSize, textMargin, width } = barcodeSettings;
    const selectedCopies = parseRange(copyRange, currentBook.total_copies);
    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
      <html>
        <head>
          <title>Barcodes - ${currentBook.title}</title>
          <style>
            body { margin: 0; padding: 20px; font-family: sans-serif; }
            .grid { 
              display: grid; 
              grid-template-columns: repeat(${itemsPerRow}, 1fr); 
              gap: ${itemGap}px; 
            }
            .item { 
              display: flex; flex-direction: column; align-items: center; 
              padding: 10px; border: 1px dashed #ccc;
            }
            @media print { .item { border: 1px solid #eee; page-break-inside: avoid; } }
          </style>
        </head>
        <body><div class="grid" id="g"></div></body>
      </html>
    `);

    const grid = printWindow.document.getElementById('g');
    selectedCopies.forEach(num => {
      const container = printWindow.document.createElement('div');
      container.className = 'item';
      const svg = printWindow.document.createElementNS("http://www.w3.org/2000/svg", "svg");
      container.appendChild(svg);
      grid.appendChild(container);

      // CODE128 静区（quiet zone）规范要求至少 10 个最窄模块宽度，给足白边
      const quietZone = Math.max(20, width * 12);
      JsBarcode(svg, `${currentBook.isbn}/${num}`, {
        format: "CODE128",
        width,
        height,
        fontSize,
        textMargin,
        margin: quietZone,
        background: "#ffffff",
        lineColor: "#000000",
        displayValue: true,
        fontOptions: "bold"
      });
    });

    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    setIsModalOpen(false);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <Toast
        visible={toast.visible}
        type={toast.type}
        text={toast.text}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '400', margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
            {currentBook.title}
          </h1>
          <p style={{ color: 'var(--md-sys-color-secondary)', fontSize: '1.2rem', margin: '4px 0 0 0' }}>
            {currentBook.author}
          </p>
        </div>
        <button
          onClick={() => navigate('/books')}
          style={{
            padding: '8px 20px',
            borderRadius: '20px',
            border: '1px solid var(--md-sys-color-outline)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          Back to List
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '350px 1fr',
        gap: '32px',
        alignItems: 'stretch' // 确保左右列高度相等
      }}>

        {/* Left Column: Status & Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Availability Card */}
          <MdCard variant="outlined" style={{ padding: '24px' }}>
            <h3 style={sectionTitleStyle}>Availability</h3>
            <div style={{ display: 'grid', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--md-sys-color-outline)' }}>Status</span>
                <StatusBadge count={currentBook.available_copies} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--md-sys-color-outline)' }}>Location</span>
                <span style={{ fontWeight: '500' }}>{currentBook.location || 'Main Shelf'}</span>
              </div>

              <hr style={{ border: '0', borderTop: '1px solid var(--md-sys-color-outline-variant)', margin: '8px 0', opacity: 0.5 }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', gap: '8px' }}>
                <InfoField label="Total" value={currentBook.total_copies} />
                <InfoField label="Available" value={currentBook.available_copies} />
                <InfoField label="On Loan" value={currentBook.total_copies - currentBook.available_copies} />
              </div>
            </div>
          </MdCard>

          {/* Identifiers Card */}
          <MdCard variant="outlined" style={cardContainerStyle}>
            {/* 1. 标题 */}
            <h3 style={sectionTitleStyle}>Identifiers</h3>

            {/* 2. ISBN 信息 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ color: 'var(--md-sys-color-outline)', fontSize: '0.9rem' }}>ISBN</span>
              <span style={{
                fontWeight: '600',
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                color: 'var(--md-sys-color-on-surface)'
              }}>
                {currentBook.isbn}
              </span>
            </div>
            {hasPermission(ROLES.LIBRARIAN) && (
              <>
                {/* 3. 自动占位符（可选） */}
                {/* 如果你想让按钮始终贴在卡片底部，取消下面这个 div 的注释 */}
                {<div style={{ flex: 1 }}></div>}

                {/* 4. 按钮 - 现在它紧跟在 ISBN 后面 */}
                <button
                  onClick={() => setIsModalOpen(true)}
                  style={updatedFabStyle}
                  onMouseOver={(e) => e.currentTarget.style.boxShadow = 'var(--md-sys-elevation-level4)'}
                  onMouseOut={(e) => e.currentTarget.style.boxShadow = 'var(--md-sys-elevation-level3)'}
                >
                  <md-icon style={{ fontSize: '24px' }}>barcode</md-icon>
                  <span style={{ fontWeight: '500', marginLeft: '8px' }}>Generate Barcodes</span>
                </button>              </>
            )}
          </MdCard>
        </div>

        {/* 对话框 */}
        {isModalOpen && (
          <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '400' }}>Barcode Print Settings</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Copy Range</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 1-3, 5, 7-10 (Leave empty for all)"
                    value={barcodeSettings.copyRange}
                    onChange={(e) => handleSettingChange('copyRange', e.target.value)}
                  />
                </div>

                <div style={rowStyle}>
                  <div style={flexField}>
                    <label style={labelStyle}>Items Per Row</label>
                    <input type="number" style={inputStyle} placeholder="Default: 2"
                      value={barcodeSettings.itemsPerRow} onChange={(e) => handleSettingChange('itemsPerRow', e.target.value)} />
                  </div>
                  <div style={flexField}>
                    <label style={labelStyle}>Gap (px)</label>
                    <input type="number" style={inputStyle} placeholder="e.g. 24"
                      value={barcodeSettings.itemGap} onChange={(e) => handleSettingChange('itemGap', e.target.value)} />
                  </div>
                </div>

                <div style={rowStyle}>
                  <div style={flexField}>
                    <label style={labelStyle}>Bar Height (px)</label>
                    <input type="number" style={inputStyle} placeholder="Default: 100"
                      value={barcodeSettings.height} onChange={(e) => handleSettingChange('height', e.target.value)} />
                  </div>
                  <div style={flexField}>
                    <label style={labelStyle}>Bar Width</label>
                    <input type="number" step="0.5" style={inputStyle} placeholder="1.0 - 3.0"
                      value={barcodeSettings.width} onChange={(e) => handleSettingChange('width', e.target.value)} />
                  </div>
                </div>

                <div style={rowStyle}>
                  <div style={flexField}>
                    <label style={labelStyle}>Font Size (pt)</label>
                    <input type="number" style={inputStyle} placeholder="e.g. 18"
                      value={barcodeSettings.fontSize} onChange={(e) => handleSettingChange('fontSize', e.target.value)} />
                  </div>
                  <div style={flexField}>
                    <label style={labelStyle}>Text Margin (px)</label>
                    <input type="number" style={inputStyle} placeholder="Spacing to text"
                      value={barcodeSettings.textMargin} onChange={(e) => handleSettingChange('textMargin', e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={actionAreaStyle}>
                <button onClick={() => setIsModalOpen(false)} style={textBtnStyle}>Cancel</button>
                <button onClick={handlePrint} style={filledBtnStyle}>Confirm & Print</button>
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Description & Actions */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          height: '100%', // 确保子元素可以参考高度
        }}>
          {/* Description Card */}
          <MdCard variant="filled" style={{
            padding: '32px',
            flex: 1,            // 让卡片占据右侧列的所有剩余高度
            display: 'flex',    // 【新增】必须设为 flex，内部的 p 标签 flex: 1 才会生效
            flexDirection: 'column'
          }}>
            <h3 style={sectionTitleStyle}>Description</h3>
            <p style={{
              lineHeight: '1.8',
              fontSize: '1.05rem',
              margin: 0,
              color: 'var(--md-sys-color-on-surface-variant)',
              whiteSpace: 'pre-line',
              flex: 1,          // 这里的 flex: 1 会把底部的空间填满
            }}>
              {currentBook.description || "No description provided."}
            </p>
          </MdCard>

          {/*currentBook.available_copies > 0 && (
            <MdCard variant="outlined" style={{ padding: '20px' }}>
              <h3 style={sectionTitleStyle}>Preferred Return Date</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="date"
                  value={requestedDueDate}
                  onChange={(e) => setRequestedDueDate(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--md-sys-color-outline)',
                    background: 'var(--md-sys-color-surface)',
                    color: 'var(--md-sys-color-on-surface)',
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-outline)' }}>
                  Default is 14 days if empty/invalid.
                </span>
              </div>
            </MdCard>
          )*/}

          {/* Action Footer - 右对齐处理 */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end', // 关键修改：按钮右对齐
            alignItems: 'center',
            gap: '12px',
            marginTop: '8px'
          }}>
            {hasPermission(ROLES.LIBRARIAN) && (
              <>
                <button onClick={handleDelete} disabled={deleteLoading} style={dangerBtnStyle}>
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
                <button onClick={handleEdit} style={secondaryBtnStyle}>Edit Details</button>
              </>
            )}

            {/* {currentBook.available_copies > 0 && (
              <button
                onClick={handleBorrow}
                disabled={borrowLoading}
                style={primaryBtnStyle}
              >
                {borrowLoading ? 'Processing...' : 'Request to Borrow'}
              </button>
            )} */}
            {/* {currentBook.available_copies <= 0 && (
              <button
                onClick={handleReserve}
                disabled={reserveLoading}
                style={primaryBtnStyle}
              >
                {reserveLoading ? 'Processing...' : 'Request Reservation'}
              </button>
            )} */}
          </div>
        </div>
      </div>

      {/* Metadata Footer */}
      <footer style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid var(--md-sys-color-outline-variant)', display: 'flex', justifyContent: 'center', gap: '24px' }}>
        <span style={footerTextStyle}>Created: {formatDate(currentBook.created_at)}</span>
        <span style={footerTextStyle}>Updated: {currentBook.updated_at ? formatDate(currentBook.updated_at) : 'N/A'}</span>
      </footer>
    </div>
  );
};

// --- Helper Components ---

const InfoField = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <div style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-outline)', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{value}</div>
  </div>
);

const StatusBadge = ({ count }) => {
  const inStock = count > 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        backgroundColor: inStock ? '#4caf50' : '#f44336'
      }} />
      <span style={{
        color: inStock ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)',
        fontSize: '0.9rem',
        fontWeight: '600'
      }}>
        {inStock ? 'In Stock' : 'Out of Stock'}
      </span>
    </div>
  );
};

// --- Styles ---

const footerTextStyle = {
  fontSize: '0.75rem',
  color: 'var(--md-sys-color-outline)',
  fontStyle: 'italic'
};

const primaryBtnStyle = {
  backgroundColor: 'var(--md-sys-color-primary)',
  color: 'white',
  border: 'none',
  padding: '12px 32px',
  borderRadius: '100px',
  fontWeight: '600',
  cursor: 'pointer',
  boxShadow: 'var(--md-sys-elevation-level1)'
};

const secondaryBtnStyle = {
  backgroundColor: 'var(--md-sys-color-secondary-container)',
  color: 'var(--md-sys-color-on-secondary-container)',
  border: 'none',
  padding: '12px 24px',
  borderRadius: '100px',
  fontWeight: '500',
  cursor: 'pointer'
};

const dangerBtnStyle = {
  backgroundColor: 'transparent',
  color: 'var(--md-sys-color-error)',
  border: '1px solid var(--md-sys-color-error)',
  padding: '12px 24px',
  borderRadius: '100px',
  fontWeight: '500',
  cursor: 'pointer'
};

const fabStyle = {
  position: 'absolute',
  right: '16px',
  bottom: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0px',
  height: '50px',
  padding: '0 15px',
  backgroundColor: 'var(--md-sys-color-secondary-container)',
  color: 'var(--md-sys-color-on-secondary-container)',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  boxShadow: 'var(--md-sys-elevation-level3)',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: 2, // 确保在卡片内容之上

};
const cardContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  padding: '24px',
  boxSizing: 'border-box',
};

const updatedFabStyle = {
  ...fabStyle,
  position: 'relative', // 改为相对定位或默认 static
  right: 'auto',        // 清除之前的绝对定位属性
  bottom: 'auto',
  alignSelf: 'flex-end', // 关键：让按钮在 Flex 容器中靠右对齐
  marginTop: '5px',     // 与上方 ISBN 信息保持间距
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 2000
};

const modalContentStyle = {
  backgroundColor: 'var(--md-sys-color-surface-container-high)',
  padding: '24px',
  borderRadius: '28px',
  width: '100%',
  maxWidth: '520px', // 稍微加宽，配合更窄的输入框以消除滚动条
  boxShadow: 'var(--md-sys-elevation-level3)',
  overflow: 'hidden' // 确保不出现滚动条
};

const scrollAreaStyle = {
  overflowY: 'auto', // 内部内容过多时可滚动
  paddingRight: '8px',
  flex: 1
};

const rowStyle = {
  display: 'flex',
  gap: '16px',
  marginBottom: '16px'
};

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: '16px'
};

const flexField = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px'
};

const labelStyle = {
  fontSize: '0.75rem',
  fontWeight: '500',
  color: 'var(--md-sys-color-on-surface-variant)',
  marginLeft: '4px'
};

const inputStyle = {
  padding: '15px 12px',
  borderRadius: '8px',
  border: '1px solid var(--md-sys-color-outline)',
  backgroundColor: 'transparent',
  fontSize: '0.9rem',
  color: 'var(--md-sys-color-on-surface)',
  width: '100%',
  boxSizing: 'border-box'
};

const actionAreaStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '24px',
  paddingTop: '16px',
  borderTop: '1px solid var(--md-sys-color-outline-variant)'
};

const textBtnStyle = {
  padding: '10px 20px',
  background: 'none',
  border: 'none',
  color: 'var(--md-sys-color-primary)',
  fontWeight: '600',
  cursor: 'pointer'
};

const filledBtnStyle = {
  padding: '10px 24px',
  backgroundColor: 'var(--md-sys-color-primary)',
  color: 'white',
  border: 'none',
  borderRadius: '100px',
  fontWeight: '600',
  cursor: 'pointer'
};

const sectionTitleStyle = {
  fontSize: '0.875rem',
  fontWeight: '600',
  color: 'var(--md-sys-color-primary)',
  textTransform: 'uppercase',
  marginBottom: '16px'
};

export default BookDetail;