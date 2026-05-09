import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

const BarcodeScanner = ({
    active = false,
    onDetected,
    onError,
}) => {
    const videoRef = useRef(null);
    const scannerRef = useRef(null);

    const [cameraError, setCameraError] = useState('');
    const [starting, setStarting] = useState(true);

    const lastScanRef = useRef('');
    const lastScanTimeRef = useRef(0);

    useEffect(() => {
        if (!active) {
            return;
        }

        const scanner = new BrowserMultiFormatReader();

        scannerRef.current = scanner;

        let destroyed = false;

        const startScanner = async () => {
            try {
                setStarting(true);
                setCameraError('');

                // IMPORTANT:
                // New versions use INSTANCE method
                const devices =
                    await scanner.listVideoInputDevices();

                if (!devices.length) {
                    throw new Error('No camera found');
                }

                // Prefer back camera on mobile
                const backCamera =
                    devices.find(device =>
                        /back|rear|environment/gi.test(
                            device.label
                        )
                    ) || devices[0];

                await scanner.decodeFromVideoDevice(
                    backCamera.deviceId,
                    videoRef.current,
                    (result, err) => {
                        if (destroyed) {
                            return;
                        }

                        if (result) {
                            const text = result.getText();

                            const now = Date.now();

                            if (
                                text === lastScanRef.current &&
                                now - lastScanTimeRef.current < 2000
                            ) {
                                return;
                            }

                            lastScanRef.current = text;
                            lastScanTimeRef.current = now;

                            navigator.vibrate?.(80);

                            onDetected?.(text);
                        }

                        // Ignore continuous scan failures
                        if (
                            err &&
                            err.name !== 'NotFoundException'
                        ) {
                            console.error(err);
                        }
                    }
                );

                setStarting(false);
            } catch (err) {
                console.error(err);

                const message =
                    err?.message ||
                    'Failed to access camera';

                setCameraError(message);

                onError?.(message);

                setStarting(false);
            }
        };

        startScanner();

        return () => {
            destroyed = true;

            if (scannerRef.current) {
                scannerRef.current.reset();
            }
        };
    }, [active, onDetected, onError]);

    return (
        <div
            style={{
                width: '100%',
                overflow: 'hidden',
                borderRadius: '24px',
                background:
                    'var(--md-sys-color-surface-container)',
                border:
                    '1px solid var(--md-sys-color-outline-variant)',
            }}
        >
            {starting && (
                <div
                    style={{
                        padding: '16px',
                        textAlign: 'center',
                        color:
                            'var(--md-sys-color-on-surface-variant)',
                    }}
                >
                    Starting camera...
                </div>
            )}

            {cameraError ? (
                <div
                    style={{
                        padding: '24px',
                        textAlign: 'center',
                        color:
                            'var(--md-sys-color-on-error-container)',
                        background:
                            'var(--md-sys-color-error-container)',
                    }}
                >
                    {cameraError}
                </div>
            ) : (
                <video
                    ref={videoRef}
                    muted
                    autoPlay
                    playsInline
                    style={{
                        width: '100%',
                        minHeight: '320px',
                        objectFit: 'cover',
                        display: starting
                            ? 'none'
                            : 'block',
                    }}
                />
            )}
        </div>
    );
};

export default BarcodeScanner;