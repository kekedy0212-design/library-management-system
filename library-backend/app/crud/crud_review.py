from sqlalchemy.orm import Session, joinedload

from app.models.review import BookReview


def list_reviews_for_book(db: Session, book_id: int) -> list[BookReview]:
    return (
        db.query(BookReview)
        .options(joinedload(BookReview.user))
        .filter(BookReview.book_id == book_id)
        .order_by(BookReview.created_at.desc())
        .all()
    )


def get_review(db: Session, review_id: int) -> BookReview | None:
    return (
        db.query(BookReview)
        .options(joinedload(BookReview.user))
        .filter(BookReview.id == review_id)
        .first()
    )


def get_user_review_for_book(
    db: Session, user_id: int, book_id: int
) -> BookReview | None:
    return (
        db.query(BookReview)
        .options(joinedload(BookReview.user))
        .filter(BookReview.user_id == user_id, BookReview.book_id == book_id)
        .first()
    )


def review_to_public(review: BookReview, current_user_id: int | None = None) -> dict:
    return {
        "id": review.id,
        "book_id": review.book_id,
        "user_id": review.user_id,
        "username": review.user.username if review.user else "Unknown",
        "content": review.content,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
        "is_own": current_user_id is not None and review.user_id == current_user_id,
    }


def upsert_review(
    db: Session, user_id: int, book_id: int, content: str
) -> BookReview:
    existing = get_user_review_for_book(db, user_id, book_id)
    if existing:
        existing.content = content.strip()
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return get_review(db, existing.id)

    review = BookReview(
        user_id=user_id,
        book_id=book_id,
        content=content.strip(),
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return get_review(db, review.id)


def delete_review(db: Session, review: BookReview) -> None:
    db.delete(review)
    db.commit()
