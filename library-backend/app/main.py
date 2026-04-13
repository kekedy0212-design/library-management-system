from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base, SessionLocal
from app.core.logger import setup_logging
from app.core.security import get_password_hash  # 添加这行导入
import logging

# 导入所有模型（必须！否则表不会创建）
from app.models.user import User, UserRole
from app.models.book import Book
from app.models.borrow import BorrowRecord

# 初始化日志
setup_logging()
logger = logging.getLogger(__name__)

# 创建数据库表
Base.metadata.create_all(bind=engine)

# 初始化系统管理员
def init_admin():
    db = SessionLocal()
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
        logger.info("✅ 已创建默认系统管理员账号: admin / admin123")
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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"{request.method} {request.url.path} - from {request.client.host}")
    response = await call_next(request)
    return response

# 注册路由
from app.api.v1.endpoints import auth, users, books, borrow, admin

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(books.router, prefix="/api/v1/books", tags=["Books"])
app.include_router(borrow.router, prefix="/api/v1", tags=["Borrow/Return"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])

@app.get("/")
def root():
    return {"message": "Library Management System API is running. Visit /docs for Swagger UI."}