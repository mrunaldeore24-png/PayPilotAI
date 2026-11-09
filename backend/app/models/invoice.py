
from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Date,
    DateTime,
    CheckConstraint,
    func
)

from app.core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    __table_args__ = (
        CheckConstraint("amount > 0", name="check_invoice_amount_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)

    invoice_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    customer_name = Column(String(150), nullable=False)
    customer_email = Column(String(255), nullable=False)

    description = Column(String(500), nullable=False)

    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="INR", nullable=False)

    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)

    # Payment status: pending, paid, overdue, cancelled
    status = Column(String(20), default="pending", nullable=False)

    # PayPal identifiers will be populated during payment integration
    paypal_order_id = Column(String(100), nullable=True)
    paypal_capture_id = Column(String(100), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
