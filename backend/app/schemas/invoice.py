
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class InvoiceCreate(BaseModel):
    invoice_number: str = Field(min_length=2, max_length=50)
    customer_name: str = Field(min_length=2, max_length=150)
    customer_email: str = Field(min_length=5, max_length=255)
    description: str = Field(min_length=2, max_length=500)

    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")

    issue_date: date
    due_date: date

    @model_validator(mode="after")
    def validate_dates(self):
        if self.due_date < self.issue_date:
            raise ValueError("Due date cannot be before issue date")
        return self


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    customer_name: str
    customer_email: str
    description: str
    amount: Decimal
    currency: str
    issue_date: date
    due_date: date
    status: Literal["pending", "paid", "overdue", "cancelled"]
    paypal_order_id: str | None = None
    paypal_capture_id: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
