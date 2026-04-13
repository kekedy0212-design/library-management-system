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
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    model_config = ConfigDict(
        # 不再依赖 pydantic-settings 自动加载 .env，我们已经手动加载
        extra="ignore",
        case_sensitive=False
    )

settings = Settings()