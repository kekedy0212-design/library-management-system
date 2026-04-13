from fastapi import APIRouter, Depends, HTTPException, Query
from pathlib import Path
from app.api.deps import get_current_admin
from app.models.user import User

router = APIRouter()

LOG_FILE = Path(__file__).resolve().parent.parent.parent.parent / "logs" / "app.log"

@router.get("/logs")
def read_logs(
    lines: int = Query(100, ge=1, le=1000, description="Number of recent log lines"),
    current_user: User = Depends(get_current_admin)
):
    """系统管理员查看最近的日志（默认最近100行）"""
    if not LOG_FILE.exists():
        return {"msg": "No log file found", "logs": []}
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            recent = all_lines[-lines:] if len(all_lines) > lines else all_lines
        return {
            "log_file": str(LOG_FILE),
            "lines": len(recent),
            "logs": [line.strip() for line in recent]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading log: {e}")