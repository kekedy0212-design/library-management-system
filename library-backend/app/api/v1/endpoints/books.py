from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.book import BookCreate, BookUpdate, BookPublic
from app.crud import crud_book
from app.api.deps import get_current_librarian
from app.models.user import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/", response_model=List[BookPublic])
def search_books(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100
):
    """搜索书籍列表"""
    if q:
        logger.debug(f"🔍 [书籍搜索] 关键词: '{q}' | 分页: skip={skip}, limit={limit}")
    books = crud_book.get_books(db, skip=skip, limit=limit, search=q)
    logger.debug(f"✅ [书籍查询] 返回 {len(books)} 本书籍 | 搜索词: {q or '无'}")
    return books

@router.get("/{book_id}", response_model=BookPublic)
def get_book(book_id: int, db: Session = Depends(get_db)):
    """获取书籍详情"""
    logger.debug(f"📖 [书籍详情] 查询书籍 ID: {book_id}")
    book = crud_book.get_book(db, book_id)
    if not book:
        logger.warning(f"⚠️ [书籍详情] 书籍未找到 | ID: {book_id}")
        raise HTTPException(status_code=404, detail="Book not found")
    logger.debug(f"✅ [书籍详情] 找到书籍: {book.title}")
    return book

@router.post("/", response_model=BookPublic)
def create_book(
    book_in: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    """创建新书籍（仅图书管理员）"""
    logger.info(f"📚 [书籍创建] 用户 '{current_user.username}' 开始创建书籍")
    logger.debug(f"   书名: {book_in.title} | ISBN: {book_in.isbn} | 作者: {book_in.author}")
    
    existing = crud_book.get_book_by_isbn(db, book_in.isbn)
    if existing:
        logger.warning(f"❌ [书籍创建失败] ISBN已存在: {book_in.isbn}")
        raise HTTPException(status_code=400, detail="ISBN already exists")
    
    book = crud_book.create_book(db, book_in)
    logger.info(f"✅ [书籍创建成功] 图书管理员 '{current_user.username}' 创建新书籍 | 书名: '{book.title}' | ISBN: {book.isbn} | ID: {book.id}")
    return book

@router.put("/{book_id}", response_model=BookPublic)
def update_book(
    book_id: int,
    book_in: BookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    """更新书籍信息（仅图书管理员）"""
    logger.info(f"✏️ [书籍更新] 用户 '{current_user.username}' 开始更新书籍 | ID: {book_id}")
    
    book = crud_book.get_book(db, book_id)
    if not book:
        logger.warning(f"⚠️ [书籍更新失败] 书籍未找到 | ID: {book_id}")
        raise HTTPException(status_code=404, detail="Book not found")
    
    # 记录修改前的信息
    old_data = {
        "title": book.title,
        "author": book.author,
        "available_copies": book.available_copies,
        "total_copies": book.total_copies
    }
    
    try:
        book = crud_book.update_book(db, book, book_in)
    except ValueError as e:
        logger.error(f"❌ [书籍更新失败] {str(e)} | ID: {book_id}")
        raise HTTPException(status_code=400, detail=str(e))
    
    # 记录修改后的信息
    new_data = {
        "title": book.title,
        "author": book.author,
        "available_copies": book.available_copies,
        "total_copies": book.total_copies
    }
    
    logger.info(f"✅ [书籍更新成功] 图书管理员 '{current_user.username}' 更新书籍 | 书名: '{book.title}' | ID: {book_id}")
    logger.debug(f"   修改内容: {old_data} -> {new_data}")
    return book

@router.delete("/{book_id}")
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    """删除书籍（仅图书管理员）"""
    logger.info(f"🗑️ [书籍删除] 用户 '{current_user.username}' 开始删除书籍 | ID: {book_id}")

    try:
        book = crud_book.delete_book(db, book_id)
    except ValueError as e:
        logger.error(f"❌ [书籍删除失败] {str(e)} | ID: {book_id}")
        raise HTTPException(status_code=400, detail=str(e))

    if not book:
        logger.warning(f"⚠️ [书籍删除失败] 书籍未找到 | ID: {book_id}")
        raise HTTPException(status_code=404, detail="Book not found")
    
    logger.info(f"✅ [书籍删除成功] 图书管理员 '{current_user.username}' 删除书籍 | 书名: '{book.title}' | ISBN: {book.isbn} | ID: {book_id}")
    return {"msg": "Book deleted successfully"}