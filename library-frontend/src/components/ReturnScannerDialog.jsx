import React, {
    useEffect,
    useRef,
    useState,
} from 'react';
import BarcodeScanner from './BarcodeScanner';
import MdCard from './MdCard';
import { borrowService } from '../services/borrowService';
import {
    useSnackbar
} from './feedback/SnackbarProvider';

const parseBarcode = (text) => {

    if (!text) {
        return null;
    }

    const cleaned =
        String(text).trim();

    // 忽略纯数字中间态
    if (/^\d+$/.test(cleaned)) {
        return null;
    }

    const parts = cleaned.split('/');

    if (parts.length !== 2) {
        return null;
    }

    const isbn =
        parts[0]?.trim();

    const copyText =
        parts[1]?.trim();

    if (!isbn) {
        return null;
    }

    if (!/^\d+$/.test(copyText)) {
        return null;
    }

    return {
        raw: cleaned,
        isbn,
        copyId: Number(copyText),
    };
};

const ReturnScannerDialog = ({
    open,
    onClose,
    borrowHistory = [],
    onSuccess,
}) => {
    const { showSnackbar } = useSnackbar();

    const [scannedRecords, setScannedRecords] =
        useState([]);

    // const [errors, setErrors] =
    //     useState([]);

    const [processing, setProcessing] =
        useState(false);

    // =========================
    // Scanner cooldown
    // =========================

    const scanningLockRef =
        useRef(false);

    // =========================
    // Realtime dedupe
    // key = isbn_copyId
    // =========================

    const scannedMapRef =
        useRef(new Map());

    // =========================
    // Prevent repeated error spam
    // =========================

    const lastErrorRef =
        useRef({
            message: '',
            time: 0,
        });

    // =========================
    // Helpers
    // =========================

    const normalizeIsbn = (isbn) =>
        String(isbn || '')
            .replace(/[-\s]/g, '')
            .trim();

    const normalizeCopyId = (copyId) =>
        String(copyId || '')
            .trim();

    const buildKey = (
        isbn,
        copyId
    ) => {

        return `${normalizeIsbn(isbn)}_${normalizeCopyId(copyId)}`;
    };

    // =========================
    // Snackbar-safe error
    // =========================

    const pushError = (message) => {

        const now = Date.now();

        // prevent repeated spam
        if (
            lastErrorRef.current.message === message &&
            now - lastErrorRef.current.time < 2000
        ) {
            return;
        }

        lastErrorRef.current = {
            message,
            time: now,
        };

        // setErrors(prev => {

        //     if (prev[0] === message) {
        //         return prev;
        //     }

        //     return [
        //         message,
        //         ...prev,
        //     ];
        // });

        showSnackbar(
            message,
            'error'
        );
    };

    // =========================
    // Remove single record
    // =========================

    const handleRemoveRecord = (
        item
    ) => {

        const key = buildKey(
            item.isbn,
            item.copyId
        );

        scannedMapRef.current.delete(
            key
        );

        setScannedRecords(prev =>
            prev.filter(record => {

                const recordKey =
                    buildKey(
                        record.isbn,
                        record.copyId
                    );

                return (
                    recordKey !== key
                );
            })
        );

        showSnackbar(
            'Book removed from return list.',
            'info'
        );
    };

    // =========================
    // Clear all
    // =========================

    const handleClearAll = () => {

        scannedMapRef.current.clear();

        setScannedRecords([]);

        showSnackbar(
            'Return list cleared.',
            'info'
        );
    };

    // =========================
    // Close dialog
    // =========================

    const handleCloseDialog = () => {

        scannedMapRef.current.clear();

        setScannedRecords([]);

        //setErrors([]);

        onClose?.();
    };

    // =========================
    // Scanner handler
    // =========================

    const handleDetected = async (
        rawText
    ) => {

        // prevent scanner storm
        if (
            scanningLockRef.current
        ) {
            return;
        }

        scanningLockRef.current =
            true;

        try {

            const parsed =
                parseBarcode(rawText);

            // ignore invalid intermediate scan
            if (!parsed) {
                return;
            }

            const key = buildKey(
                parsed.isbn,
                parsed.copyId
            );

            const currentIsbn =
                normalizeIsbn(parsed.isbn);

            const currentCopyId =
                normalizeCopyId(parsed.copyId);

            // =========================
            // Realtime duplicate detection
            // =========================

            if (
                scannedMapRef.current.has(
                    key
                )
            ) {

                showSnackbar(
                    'This book has already been scanned.',
                    'warning'
                );

                return;
            }

            // =========================
            // Find borrow record
            // =========================

            const matchedRecord =
                borrowHistory.find(record => {

                    if (
                        record.status !==
                        'approved'
                    ) {
                        return false;
                    }

                    if (!record.book) {
                        return false;
                    }

                    const recordIsbn =
                        normalizeIsbn(
                            record.book.isbn
                        );

                    if (
                        recordIsbn !==
                        currentIsbn
                    ) {
                        return false;
                    }

                    // Copy-level validation:
                    // 扫码出来的 `currentCopyId` 是“书内副本号 (barcode_number)”，
                    // 后端 record.copy_id 是 BookCopy.id（全局主键），两者维度不同。
                    // 用 record.copy.barcode_number 才是正确的比对维度。
                    const recordBarcodeNumber =
                        record.copy?.barcode_number;

                    if (
                        currentCopyId &&
                        recordBarcodeNumber != null
                    ) {

                        return (
                            normalizeCopyId(
                                recordBarcodeNumber
                            ) ===
                            currentCopyId
                        );
                    }

                    return true;
                });

            // =========================
            // No record found
            // =========================

            if (!matchedRecord) {
                // Try to figure out *why* nothing matched, so the message is actionable
                const sameIsbnRecords = borrowHistory.filter(record => {
                    if (!record.book) return false;
                    return normalizeIsbn(record.book.isbn) === currentIsbn;
                });

                let reason;
                if (sameIsbnRecords.length === 0) {
                    reason = `You have no record for this book (ISBN ${parsed.isbn}). It is not borrowed by your account.`;
                } else {
                    const statuses = Array.from(
                        new Set(sameIsbnRecords.map(r => r.status))
                    );
                    if (statuses.includes('return_pending')) {
                        reason = `This book is no longer on loan (return in progress or completed).`;
                    } else if (statuses.includes('returned')) {
                        reason = `You already returned this book (ISBN ${parsed.isbn}).`;
                    } else if (statuses.every(s => s === 'pending' || s === 'rejected')) {
                        reason = `Your previous borrow request for this book was not approved, so it is not on loan to you.`;
                    } else if (currentCopyId) {
                        reason = `You have borrowed this title, but not the specific copy #${currentCopyId}. Scan the copy you actually borrowed.`;
                    } else {
                        reason = `No active loan found for ISBN ${parsed.isbn}.`;
                    }
                }

                pushError(reason);

                return;
            }

            // =========================
            // Realtime cache
            // IMPORTANT
            // =========================

            scannedMapRef.current.set(
                key,
                true
            );

            navigator.vibrate?.(80);

            // =========================
            // Update UI
            // =========================

            setScannedRecords(prev => [

                ...prev,

                {
                    ...parsed,
                    record: matchedRecord,
                }
            ]);

            showSnackbar(
                `"${matchedRecord.book?.title}" added to return list.`,
                'success'
            );

        } catch (err) {

            console.error(err);

            const message =
                err?.response?.data?.detail ||
                err?.message ||
                'Scan failed';

            pushError(message);

        } finally {

            setTimeout(() => {

                scanningLockRef.current =
                    false;

            }, 1000);
        }
    };

    // =========================
    // Submit all returns
    // =========================

    const handleReturnAll =
        async () => {

            if (
                !scannedRecords.length
            ) {

                showSnackbar(
                    'No books available for return.',
                    'warning'
                );

                return;
            }

            if (
                !window.confirm(
                    `Return ${scannedRecords.length} book(s) now?`
                )
            ) {
                return;
            }

            setProcessing(true);

            const successIds = [];

            const failedMessages = [];

            let overdueFineCount = 0;

            for (const item of scannedRecords) {

                try {

                    const response = await borrowService
                        .returnRequest(
                            item.record.id,
                            {
                                barcode:
                                    item.raw,

                                barcode_number:
                                    parseInt(
                                        item.copyId,
                                        10
                                    ),

                                isbn:
                                    item.isbn,
                            }
                        );

                    if (response.data?.overdue_fine_created) {
                        overdueFineCount += 1;
                    }

                    successIds.push(
                        item.record.id
                    );

                } catch (err) {

                    const message =
                        err?.response?.data?.detail ||
                        err?.message ||
                        'Return failed';

                    failedMessages.push(
                        `${item.record.book?.title}: ${message}`
                    );

                    pushError(
                        `${item.record.book?.title}: ${message}`
                    );
                }
            }

            // =========================
            // Remove successful records
            // =========================

            if (
                successIds.length > 0
            ) {

                setScannedRecords(prev =>
                    prev.filter(item => {

                        const shouldKeep =
                            !successIds.includes(
                                item.record.id
                            );

                        // sync ref
                        if (!shouldKeep) {

                            const key =
                                buildKey(
                                    item.isbn,
                                    item.copyId
                                );

                            scannedMapRef.current.delete(
                                key
                            );
                        }

                        return shouldKeep;
                    })
                );

                onSuccess?.();
            }

            // =========================
            // Final summary
            // =========================

            if (
                failedMessages.length === 0
            ) {

                if (overdueFineCount > 0) {
                    showSnackbar(
                        `Return complete. ${overdueFineCount} overdue fine(s) created (10 CNY each). Pay on the Fines page before borrowing again.`,
                        'warning'
                    );
                } else {
                    showSnackbar(
                        'All books returned successfully.',
                        'success'
                    );
                }

            } else if (
                successIds.length === 0
            ) {

                showSnackbar(
                    'All returns failed.',
                    'error'
                );

            } else {

                const fineHint =
                    overdueFineCount > 0
                        ? ` ${overdueFineCount} return(s) created overdue fines.`
                        : '';
                showSnackbar(
                    `${successIds.length} succeeded, ${failedMessages.length} failed.${fineHint}`,
                    'warning'
                );
            }

            setProcessing(false);
        };

    // =========================
    // Clear errors
    // =========================

    const clearErrors = () => {

        //setErrors([]);

    };

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
                    maxWidth: '1100px',
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
                                Scan & Return
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
                                Scan multiple borrowed books and return them together.
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            style={closeButtonStyle}
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Content */}
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
                    {/* LEFT */}
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
                                active={open}
                                onDetected={handleDetected}
                                onError={(msg) => {
                                    // setErrors(prev => [
                                    //     msg,
                                    //     ...prev,
                                    // ]);
                                }}
                            />
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div
                        style={{
                            flex: 1,

                            display: 'flex',
                            flexDirection: 'column',

                            minHeight: 0,
                        }}
                    >
                        {/* List Header */}
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
                                Pending Return List
                            </h3>

                            <span
                                style={{
                                    fontSize: '0.9rem',

                                    color:
                                        'var(--md-sys-color-on-surface-variant)',
                                }}
                            >
                                {scannedRecords.length} item
                                {scannedRecords.length !== 1
                                    ? 's'
                                    : ''}
                            </span>
                        </div>

                        {/* List */}
                        <div
                            style={{
                                flex: 1,

                                overflowY: 'auto',

                                paddingRight: '4px',

                                minHeight: 0,
                            }}
                        >
                            {scannedRecords.length === 0 && (
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

                            {scannedRecords.map((item, index) => (
                                <MdCard
                                    key={item.raw}
                                    variant="outlined"
                                    style={{
                                        marginBottom: '12px',
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: '16px',

                                            display: 'flex',
                                            justifyContent:
                                                'space-between',

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
                                                {
                                                    item.record.book?.title
                                                }
                                            </div>

                                            <div
                                                style={{
                                                    fontSize: '0.92rem',

                                                    color:
                                                        'var(--md-sys-color-on-surface-variant)',
                                                }}
                                            >
                                                {
                                                    item.record.book?.author
                                                }
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

                                                <Badge
                                                    label={`Due: ${formatDate(
                                                        item.record.due_date
                                                    )}`}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                handleRemoveRecord(item);
                                            }}
                                            style={removeButtonStyle}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </MdCard>
                            ))}
                        </div>

                        {/* Errors */}
                        {/*errors.length > 0 && (
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
                                        justifyContent:
                                            'space-between',

                                        marginBottom: '10px',
                                    }}
                                >
                                    <strong>Errors</strong>

                                    <button
                                        onClick={clearErrors}
                                        style={{
                                            border: 'none',
                                            background:
                                                'transparent',

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
                        )*/}
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '20px 24px',

                        borderTop:
                            '1px solid var(--md-sys-color-outline-variant)',

                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',

                        flexShrink: 0,
                    }}
                >
                    <button
                        onClick={() => {
                            handleClearAll();
                        }}
                        disabled={!scannedRecords.length}
                        style={footerButtonStyle}
                    >
                        Clear All
                    </button>

                    <button
                        onClick={handleReturnAll}
                        disabled={
                            processing ||
                            !scannedRecords.length
                        }
                        style={primaryFooterButtonStyle}
                    >
                        {processing
                            ? 'Processing...'
                            : `Return All (${scannedRecords.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Badge = ({ label }) => (
    <span
        style={{
            padding: '4px 10px',

            borderRadius: '8px',

            fontSize: '0.75rem',
            fontWeight: '500',

            background:
                'var(--md-sys-color-surface-variant)',

            color:
                'var(--md-sys-color-on-surface-variant)',
        }}
    >
        {label}
    </span>
);

const closeButtonStyle = {
    height: '40px',
    padding: '0 18px',

    borderRadius: '14px',

    border: 'none',

    cursor: 'pointer',

    background:
        'var(--md-sys-color-surface-container)',

    color:
        'var(--md-sys-color-on-surface)',
};

const removeButtonStyle = {
    border: 'none',

    background: 'transparent',

    color:
        'var(--md-sys-color-error)',

    cursor: 'pointer',

    fontWeight: '600',

    flexShrink: 0,
};

const footerButtonStyle = {
    height: '44px',
    padding: '0 20px',

    borderRadius: '16px',

    border:
        '1px solid var(--md-sys-color-outline)',

    background: 'transparent',

    cursor: 'pointer',

    fontWeight: '500',
};

const primaryFooterButtonStyle = {
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
};

const formatDate = (dateString) => {
    if (!dateString) {
        return '-';
    }

    return new Date(dateString)
        .toLocaleDateString();
};

export default ReturnScannerDialog;