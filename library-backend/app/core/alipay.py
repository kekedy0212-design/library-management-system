from app.core.config import settings


def _format_pem_body(body: str) -> str:
    body = body.replace("\n", "").replace("\r", "").strip()
    return "\n".join(body[i:i + 64] for i in range(0, len(body), 64))


def _normalize_key(raw: str, is_private: bool) -> str:
    key = raw.replace("\\n", "\n").strip()
    if "-----BEGIN" in key and "-----END" in key:
        return key

    header = "-----BEGIN PRIVATE KEY-----" if is_private else "-----BEGIN PUBLIC KEY-----"
    footer = "-----END PRIVATE KEY-----" if is_private else "-----END PUBLIC KEY-----"
    return f"{header}\n{_format_pem_body(key)}\n{footer}"


def get_alipay_client():
    try:
        from alipay import AliPay
    except ImportError as exc:
        raise RuntimeError("python-alipay-sdk is not installed") from exc

    if not settings.ALIPAY_APP_ID:
        raise RuntimeError("ALIPAY_APP_ID is not configured")
    if not settings.ALIPAY_APP_PRIVATE_KEY:
        raise RuntimeError("ALIPAY_APP_PRIVATE_KEY is not configured")
    if not settings.ALIPAY_PUBLIC_KEY:
        raise RuntimeError("ALIPAY_PUBLIC_KEY is not configured")

    return AliPay(
        appid=settings.ALIPAY_APP_ID,
        app_notify_url=settings.ALIPAY_NOTIFY_URL,
        app_private_key_string=_normalize_key(settings.ALIPAY_APP_PRIVATE_KEY, is_private=True),
        alipay_public_key_string=_normalize_key(settings.ALIPAY_PUBLIC_KEY, is_private=False),
        sign_type="RSA2",
        debug=settings.ALIPAY_DEBUG,
    )
