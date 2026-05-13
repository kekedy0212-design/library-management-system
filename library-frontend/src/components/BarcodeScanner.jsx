import React, {
    useEffect,
    useRef,
    useState,
} from 'react';

import {
    BrowserMultiFormatReader,
} from '@zxing/library';

const BarcodeScanner = ({
    active = false,
    onDetected,
    onError,
}) => {

    const videoRef = useRef(null);

    const scannerRef = useRef(null);

    const streamRef = useRef(null);

    const destroyedRef = useRef(false);

    const lastScanRef = useRef('');

    const lastScanTimeRef = useRef(0);

    const [starting, setStarting] =
        useState(false);

    const [cameraError, setCameraError] =
        useState('');

    // =========================================
    // stop camera safely
    // =========================================

    const stopCamera = async () => {

        try {

            // stop zxing decode
            if (scannerRef.current) {

                scannerRef.current.reset();

                scannerRef.current = null;
            }

            // stop media stream
            if (streamRef.current) {

                streamRef.current
                    .getTracks()
                    .forEach(track => {
                        track.stop();
                    });

                streamRef.current = null;
            }

            // IMPORTANT:
            // fully detach video
            if (videoRef.current) {

                try {

                    videoRef.current.pause();

                } catch (err) {
                    console.warn(err);
                }

                videoRef.current.onloadedmetadata =
                    null;

                videoRef.current.srcObject = null;

                videoRef.current.removeAttribute(
                    'src'
                );

                videoRef.current.pause();

                videoRef.current.srcObject = null;
            }

            // IMPORTANT:
            // wait browser release hardware
            await new Promise(resolve =>
                setTimeout(resolve, 300)
            );

        } catch (err) {

            console.error(err);
        }
    };

    // =========================================
    // release zombie browser sessions
    // =========================================

    const releaseBrowserCameraLocks =
        async () => {

            try {

                const tempStream =
                    await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false,
                    });

                tempStream
                    .getTracks()
                    .forEach(track => {
                        track.stop();
                    });

            } catch (err) {

                console.warn(err);
            }
        };

    // =========================================
    // start scanner
    // =========================================

    const startScanner = async () => {

        try {

            setStarting(true);

            setCameraError('');

            // release old sessions
            await releaseBrowserCameraLocks();

            // create scanner
            const scanner =
                new BrowserMultiFormatReader();

            scannerRef.current = scanner;

            // enumerate devices
            const devices =
                await scanner.listVideoInputDevices();

            if (!devices.length) {

                throw new Error(
                    'No camera found'
                );
            }

            // prefer rear camera
            const backCamera =
                devices.find(device =>
                    /back|rear|environment/i.test(
                        device.label
                    )
                ) || devices[0];

            // create media stream
            const stream =
                await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: {
                            exact:
                                backCamera.deviceId,
                        },
                        facingMode:
                            'environment',
                    },
                    audio: false,
                });

            if (destroyedRef.current) {

                stream
                    .getTracks()
                    .forEach(track => {
                        track.stop();
                    });

                return;
            }

            streamRef.current = stream;

            if (!videoRef.current) {

                stream
                    .getTracks()
                    .forEach(track => {
                        track.stop();
                    });

                return;
            }

            // attach stream
            videoRef.current.srcObject = stream;

            // IMPORTANT:
            // do NOT use autoplay attribute
            await videoRef.current.play();

            // IMPORTANT:
            // wait actual frame ready
            await new Promise(resolve => {

                if (
                    videoRef.current.readyState >= 2
                ) {

                    resolve();

                    return;
                }

                videoRef.current.onloadeddata =
                    () => {
                        resolve();
                    };
            });

            if (
                destroyedRef.current ||
                !videoRef.current
            ) {

                stream
                    .getTracks()
                    .forEach(track => {
                        track.stop();
                    });

                return;
            }

            // IMPORTANT:
            // use decodeFromVideoDevice
            scanner.decodeFromVideoDevice(
                backCamera.deviceId,
                videoRef.current,
                (result, err) => {
                    if (
                        destroyedRef.current
                    ) {
                        return;
                    }

                    // success
                    if (result) {

                        const text =
                            result.getText();

                        const now =
                            Date.now();

                        // anti duplicate
                        if (
                            text ===
                            lastScanRef.current &&
                            now -
                            lastScanTimeRef.current <
                            1500
                        ) {
                            return;
                        }

                        navigator.vibrate?.(80);

                        onDetected?.(text);

                        // update AFTER success
                        lastScanRef.current =
                            text;

                        lastScanTimeRef.current =
                            now;
                    }

                    // ignore common misses
                    if (
                        err &&
                        err.name !==
                        'NotFoundException'
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

    // =========================================
    // lifecycle
    // =========================================

    useEffect(() => {

        destroyedRef.current = false;

        let mounted = true;

        const init = async () => {

            // ALWAYS cleanup first
            await stopCamera();

            if (
                !active ||
                !mounted
            ) {
                return;
            }

            await startScanner();
        };

        init();

        return () => {

            mounted = false;

            destroyedRef.current = true;

            stopCamera();
        };

    }, [active]);

    // =========================================
    // UI
    // =========================================

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

            {cameraError ? (
                <div
                    style={{
                        padding: '24px',

                        textAlign: 'center',

                        background:
                            'var(--md-sys-color-error-container)',

                        color:
                            'var(--md-sys-color-on-error-container)',
                    }}
                >
                    {cameraError}
                </div>
            ) : (
                <video
                    ref={videoRef}
                    muted
                    playsInline

                    style={{
                        width: '100%',
                        minHeight: '320px',

                        objectFit: 'cover',

                        opacity:
                            starting ? 0 : 1,

                        transition:
                            'opacity 0.2s ease',
                    }}
                />
            )}
        </div>
    );
};

export default BarcodeScanner;