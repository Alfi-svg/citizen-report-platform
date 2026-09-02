import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CategoryBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    is_active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(CategoryBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminCategoryResponse(CategoryBase):
    id: uuid.UUID
    report_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
