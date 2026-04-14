from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base, SessionLocal
from app.core.logger import setup_logging, get_logger, log_separator
from app.core.security import get_password_hash  # 添加这行导入
import logging
import os
import time

# 导入所有模型（必须！否则表不会创建）
from app.models.user import User, UserRole
from app.models.book import Book
from app.models.borrow import BorrowRecord

# 初始化日志 - 支持通过环境变量调整日志级别 (DEBUG, INFO, WARNING, ERROR)
log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_str, logging.INFO)
setup_logging(log_level=log_level)
logger = get_logger(__name__)

logger.info("🔧 [应用启动] 开始初始化图书馆管理系统...")

# 创建数据库表
try:
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

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
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
        logger.error(
            f"❌ [Exception] {request.method} {request.url.path}{query_string} "
            f"| 客户端: {request.client.host} | ⏱️ {process_time:.3f}s | 错误: {str(e)}"
        )
        raise

# 注册路由
from app.api.v1.endpoints import auth, users, books, borrow, admin

logger.info("📡 [路由] 开始注册API路由...")
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(books.router, prefix="/api/v1/books", tags=["Books"])
app.include_router(borrow.router, prefix="/api/v1", tags=["Borrow/Return"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
logger.info("✅ [路由] API路由注册完成")

@app.get("/")
def root():
    logger.debug("访问根路径")
    return {"message": "Library Management System API is running. Visit /docs for Swagger UI."}