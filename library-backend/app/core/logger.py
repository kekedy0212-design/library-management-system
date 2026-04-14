import logging
import sys
import os
from pathlib import Path
from logging.handlers import RotatingFileHandler

# 方式1：从环境变量获取日志目录（优先级最高，便于测试时灵活指定）
if "LOG_DIR" in os.environ:
    LOG_DIR = Path(os.environ["LOG_DIR"])
else:
    # 方式2：相对于这个文件的位置
    LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"

# 确保日志目录存在
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "app.log"

# 日志格式化器 - 增强版，包含更多信息
DETAILED_FORMAT = "%(asctime)s [%(levelname)-8s] %(name)s:%(funcName)s:%(lineno)d - %(message)s"
SIMPLE_FORMAT = "%(asctime)s [%(levelname)s] %(name)s - %(message)s"

LOG_FORMATTER_DETAILED = logging.Formatter(
    fmt=DETAILED_FORMAT,
    datefmt="%Y-%m-%d %H:%M:%S"
)

LOG_FORMATTER_SIMPLE = logging.Formatter(
    fmt=SIMPLE_FORMAT,
    datefmt="%Y-%m-%d %H:%M:%S"
)

# 为了向后兼容性，保留原有的 LOG_FORMATTER
LOG_FORMATTER = LOG_FORMATTER_SIMPLE

# 日志分隔符
LOG_SEPARATOR = "=" * 60

_logger_initialized = False

def setup_logging(log_level=logging.INFO, use_detailed_format=False):
    """
    初始化日志系统。支持调用多次（幂等操作）。
    
    参数:
        log_level: 日志级别，默认为 logging.INFO
        use_detailed_format: 是否使用详细格式（包含函数名和行号），默认 False
    """
    global _logger_initialized
    
    if _logger_initialized:
        return logging.getLogger()
    
    root_logger = logging.getLogger()
    
    # 清除已存在的处理程序，防止重复
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # 选择日志格式
    formatter = LOG_FORMATTER_DETAILED if use_detailed_format else LOG_FORMATTER_SIMPLE
    
    # 控制台处理程序
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    
    # 文件处理程序 - 使用详细格式以获得更多信息
    try:
        file_handler = RotatingFileHandler(
            LOG_FILE, 
            maxBytes=10_000_000,  # 10MB
            backupCount=5, 
            encoding="utf-8"
        )
        file_handler.setFormatter(LOG_FORMATTER_DETAILED)
        file_handler.setLevel(log_level)
    except Exception as e:
        print(f"❌ 日志文件处理程序初始化失败: {e}", file=sys.stderr)
        file_handler = None
    
    # 设置根日志器
    root_logger.setLevel(log_level)
    root_logger.addHandler(console_handler)
    if file_handler:
        root_logger.addHandler(file_handler)
    
    _logger_initialized = True
    
    # 打印初始化成功信息
    logger = logging.getLogger(__name__)
    logger.info("=" * 60)
    logger.info(f"🚀 日志系统已启动 | 日志级别: {logging.getLevelName(log_level)}")
    logger.info(f"📁 日志文件位置: {LOG_FILE}")
    logger.info("=" * 60)
    
    return root_logger

def get_logger(name):
    """获取指定名称的日志器（建议在各模块中使用）"""
    return logging.getLogger(name)

def log_separator(message: str = "", char: str = None):
    """
    打印日志分隔符，便于在日志中区分不同的操作段。
    
    参数:
        message: 分隔符中间的文本（可选）
        char: 分隔符字符（默认为60个=号）
    """
    if char is None:
        char = LOG_SEPARATOR
    logger = logging.getLogger(__name__)
    if message:
        logger.info(char)
        logger.info(f"  {message}")
        logger.info(char)
    else:
        logger.info(char)

def get_logger(name):
    """获取指定名称的日志器（建议在各模块中使用）"""
    return logging.getLogger(name)