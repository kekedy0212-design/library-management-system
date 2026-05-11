from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.models.copy import CopyStatus

class BookCopyCreate(BaseModel):
    book_id: int
    barcode_number: int
    status: CopyStatus = CopyStatus.AVAILABLE
    location: str | None = None

class BookCopyUpdate(BaseModel):
    status: CopyStatus | None = None
    location: str | None = None

class BookCopyPublic(BaseModel):
    id: int
    book_id: int
    barcode_number: int
    status: CopyStatus
    location: str | None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
