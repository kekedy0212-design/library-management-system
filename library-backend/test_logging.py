"""
日志测试脚本 - 用于验证日志系统是否正常工作

使用方法：
    python test_logging.py              # 使用 INFO 级别（默认）
    LOG_LEVEL=DEBUG python test_logging.py  # 使用 DEBUG 级别
    LOG_DIR=/tmp/logs python test_logging.py  # 自定义日志目录
"""

import os
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

# 导入日志模块
from app.core.logger import setup_logging, get_logger, LOG_FILE, LOG_DIR

def test_logging():
    """测试日志功能"""
    
    # 初始化日志
    setup_logging()
    logger = get_logger(__name__)
    
    print("\n" + "="*60)
    print("[日志系统测试]")
    print("="*60)
    
    # 显示日志配置信息
    print(f"[日志目录] {LOG_DIR}")
    print(f"[日志文件] {LOG_FILE}")
    print(f"[文件存在] {LOG_FILE.exists()}")
    print()
    
    # 测试不同级别的日志
    print("[测试日志输出]：")
    print("-" * 60)
    
    logger.debug("这是一条 DEBUG 级别的日志")
    logger.info("这是一条 INFO 级别的日志")
    logger.warning("这是一条 WARNING 级别的日志")
    logger.error("这是一条 ERROR 级别的日志")
    
    print("-" * 60)
    print()
    
    # 显示日志文件内容
    if LOG_FILE.exists():
        print("[日志文件内容] (最后10行)：")
        print("-" * 60)
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
            # 显示最后10行
            for line in lines[-10:]:
                # 处理编码问题，移除无法编码的字符
                try:
                    print(line.rstrip())
                except UnicodeEncodeError:
                    # 如果无法编码，使用 errors='replace' 替换无效字符
                    print(line.rstrip().encode('gbk', errors='replace').decode('gbk'))
        print("-" * 60)
    else:
        print("[错误] 日志文件不存在！")
    
    print("\n[完成] 测试完毕！如果上面看到日志输出和日志文件内容，说明日志系统正常工作。\n")

if __name__ == "__main__":
    test_logging()
