import React, { useEffect, useState, useMemo } from 'react';
import BarcodeScanner from './BarcodeScanner';
import { useBorrow } from '../hooks/useBorrow';
import { useBooks } from '../hooks/useBooks';
import { bookService } from '../services/bookService';

const parseBarcode = (text) => {
    if (!text) {
        throw new Error('Empty barcode');
    }

    const parts = text.split('/');

    if (parts.length !== 2) {
        throw new Error(
            'Invalid barcode format. Expected ISBN/COPY_ID'
        );
    }

    const isbn = parts[0]?.trim();

    const copyText = parts[1]?.trim();

    if (!isbn) {
        throw new Error('ISBN missing');
    }

    if (!/^\d+$/.test(copyText)) {
        throw new Error(
            'Copy ID must be a positive integer'
        );
    }

    return {
        raw: text,

        isbn,

        copyId: Number(copyText),

        barcode: text,
    };
};

const BorrowScannerDialog = ({
    open,
    onClose,
}) => {
    const { books, fetchBooks } = useBooks();
    const { borrowBook } = useBorrow();

    const [scannedBooks, setScannedBooks] = useState([]);
    const [errors, setErrors] = useState([]);
    const [borrowing, setBorrowing] = useState(false);

    const [scannerKey, setScannerKey] = useState(0);
    useEffect(() => {
        if (open) {
            setScannerKey(prev => prev + 1);
        }
    }, [open]);

    const handleDetected = async (rawText) => {
        // 辅助函数：标准化 ISBN
        const normalizeIsbn = (isbn) => String(isbn || '').replace(/[- \s]/g, '').trim();

        try {
            const parsed = parseBarcode(rawText);
            const currentNormalizedIsbn = normalizeIsbn(parsed.isbn);

            // --- 核心修改：检查 state 中是否已存在该 ISBN ---
            // 注意：要同时检查 item 本身和 item.book 里的 isbn
            const isDuplicate = scannedBooks.some(item => {
                const existingIsbn = item.isbn || item.book?.isbn;
                return normalizeIsbn(existingIsbn) === currentNormalizedIsbn;
            });

            if (isDuplicate) {
                console.warn("Duplicate ISBN detected, ignoring:", currentNormalizedIsbn);
                return; // 发现重复，直接退出，不执行后续逻辑
            }

            // 调用接口获取书籍详情
            const response = await bookService.getBooks({ search: parsed.isbn });
            const matchedBooks = response.data || [];
            const matchedBook = matchedBooks.find(b => normalizeIsbn(b.isbn) === currentNormalizedIsbn);

            if (!matchedBook) {
                throw new Error(`未找到 ISBN 匹配的书籍: ${parsed.isbn}`);
            }

            navigator.vibrate?.(80);

            // 写入 State
            setScannedBooks(prev => {
                const newList = [...prev, { ...parsed, book: matchedBook }];

                // 根据 ISBN 去重
                const map = new Map();
                return newList.filter(item => {
                    const id = normalizeIsbn(item.isbn || item.book?.isbn);
                    return map.has(id) ? false : map.set(id, true);
                });
            });

        } catch (err) {
            console.error(err);
            setErrors(prev => [err.message || '扫码失败', ...prev]);
        }
    };

    const handleBorrowAll = async () => {
        if (!scannedBooks.length) {
            return;
        }

        setBorrowing(true);

        const failed = [];
        const succeeded = [];

        for (const item of scannedBooks) {
            try {
                // 确保所有 ID 都是纯 Integer 类型
                const payload = {
                    book_id: Number(item.book.id), // 强制转换
                    copy_id: Number(item.copyId),  // 强制转换
                };
                await borrowBook(payload);

                succeeded.push(item.raw);

            } catch (err) {
                console.error("Single book borrow failed:", err);

                // 提取具体的错误信息
                // 后端的 detail 可能是数组（如你提供的报错），也可能是字符串
                let errorMsg = 'Borrow failed';
                const detail = err.response?.data?.detail;

                if (Array.isArray(detail)) {
                    errorMsg = detail[0]?.msg || errorMsg;
                } else if (typeof detail === 'string') {
                    errorMsg = detail;
                } else {
                    errorMsg = err.message || errorMsg;
                }

                failed.push(`${item.book.title}: ${errorMsg}`);
            }
        }

        // ... 后续处理成功或失败的状态更新
        setBorrowing(false);
    };

    const clearErrors = () => {
        setErrors([]);
    };

    const clearAll = () => {
        setScannedBooks([]);
        setErrors([]);
    };

    const pendingCount = useMemo(
        () => scannedBooks.length,
        [scannedBooks]
    );

    if (!open) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 3000,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '760px',
                    height: '90vh',

                    borderRadius: '28px',

                    background:
                        'var(--md-sys-color-surface)',

                    boxShadow:
                        '0px 8px 24px rgba(0,0,0,0.18)',

                    display: 'flex',
                    flexDirection: 'column',

                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '24px 24px 16px',
                        borderBottom:
                            '1px solid var(--md-sys-color-outline-variant)',

                        flexShrink: 0,

                        background:
                            'var(--md-sys-color-surface)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <div>
                            <h2
                                style={{
                                    margin: 0,
                                    fontWeight: '500',
                                }}
                            >
                                Scan & Borrow
                            </h2>

                            <p
                                style={{
                                    marginTop: '6px',
                                    marginBottom: 0,
                                    fontSize: '0.9rem',
                                    color:
                                        'var(--md-sys-color-on-surface-variant)',
                                }}
                            >
                                Scan multiple books and borrow them together.
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            style={{
                                height: '40px',
                                padding: '0 18px',
                                borderRadius: '14px',
                                border: 'none',
                                cursor: 'pointer',

                                background:
                                    'var(--md-sys-color-surface-container)',

                                color:
                                    'var(--md-sys-color-on-surface)',
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
                <div
                    style={{
                        flex: 1,
                        overflow: 'hidden',

                        display: 'flex',
                        gap: '24px',

                        padding: '24px',

                        minHeight: 0,
                    }}
                >
                    {/* LEFT: Scanner */}
                    <div
                        style={{
                            width: '42%',
                            minWidth: '320px',

                            display: 'flex',
                            flexDirection: 'column',

                            flexShrink: 0,
                        }}
                    >
                        <div
                            style={{
                                marginBottom: '12px',
                            }}
                        >
                            <h3
                                style={{
                                    margin: 0,
                                    fontWeight: '500',
                                }}
                            >
                                Live Scanner
                            </h3>

                            <p
                                style={{
                                    marginTop: '6px',
                                    fontSize: '0.9rem',

                                    color:
                                        'var(--md-sys-color-on-surface-variant)',
                                }}
                            >
                                Scan ISBN/COPY_ID barcode
                            </p>
                        </div>

                        <div
                            style={{
                                borderRadius: '24px',
                                overflow: 'hidden',

                                background:
                                    'var(--md-sys-color-surface-container)',

                                border:
                                    '1px solid var(--md-sys-color-outline-variant)',
                            }}
                        >
                            <BarcodeScanner
                                key={scannerKey}
                                active={open}
                                onDetected={handleDetected}
                                onError={(msg) => {
                                    setErrors(prev => [msg, ...prev]);
                                }}
                            />
                        </div>

                        <div
                            style={{
                                marginTop: '12px',
                                fontSize: '0.82rem',

                                color:
                                    'var(--md-sys-color-on-surface-variant)',
                            }}
                        >
                            Copy ID is temporarily stored only.
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div
                        style={{
                            flex: 1,

                            display: 'flex',
                            flexDirection: 'column',

                            minHeight: 0,
                        }}
                    >
                        {/* Pending Header */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',

                                marginBottom: '16px',

                                flexShrink: 0,
                            }}
                        >
                            <h3
                                style={{
                                    margin: 0,
                                    fontWeight: '500',
                                }}
                            >
                                Pending Borrow List
                            </h3>

                            <span
                                style={{
                                    fontSize: '0.9rem',

                                    color:
                                        'var(--md-sys-color-on-surface-variant)',
                                }}
                            >
                                {scannedBooks.length} item
                                {scannedBooks.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Scrollable List */}
                        <div
                            style={{
                                flex: 1,

                                overflowY: 'auto',

                                paddingRight: '4px',

                                minHeight: 0,
                            }}
                        >
                            {scannedBooks.length === 0 && (
                                <div
                                    style={{
                                        padding: '32px',

                                        borderRadius: '20px',

                                        textAlign: 'center',

                                        background:
                                            'var(--md-sys-color-surface-container)',

                                        color:
                                            'var(--md-sys-color-on-surface-variant)',
                                    }}
                                >
                                    No books scanned yet
                                </div>
                            )}

                            {scannedBooks.map((item, index) => (
                                <div
                                    key={item.book?.isbn || item.isbn}
                                    style={{
                                        padding: '16px',
                                        marginBottom: '12px',

                                        borderRadius: '20px',

                                        background:
                                            'var(--md-sys-color-surface-container)',

                                        border:
                                            '1px solid var(--md-sys-color-outline-variant)',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: '16px',
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div
                                                style={{
                                                    fontSize: '1rem',
                                                    fontWeight: '600',
                                                    marginBottom: '4px',
                                                }}
                                            >
                                                {item.book.title}
                                            </div>

                                            <div
                                                style={{
                                                    fontSize: '0.92rem',

                                                    color:
                                                        'var(--md-sys-color-on-surface-variant)',
                                                }}
                                            >
                                                {item.book.author}
                                            </div>

                                            <div
                                                style={{
                                                    marginTop: '10px',

                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    gap: '8px',
                                                }}
                                            >
                                                <Badge
                                                    label={`ISBN: ${item.isbn}`}
                                                />

                                                <Badge
                                                    label={`Copy ID: ${item.copyId}`}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setScannedBooks(prev =>
                                                    prev.filter(
                                                        (_, i) => i !== index
                                                    )
                                                );
                                            }}
                                            style={{
                                                border: 'none',
                                                background: 'transparent',

                                                color:
                                                    'var(--md-sys-color-error)',

                                                cursor: 'pointer',

                                                fontWeight: '600',

                                                flexShrink: 0,
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Errors */}
                        {errors.length > 0 && (
                            <div
                                style={{
                                    marginTop: '16px',

                                    padding: '16px',

                                    borderRadius: '20px',

                                    background:
                                        'var(--md-sys-color-error-container)',

                                    color:
                                        'var(--md-sys-color-on-error-container)',

                                    flexShrink: 0,
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '10px',
                                    }}
                                >
                                    <strong>Errors</strong>

                                    <button
                                        onClick={clearErrors}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',

                                            cursor: 'pointer',

                                            color:
                                                'var(--md-sys-color-on-error-container)',

                                            fontWeight: '600',
                                        }}
                                    >
                                        Clear
                                    </button>
                                </div>

                                <ul
                                    style={{
                                        margin: 0,
                                        paddingLeft: '20px',
                                        maxHeight: '120px',
                                        overflowY: 'auto',
                                    }}
                                >
                                    {errors.map((err, idx) => (
                                        <li
                                            key={`${err}-${idx}`}
                                            style={{
                                                marginBottom: '6px',
                                            }}
                                        >
                                            {err}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
                {/* Footer Actions */}
                <div
                    style={{
                        padding: '20px 24px',

                        borderTop:
                            '1px solid var(--md-sys-color-outline-variant)',

                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',

                        flexShrink: 0,

                        background:
                            'var(--md-sys-color-surface)',
                    }}
                >
                    <button
                        onClick={() => {
                            setScannedBooks([]);
                            setErrors([]);
                        }}
                        disabled={!scannedBooks.length}
                        style={{
                            height: '44px',
                            padding: '0 20px',

                            borderRadius: '16px',

                            border:
                                '1px solid var(--md-sys-color-outline)',

                            background: 'transparent',

                            cursor: 'pointer',
                        }}
                    >
                        Clear All
                    </button>

                    <button
                        onClick={handleBorrowAll}
                        disabled={
                            borrowing || !scannedBooks.length
                        }
                        style={{
                            height: '44px',
                            padding: '0 24px',

                            borderRadius: '16px',

                            border: 'none',

                            background:
                                'var(--md-sys-color-primary)',

                            color:
                                'var(--md-sys-color-on-primary)',

                            cursor: 'pointer',

                            fontWeight: '600',
                        }}
                    >
                        {borrowing
                            ? 'Borrowing...'
                            : `Borrow All (${scannedBooks.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Badge = ({
    label,
    color = 'var(--md-sys-color-on-surface-variant)',
    background = 'var(--md-sys-color-surface-variant)',
}) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: '500',
            background,
            color,
        }}
    >
        {label}
    </span>
);

export default BorrowScannerDialog;