from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
from app.core.database import engine, Base, SessionLocal
from app.core.config import settings as app_settings
from app.core.logger import setup_logging, get_logger, log_separator
from app.core.security import get_password_hash  # 添加这行导入
import logging
import os
import time

# 导入所有模型（必须！否则表不会创建）
from app.models.user import User, UserRole
from app.models.book import Book
from app.models.copy import BookCopy
from app.models.borrow import BorrowRecord
from app.models.deposit import Deposit, DepositTransaction
from app.models.fine import Fine, FineTransaction
from app.models.rating import BookRating
from app.models.review import BookReview

# 初始化日志 - 支持通过环境变量调整日志级别 (DEBUG, INFO, WARNING, ERROR)
log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_str, logging.INFO)
setup_logging(log_level=log_level)
logger = get_logger(__name__)

logger.info("🔧 [应用启动] 开始初始化图书馆管理系统...")

# 创建数据库表 - 先删除旧表再重建以确保表结构最新
try:
    # 检查是否需要重建表（如果borrow_records表缺少copy_id列）
    from sqlalchemy import inspect
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    if 'borrow_records' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('borrow_records')]
        if 'copy_id' not in columns:
            logger.warning("⚠️ [数据库] 检测到borrow_records表缺少copy_id列，准备重建...")
            Base.metadata.drop_all(bind=engine)
            logger.info("🗑️ [数据库] 已删除所有旧表")
    
    # 创建所有表
    Base.metadata.create_all(bind=engine)
    logger.info("✅ [数据库] 数据库表已创建/验证")
except Exception as e:
    logger.error(f"❌ [数据库] 数据库初始化失败: {e}")
    raise

# 初始化系统管理员
def init_admin():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@library.com",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin)
            db.commit()
            logger.info("✅ [管理员] 已创建默认系统管理员账号: admin / admin123")
        else:
            logger.info("ℹ️ [管理员] 系统管理员账号已存在，跳过创建")
    except Exception as e:
        logger.error(f"❌ [管理员] 管理员初始化失败: {e}")
        db.rollback()
        raise
    finally:
        db.close()

init_admin()

app = FastAPI(
    title="Library Management System API",
    description="R1 阶段后端实现，支持注册/登录、书籍管理、借阅审批、数据一致性",
    version="1.0.0"
)

# CORS：默认允许常见本地端口；可用环境变量 CORS_ORIGINS 追加（逗号分隔）
_default_cors = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
_extra = [o.strip() for o in app_settings.CORS_ORIGINS.split(",") if o.strip()]
_cors_origins = list(dict.fromkeys(_default_cors + _extra))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    # 换电脑后前端端口可能变化；匹配本机任意端口的 HTTP 来源
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 增强版请求日志中间件 - 记录详细信息和执行时间
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    记录所有HTTP请求的详细信息，包括：
    - 请求方法和路径
    - 客户端IP
    - 响应状态码
    - 执行时间
    """
    # 记录请求开始
    start_time = time.time()
    
    # 构建请求的query string信息
    query_string = f"?{request.url.query}" if request.url.query else ""
    
    # 调用实际的处理函数
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # 根据状态码选择日志级别和符号
        status_code = response.status_code
        if 200 <= status_code < 300:
            symbol = "✅"
            log_method = logger.info
        elif 300 <= status_code < 400:
            symbol = "↪️ "
            log_method = logger.info
        elif 400 <= status_code < 500:
            symbol = "⚠️ "
            log_method = logger.warning
        else:
            symbol = "❌"
            log_method = logger.error
        
        # 记录请求完成
        log_method(
            f"{symbol} [{status_code}] {request.method} {request.url.path}{query_string} "
            f"| 客户端: {request.client.host} | ⏱️ {process_time:.3f}s"
        )
        
        return response
    except Exception as e:
        process_time = time.time() - start_time
        tb = traceback.format_exc()
        logger.error(
            f"❌ [Exception] {request.method} {request.url.path}{query_string} "
            f"| 客户端: {request.client.host} | ⏱️ {process_time:.3f}s | 错误: {str(e)}\n{tb}"
        )
        # 把异常转成正常的 JSONResponse 返回，避免响应缺失，
        # 也让外层 CORSMiddleware 能给响应补上 Access-Control-* 头
        # （否则浏览器会先看到 CORS 报错，把真正的 500 detail 藏起来）。
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"},
        )

# 注册路由
from app.api.v1.endpoints import auth, users, books, borrow, admin, deposit, fine

logger.info("📡 [路由] 开始注册API路由...")
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(books.router, prefix="/api/v1/books", tags=["Books"])
app.include_router(borrow.router, prefix="/api/v1", tags=["Borrow/Return"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(deposit.router, prefix="/api/v1", tags=["Deposit/Payment"])
app.include_router(fine.router, prefix="/api/v1", tags=["Fines"])
logger.info("✅ [路由] API路由注册完成")

@app.get("/")
def root():
    logger.debug("访问根路径")
    return {"message": "Library Management System API is running. Visit /docs for Swagger UI."}