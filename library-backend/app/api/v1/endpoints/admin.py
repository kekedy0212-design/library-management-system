from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.deps import get_current_admin
from app.models.user import User
from app.core.logger import LOG_FILE, get_logger
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/logs")
def read_logs(
    lines: int = Query(100, ge=1, le=1000, description="Number of recent log lines"),
    current_user: User = Depends(get_current_admin)
):
    """系统管理员查看最近的日志（默认最近100行）"""
    logger.info(f"📋 [日志查看] 管理员 '{current_user.username}' 查询日志 | 行数: {lines}")
    
    if not LOG_FILE.exists():
        logger.warning(f"⚠️ [日志查看] 日志文件不存在 | 路径: {LOG_FILE}")
        return {"msg": "No log file found", "logs": []}
    
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            recent = all_lines[-lines:] if len(all_lines) > lines else all_lines

        logger.info(f"✅ [日志查看成功] 管理员 '{current_user.username}' 成功获取日志 | 请求行数: {lines} | 实际返回: {len(recent)} | 日志文件总行数: {len(all_lines)}")

        # 返回带换行符的字符串，前端直接渲染
        return {
            "log_file": str(LOG_FILE),
            "total_lines": len(all_lines),
            "returned_lines": len(recent),
            "logs": ''.join(recent)
        }
    except Exception as e:
        logger.error(f"❌ [日志查看失败] 读取日志文件时出错 | 管理员: {current_user.username} | 错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading log: {e}")