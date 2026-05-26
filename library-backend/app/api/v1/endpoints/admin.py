from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.crud import crud_revenue
from app.models.user import User
from app.schemas.revenue import DailyRevenueResponse
from app.core.logger import LOG_FILE, get_logger
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/revenue/daily", response_model=DailyRevenueResponse)
def read_daily_revenue(
    target_date: date | None = Query(
        None,
        alias="date",
        description="Calendar day in UTC (YYYY-MM-DD). Defaults to today.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin: daily totals for successful deposit and fine payments."""
    logger.info(
        f"📊 [Daily revenue] Admin '{current_user.username}' requested revenue for {target_date or 'today'}"
    )
    return crud_revenue.get_daily_revenue(db, target_date)

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
        
        return {
            "log_file": str(LOG_FILE),
            "total_lines": len(all_lines),
            "returned_lines": len(recent),
            "logs": [line.strip() for line in recent]
        }
    except Exception as e:
        logger.error(f"❌ [日志查看失败] 读取日志文件时出错 | 管理员: {current_user.username} | 错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading log: {e}")