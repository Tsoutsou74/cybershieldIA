from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PlanRequest(BaseModel):
    plan: Literal["premium", "business"]


class ManualPaymentRequest(PlanRequest):
    reference: str = Field(min_length=2, max_length=180)


class PaymentReviewRequest(BaseModel):
    approved: bool


class PaymentHistoryResponse(BaseModel):
    payment_id: int
    subscription_id: int
    user_id: int
    user_email: str
    plan: Literal["premium", "business"]
    amount_cents: int
    currency: str
    method: Literal["stripe", "manual"]
    status: Literal["pending", "paid", "failed", "rejected"]
    reference: str | None
    created_at: datetime
    verified_at: datetime | None
    verified_by: str | None
    subscription_status: str

    model_config = {"from_attributes": True}
