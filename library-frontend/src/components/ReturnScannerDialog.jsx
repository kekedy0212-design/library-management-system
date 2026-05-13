import React, {
    useEffect,
    useRef,
    useState,
} from 'react';
import BarcodeScanner from './BarcodeScanner';
import MdCard from './MdCard';
import { borrowService } from '../services/borrowService';

const parseBarcode = (text) => {
    if (!text) {
        throw new Error('Empty barcode');
    }

    const parts = text.split('/');

    if (parts.length !== 2) {
        throw new Error(
            `Invalid barcode format. Expected ISBN/COPY_ID but got "${text}"`
        );
    }

    const isbn = parts[0]?.trim();

    const copyText = parts[1]?.trim();

    if (!isbn) {
        throw new Error(`ISBN missing in "${text}"`);
    }

    if (!/^\d+$/.test(copyText)) {
        throw new Error(
            `Copy ID must be a positive integer (got "${copyText}")`
        );
    }

    return {
        raw: text,

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
    const [scannedRecords, setScannedRecords] = useState([]);
    const [errors, setErrors] = useState([]);
    const [processing, setProcessing] = useState(false);

    const scanningLockRef = useRef(false);

    if (!open) {
        return null;
    }

    const handleDetected = async (rawText) => {

        // =========================
        // Prevent scanner storm
        // =========================

        if (scanningLockRef.current) {
            return;
        }

        scanningLockRef.current = true;

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

        try {

            // =========================
            // Parse barcode
            // =========================

            const parsed =
                parseBarcode(rawText);

            const currentIsbn =
                normalizeIsbn(parsed.isbn);

            const currentCopyId =
                normalizeCopyId(
                    parsed.copyId
                );

            // =========================
            // Prevent duplicate scans
            // =========================

            const isDuplicate =
                scannedRecords.some(item => {

                    const existingIsbn =
                        normalizeIsbn(
                            item.isbn ||
                            item.record?.book?.isbn
                        );

                    const existingCopyId =
                        normalizeCopyId(
                            item.copyId ||
                            item.record?.copy_id
                        );

                    // same isbn + same copy
                    if (
                        existingIsbn ===
                        currentIsbn
                    ) {

                        // if either side has no copyId
                        // treat as duplicate
                        if (
                            !existingCopyId ||
                            !currentCopyId
                        ) {
                            return true;
                        }

                        return (
                            existingCopyId ===
                            currentCopyId
                        );
                    }

                    return false;
                });

            if (isDuplicate) {

                console.warn(
                    'Duplicate book/copy detected'
                );

                return;
            }

            // =========================
            // Find active borrow record
            // =========================

            const matchedRecord =
                borrowHistory.find(record => {

                    // approved only
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

                    // copy-level validation
                    if (
                        currentCopyId &&
                        record.copy_id
                    ) {

                        return (
                            normalizeCopyId(
                                record.copy_id
                            ) ===
                            currentCopyId
                        );
                    }

                    return true;
                });

            // =========================
            // No matching borrow record
            // =========================

            if (!matchedRecord) {

                throw new Error(
                    `No active borrowing record found for ISBN ${parsed.isbn}`
                );
            }

            navigator.vibrate?.(80);

            // =========================
            // Functional state update
            // =========================

            setScannedRecords(prev => {

                const nextList = [
                    ...prev,
                    {
                        ...parsed,
                        record: matchedRecord,
                    }
                ];

                // =========================
                // Deduplicate
                // =========================

                const map = new Map();

                return nextList.filter(item => {

                    const isbn =
                        normalizeIsbn(
                            item.isbn ||
                            item.record?.book?.isbn
                        );

                    const copyId =
                        normalizeCopyId(
                            item.copyId ||
                            item.record?.copy_id
                        );

                    const key =
                        `${isbn}_${copyId}`;

                    if (map.has(key)) {
                        return false;
                    }

                    map.set(key, true);

                    return true;
                });
            });

        } catch (err) {

            console.error(err);

            const message =
                err?.response?.data?.detail ||
                err?.message ||
                'Scan failed';

            // prevent duplicate error spam
            setErrors(prev => {

                if (prev[0] === message) {
                    return prev;
                }

                return [
                    message,
                    ...prev,
                ];
            });

        } finally {

            // =========================
            // Cooldown
            // =========================

            setTimeout(() => {

                scanningLockRef.current =
                    false;

            }, 1200);
        }
    };

    const handleReturnAll = async () => {
        if (!scannedRecords.length) {
            return;
        }

        if (
            !window.confirm(
                `Submit return request for ${scannedRecords.length} book(s)?`
            )
        ) {
            return;
        }

        setProcessing(true);

        const successIds = [];
        const failedMessages = [];

        for (const item of scannedRecords) {
            try {
                await borrowService.returnRequest(
                    item.record.id,
                    {
                        barcode: item.raw,
                        barcode_number: parseInt(item.copyId, 10),
                        isbn: item.isbn,
                    }
                );

                successIds.push(item.record.id);

            } catch (err) {
                failedMessages.push(
                    `${item.record.book?.title}: ${err.response?.data?.detail ||
                    err.message ||
                    'Return failed'
                    }`
                );
            }
        }

        if (successIds.length > 0) {
            setScannedRecords(prev =>
                prev.filter(
                    item =>
                        !successIds.includes(item.record.id)
                )
            );

            alert(
                `${successIds.length} return request(s) submitted successfully.`
            );

            onSuccess?.();
        }

        if (failedMessages.length > 0) {
            setErrors(prev => [
                ...failedMessages,
                ...prev,
            ]);
        }

        setProcessing(false);
    };

    const clearErrors = () => {
        setErrors([]);
    };

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
                                Scan multiple borrowed books and submit return requests together.
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
                                    setErrors(prev => [
                                        msg,
                                        ...prev,
                                    ]);
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
                                                setScannedRecords(
                                                    prev =>
                                                        prev.filter(
                                                            (_, i) =>
                                                                i !== index
                                                        )
                                                );
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
                        )}
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
                            setScannedRecords([]);
                            setErrors([]);
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