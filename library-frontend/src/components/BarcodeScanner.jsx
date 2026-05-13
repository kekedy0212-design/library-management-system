import React, {
    useEffect,
    useRef,
    useState,
} from 'react';

import {
    BrowserMultiFormatReader,
    DecodeHintType,
    BarcodeFormat,
    MultiFormatReader,
    RGBLuminanceSource,
    BinaryBitmap,
    HybridBinarizer,
    GlobalHistogramBinarizer,
    NotFoundException,
} from '@zxing/library';

// 摄像头扫码时只识别我们自己生成的码，避免把书上的 EAN-13/UPC 误识别为非法内容
const scannerHints = new Map();
scannerHints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.QR_CODE,
]);
scannerHints.set(DecodeHintType.TRY_HARDER, true);

// 图片解码 hints 组合：从最严格到最宽松依次尝试
const buildHints = ({ pure, restrict }) => {
    const h = new Map();
    if (restrict) {
        h.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,
            BarcodeFormat.QR_CODE,
        ]);
    }
    h.set(DecodeHintType.TRY_HARDER, true);
    if (pure) {
        h.set(DecodeHintType.PURE_BARCODE, true);
    }
    return h;
};

const HINT_VARIANTS = [
    buildHints({ pure: false, restrict: true }),
    buildHints({ pure: true, restrict: true }),
    buildHints({ pure: false, restrict: false }),
    buildHints({ pure: true, restrict: false }),
];

const loadImage = (url) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = url;
    });

// 把图片画到 canvas：白底 + 旋转 + 缩放，并允许关闭平滑以保留条码锐利边缘
const drawToCanvas = (
    img,
    rotation = 0,
    targetWidth = 1600,
    invert = false,
    smooth = false
) => {
    const baseW = img.naturalWidth || img.width;
    const baseH = img.naturalHeight || img.height;
    const scale = targetWidth / baseW;
    const w = Math.max(1, Math.round(baseW * scale));
    const h = Math.max(1, Math.round(baseH * scale));

    const swap = rotation === 90 || rotation === 270;
    const canvas = document.createElement('canvas');
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    const ctx = canvas.getContext('2d');

    // 关键：放大小图时禁用平滑，保留 1D 条码的硬边
    ctx.imageSmoothingEnabled = smooth;
    if ('mozImageSmoothingEnabled' in ctx) ctx.mozImageSmoothingEnabled = smooth;
    if ('webkitImageSmoothingEnabled' in ctx) ctx.webkitImageSmoothingEnabled = smooth;
    if ('msImageSmoothingEnabled' in ctx) ctx.msImageSmoothingEnabled = smooth;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    if (invert) {
        const imageData = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }
        ctx.putImageData(imageData, 0, 0);
    }
    return canvas;
};

const canvasToLuminanceSource = (canvas) => {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const luminances = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        luminances[j] =
            (data[i] * 299 +
                data[i + 1] * 587 +
                data[i + 2] * 114 +
                500) /
            1000;
    }
    return new RGBLuminanceSource(luminances, width, height);
};

const decodeWithReader = (canvas, hints, binarizerClass) => {
    try {
        const source = canvasToLuminanceSource(canvas);
        const bitmap = new BinaryBitmap(
            new binarizerClass(source)
        );
        const reader = new MultiFormatReader();
        reader.setHints(hints);
        return reader.decode(bitmap);
    } catch (e) {
        if (
            !(e instanceof NotFoundException) &&
            e?.name !== 'NotFoundException'
        ) {
            // 真错而非"没找到"，打印出来便于排查
            console.warn(
                '[BarcodeScanner] decode error:',
                e
            );
        }
        return null;
    }
};

const yieldToUi = () =>
    new Promise((resolve) => setTimeout(resolve, 0));

