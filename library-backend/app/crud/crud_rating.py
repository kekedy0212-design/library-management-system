from sqlalchemy import func
from sqlalchemy.orm import Session

from app.crud import crud_book
from app.models.rating import BookRating

MIN_RECOMMEND_AVG_SCORE = 4
MIN_RECOMMEND_RATINGS = 1


def get_user_rating(db: Session, user_id: int, book_id: int) -> BookRating | None:
    return (
        db.query(BookRating)
        .filter(BookRating.user_id == user_id, BookRating.book_id == book_id)
        .first()
    )


def get_book_rating_summary(
    db: Session, book_id: int, user_id: int | None = None
) -> dict:
    row = (
        db.query(
            func.avg(BookRating.score),
            func.count(BookRating.id),
        )
        .filter(BookRating.book_id == book_id)
        .first()
    )
    avg_score, count = row[0], int(row[1] or 0)
    average = round(float(avg_score), 2) if avg_score is not None else None

    user_rating = None
    if user_id is not None:
        existing = get_user_rating(db, user_id, book_id)
        if existing:
            user_rating = existing.score

    return {
        "book_id": book_id,
        "average_rating": average,
        "rating_count": count,
        "user_rating": user_rating,
    }


def get_ratings_map_for_books(db: Session, book_ids: list[int]) -> dict[int, dict]:
    """Batch average rating per book_id for list views."""
    if not book_ids:
        return {}
    rows = (
        db.query(
            BookRating.book_id,
            func.avg(BookRating.score),
            func.count(BookRating.id),
        )
        .filter(BookRating.book_id.in_(book_ids))
        .group_by(BookRating.book_id)
        .all()
    )
    return {
        book_id: {
            "average_rating": round(float(avg), 2),
            "rating_count": int(count),
        }
        for book_id, avg, count in rows
    }


def get_user_ratings_map(db: Session, user_id: int, book_ids: list[int]) -> dict[int, int]:
    if not book_ids:
        return {}
    rows = (
        db.query(BookRating.book_id, BookRating.score)
        .filter(BookRating.user_id == user_id, BookRating.book_id.in_(book_ids))
        .all()
    )
    return {book_id: score for book_id, score in rows}


def build_books_public(db: Session, books: list, user_id: int | None = None):
    """Build BookPublic list with rating summary fields."""
    from app.schemas.book import BookPublic

    if not books:
        return []
    book_ids = [b.id for b in books]
    ratings_map = get_ratings_map_for_books(db, book_ids)
    user_map = get_user_ratings_map(db, user_id, book_ids) if user_id else {}

    result = []
    for book in books:
        summary = ratings_map.get(book.id, {})
        result.append(
            BookPublic.model_validate(book).model_copy(
                update={
                    "average_rating": summary.get("average_rating"),
                    "rating_count": summary.get("rating_count", 0),
                    "user_rating": user_map.get(book.id),
                }
            )
        )
    return result


def build_book_public(db: Session, book, user_id: int | None = None):
    from app.schemas.book import BookPublic

    summary = get_book_rating_summary(db, book.id, user_id)
    return BookPublic.model_validate(book).model_copy(
        update={
            "average_rating": summary["average_rating"],
            "rating_count": summary["rating_count"],
            "user_rating": summary["user_rating"],
        }
    )


def get_recommendations_for_user(
    db: Session,
    user_id: int,
    limit: int = 8,
) -> tuple[list[tuple[int, float, str]], str]:
    """
    Simple recommendation based on community rating.

    Rule:
    - Recommend books whose average rating >= 4.0
    - Sort by average rating desc, then rating count desc
    - Exclude books the user already rated
    """
    limit = max(1, min(limit, 20))

    # 用户对各书籍的个人评分（用于排除“我不喜欢”的书）
    user_scores = dict(
        db.query(BookRating.book_id, BookRating.score)
        .filter(BookRating.user_id == user_id)
        .all()
    )

    q = (
        db.query(
            BookRating.book_id,
            func.avg(BookRating.score).label("avg_score"),
            func.count(BookRating.id).label("cnt"),
        )
        .group_by(BookRating.book_id)
        .having(func.avg(BookRating.score) >= MIN_RECOMMEND_AVG_SCORE)
        .having(func.count(BookRating.id) >= MIN_RECOMMEND_RATINGS)
        .order_by(func.avg(BookRating.score).desc(), func.count(BookRating.id).desc())
    )

    rows = q.all()

    items: list[tuple[int, float, str]] = []
    for book_id, avg_score, cnt in rows:
        # 如果当前用户对这本书打过分且分数 < 4，则视为“不喜欢”，不推荐
        user_score = user_scores.get(book_id)
        if user_score is not None and user_score < 4:
            continue

        avg = round(float(avg_score), 2)
        c = int(cnt or 0)
        reason = f"Average rating {avg:.1f} from {c} reader{'' if c == 1 else 's'}"
        items.append((book_id, avg, reason))

        if len(items) >= limit:
            break

    return items, "rated_4_plus"


def build_recommendation_response(
    db: Session, user_id: int, limit: int = 8
) -> tuple[list[dict], str]:
    """Return recommendation dicts ready for BookRecommendation schema."""
    candidates, strategy = get_recommendations_for_user(db, user_id, limit)
    if not candidates:
        return [], strategy

    items = []
    for book_id, match_score, reason in candidates:
        book = crud_book.get_book(db, book_id)
        if not book:
            continue
        items.append(
            {
                "book": build_book_public(db, book, user_id),
                "match_score": match_score,
                "reason": reason,
            }
        )
    return items, strategy


def upsert_rating(db: Session, user_id: int, book_id: int, score: int) -> BookRating:
    existing = get_user_rating(db, user_id, book_id)
    if existing:
        existing.score = score
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    rating = BookRating(user_id=user_id, book_id=book_id, score=score)
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating
