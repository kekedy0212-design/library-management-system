import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from dotenv import load_dotenv

# 计算项目根目录（app/core/config.py 的上两级目录）
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

# 如果 .env 文件存在，则强制加载（覆盖系统环境变量中的同名变量）
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE, override=True)
    print(f"✅ 已加载配置文件: {ENV_FILE}")  # 启动时会显示，确认加载成功
else:
    print(f"⚠️ 警告：未找到 .env 文件于 {ENV_FILE}，将使用系统环境变量")

class Settings(BaseSettings):
    # 为这些字段提供默认值 None，或者直接赋值，防止初始化时报错
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./library.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
    DEPOSIT_AMOUNT: float = float(os.getenv("DEPOSIT_AMOUNT", 99.00))

    # Alipay sandbox / production shared settings
    ALIPAY_APP_ID: str = os.getenv("ALIPAY_APP_ID", "")
    ALIPAY_GATEWAY: str = os.getenv("ALIPAY_GATEWAY", "https://openapi-sandbox.dl.alipaydev.com/gateway.do")
    ALIPAY_NOTIFY_URL: str = os.getenv("ALIPAY_NOTIFY_URL", "")
    ALIPAY_RETURN_URL: str = os.getenv("ALIPAY_RETURN_URL", "")
    ALIPAY_APP_PRIVATE_KEY: str = os.getenv("ALIPAY_APP_PRIVATE_KEY", "")
    ALIPAY_PUBLIC_KEY: str = os.getenv("ALIPAY_PUBLIC_KEY", "")
    ALIPAY_DEBUG: bool = os.getenv("ALIPAY_DEBUG", "true").lower() == "true"

    model_config = ConfigDict(
        extra="ignore",
        case_sensitive=False
    )

settings = Settings()

# 最后的防线：如果 SECRET_KEY 依然为空，抛出一个有意义的错误提示
if not settings.SECRET_KEY:
    print("❌ 错误：SECRET_KEY 未设置！请检查 .env 文件内容。")