const tryAllStrategies = async (img) => {
    const baseW = img.naturalWidth || img.width || 600;
    const angles = [0, 90, 180, 270];

    // 第 1 轮（最快）：升采样 + nearest-neighbor，HybridBinarizer，两套常用 hints
    const scales = [
        Math.max(1600, baseW),
        Math.max(2400, baseW),
    ];
    const fastHints = [HINT_VARIANTS[0], HINT_VARIANTS[2]];

    for (const targetW of scales) {
        for (const angle of angles) {
            const canvas = drawToCanvas(
                img,
                angle,
                targetW,
                false,
                false
            );
            for (const hints of fastHints) {
                const r = decodeWithReader(
                    canvas,
                    hints,
                    HybridBinarizer
                );
                if (r) return r;
            }
            await yieldToUi();
        }
    }

    // 第 2 轮（中等）：加 GlobalHistogramBinarizer 与 PURE_BARCODE
    const midHints = [HINT_VARIANTS[1], HINT_VARIANTS[3]];
    for (const targetW of scales) {
        for (const angle of angles) {
            const canvas = drawToCanvas(
                img,
                angle,
                targetW,
                false,
                false
            );
            for (const hints of midHints) {
                let r = decodeWithReader(
                    canvas,
                    hints,
                    HybridBinarizer
                );
                if (r) return r;
                r = decodeWithReader(
                    canvas,
                    hints,
                    GlobalHistogramBinarizer
                );
                if (r) return r;
            }
            await yieldToUi();
        }
    }

    // 第 3 轮（兜底）：反色 + smooth，仅 0/180 两角度，避免过慢
    for (const targetW of scales) {
        for (const angle of [0, 180]) {
            const canvas = drawToCanvas(
                img,
                angle,
                targetW,
                true,
                true
            );
            for (const hints of HINT_VARIANTS) {
                const r = decodeWithReader(
                    canvas,
                    hints,
                    HybridBinarizer
                );
                if (r) return r;
            }
            await yieldToUi();
        }
    }

    return null;
};

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

    const fileInputRef = useRef(null);

    const [starting, setStarting] =
        useState(false);

    const [cameraError, setCameraError] =
        useState('');

    const [decodingFile, setDecodingFile] =
        useState(false);

    const [uploadError, setUploadError] =
        useState('');

    const [uploadInfo, setUploadInfo] =
        useState('');

    const [manualInput, setManualInput] =
        useState('');

    // =========================================
    // decode uploaded image
    // =========================================

    const handlePickFile = () => {
        if (decodingFile) {
            return;
        }
        setUploadError('');
        setUploadInfo('');
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (event.target) {
            // reset so same file can be picked again
            event.target.value = '';
        }
        if (!file) {
            return;
        }
        if (!file.type.startsWith('image/')) {
            setUploadError('Please pick an image file.');
            return;
        }

        setDecodingFile(true);
        setUploadError('');
        setUploadInfo('Decoding image...');

        const url = URL.createObjectURL(file);

        try {
            const img = await loadImage(url);
            const result = await tryAllStrategies(img);

            if (!result) {
                throw new Error('No barcode found');
            }

            const text = result.getText();
            navigator.vibrate?.(80);
            setUploadInfo(`Decoded: ${text}`);
            onDetected?.(text);
        } catch (err) {
            console.error(err);
            setUploadInfo('');
            setUploadError(
                'Could not read a barcode from this image. ' +
                'Try a clearer or higher-resolution image, and make sure ' +
                'the barcode has white margins around it.'
            );
            onError?.('Image decode failed');
        } finally {
            URL.revokeObjectURL(url);
            setDecodingFile(false);
        }
    };

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

            // create scanner (限制为 CODE_128 + QR_CODE)
            const scanner =
                new BrowserMultiFormatReader(
                    scannerHints
                );

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

            {/* Upload image to decode */}
            <div
                style={{
                    padding: '12px 16px',
                    borderTop:
                        '1px solid var(--md-sys-color-outline-variant)',
                    background:
                        'var(--md-sys-color-surface-container-low)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                    }}
                >
                    <button
                        type="button"
                        onClick={handlePickFile}
                        disabled={decodingFile}
                        style={{
                            height: '36px',
                            padding: '0 16px',
                            borderRadius: '12px',
                            border:
                                '1px solid var(--md-sys-color-outline)',
                            background: 'transparent',
                            cursor: decodingFile
                                ? 'not-allowed'
                                : 'pointer',
                            fontWeight: 500,
                            color:
                                'var(--md-sys-color-primary)',
                        }}
                    >
                        {decodingFile
                            ? 'Decoding...'
                            : 'Upload Image'}
                    </button>
                    <span
                        style={{
                            fontSize: '0.8rem',
                            color:
                                'var(--md-sys-color-on-surface-variant)',
                        }}
                    >
                        Upload a barcode image (PNG/JPG) instead of scanning.
                    </span>
                </div>

                {uploadInfo && (
                    <div
                        style={{
                            fontSize: '0.82rem',
                            color:
                                'var(--md-sys-color-on-surface-variant)',
                        }}
                    >
                        {uploadInfo}
                    </div>
                )}

                {uploadError && (
                    <div
                        style={{
                            fontSize: '0.82rem',
                            color:
                                'var(--md-sys-color-error)',
                        }}
                    >
                        {uploadError}
                    </div>
                )}

                {/* Manual input fallback */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                    }}
                >
                    <input
                        type="text"
                        value={manualInput}
                        onChange={(e) =>
                            setManualInput(e.target.value)
                        }
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const v =
                                    manualInput.trim();
                                if (v) {
                                    onDetected?.(v);
                                    setManualInput('');
                                }
                            }
                        }}
                        placeholder="Or type code (e.g. 9787111558422/1)"
                        style={{
                            flex: 1,
                            minWidth: '200px',
                            height: '36px',
                            padding: '0 12px',
                            borderRadius: '12px',
                            border:
                                '1px solid var(--md-sys-color-outline)',
                            background:
                                'var(--md-sys-color-surface)',
                            color:
                                'var(--md-sys-color-on-surface)',
                            fontSize: '0.9rem',
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            const v = manualInput.trim();
                            if (v) {
                                onDetected?.(v);
                                setManualInput('');
                            }
                        }}
                        style={{
                            height: '36px',
                            padding: '0 14px',
                            borderRadius: '12px',
                            border:
                                '1px solid var(--md-sys-color-outline)',
                            background: 'transparent',
                            cursor: 'pointer',
                            fontWeight: 500,
                            color:
                                'var(--md-sys-color-primary)',
                        }}
                    >
                        Submit
                    </button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
            </div>
        </div>
    );
};

export default BarcodeScanner;