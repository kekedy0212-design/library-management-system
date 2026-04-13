# Library Management System - Backend

> 图书馆管理系统后端 API（R1 阶段）  
> 采用 FastAPI + SQLite + JWT 认证，提供用户管理、书籍管理、借阅审批、日志审计等功能。

## 📋 目录

- [技术栈](#技术栈)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [测试账号](#测试账号)
- [API 文档](#api-文档)
- [项目结构](#项目结构)
- [已实现功能（R1）](#已实现功能r1)
- [常见问题](#常见问题)

---

## 技术栈

| 类型         | 技术                                      |
| :----------- | :---------------------------------------- |
| **语言**     | Python 3.12                              |
| **Web 框架** | FastAPI                                  |
| **数据库**   | SQLite（开发用）+ SQLAlchemy ORM          |
| **认证**     | JWT (python-jose)                        |
| **密码加密** | passlib (sha256_crypt)                   |
| **日志**     | Python logging + RotatingFileHandler     |
| **环境配置** | pydantic-settings + python-dotenv        |

## 环境要求

- Python 3.11 或 3.12（推荐 3.12）
- pip
- Git (可选)

## 快速开始

### 1. 克隆项目并进入目录

```bash
git clone <your-repo-url>
cd library-backend   # 或你的项目目录名
```

### 2. 创建并激活虚拟环境

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

> **注意**：本项目的密码加密已固定为 `sha256_crypt`，不再依赖有兼容问题的 `bcrypt`，无需额外处理。

### 4. 配置环境变量

在项目根目录创建 `.env` 文件，内容如下：

```ini
DATABASE_URL=sqlite:///./library.db
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### 5. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

启动成功后，终端会显示：

```
✅ 已加载配置文件: ...\.env
INFO:     Application startup complete.
```

服务将运行在 `http://127.0.0.1:8000/docs`。

ps.如果提示说.env文件存在问题可以跳过 .env 文件，直接通过系统环境变量或代码默认值来启动服务。

```bash
# 设置必需的环境变量
$env:DATABASE_URL = "sqlite:///./library.db"
$env:SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"

# 启动服务
uvicorn app.main:app --reload --port 8000
```

---

## 测试账号

首次启动时，系统会自动创建以下管理员账号：

| 用户名 | 密码   | 角色              |
| :----- | :----- | :---------------- |
| admin  | admin123 | **系统管理员 (admin)** |

> 你可以使用该账号登录，然后通过 API 将其他注册用户提升为 `librarian` 或 `admin`。

此外建议同意将读者命名为reader1/2/3...密码reader123，图书管理员命名为librarian1/2/3...密码librarian123

---

## API 文档

启动服务后，访问以下地址即可查看交互式 API 文档（Swagger UI）：

```
http://localhost:8000/docs
```

### 🔐 认证说明

1. 在 Swagger 页面右上角点击 **Authorize**。
2. 输入用户名和密码（例如 `admin` / `admin123`）。
3. 点击 **Authorize**，关闭对话框。
4. 之后所有带锁的接口都会自动携带 Token。

---

## 已实现功能（R1）

### ✅ 用户故事完成度

| 需求编号 | 功能描述                                 | 状态 |
| :------- | :--------------------------------------- | :--- |
| R1.1     | 读者注册、登录、登出                     | ✅    |
| R1.2     | 管理员管理读者账户（禁用、重置密码、提升角色） | ✅    |
| R1.3     | 读者搜索书籍、查看详情                   | ✅    |
| R1.4     | 图书管理员管理书籍（增、删、改）         | ✅    |
| R1.5     | 读者发起借书/还书请求                    | ✅    |
| R1.6     | 管理员审批借阅/归还请求，更新库存        | ✅    |
| R1.7     | 数据一致性保证（事务、行锁防超借）       | ✅    |
| 扩展     | 系统管理员查看操作日志                   | ✅    |

### 🔧 技术亮点

- **权限分级**：`reader` / `librarian` / `admin` 三级权限，接口级拦截。
- **数据一致性**：借书/还书审批使用数据库事务 + `SELECT ... FOR UPDATE` 防止并发超借。
- **日志审计**：关键操作（角色变更、审批）自动记录到日志文件，支持管理员通过 API 查看。
- **自动建表**：启动时自动创建数据库表，并初始化管理员账号。

---

## 常见问题

### 1. 启动时出现 `ModuleNotFoundError: No module named 'app'`

**原因**：未在项目根目录执行命令。  
**解决**：确保终端当前路径为包含 `app` 文件夹的目录（即 `library-backend`）。

### 2. 登录时返回 500 或密码相关错误

**原因**：旧版数据库使用了 `bcrypt` 哈希，与当前 `sha256_crypt` 不兼容。  
**解决**：删除项目根目录下的 `library.db` 文件，重启服务即可自动重建。

### 3. Swagger 中执行需要认证的接口返回 401

**可能原因**：
- 未点击右上角 **Authorize** 登录。
- Token 过期（重新登录）。
- `.env` 中 `SECRET_KEY` 与生成 Token 时不一致。

**解决**：先调用 `POST /api/v1/auth/login` 获取新 Token，然后在 **Authorize** 弹窗中粘贴 `Bearer <token>`。

### 4. 如何查看系统日志？

- **管理员** 可调用 `GET /api/v1/admin/logs?lines=50` 查看最近 50 行日志。
- **直接查看文件**：打开项目根目录下的 `logs/app.log`。

### 5. 如何将读者提升为图书管理员？

1. 用 `admin` 账号登录。
2. 调用 `PUT /api/v1/users/{user_id}`，请求体：
   ```json
   { "role": "librarian" }
   ```

---

## 前后端协作提示

- 前端开发服务器请运行在 `http://localhost:5173`（已配置 CORS 白名单）。
- 所有 API 基础路径为 `/api/v1`。
- 登录接口使用 `application/x-www-form-urlencoded` 格式（OAuth2 标准）。

---

**祝开发顺利！** 🚀
```