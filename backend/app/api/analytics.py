
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.invoice import Invoice

router = APIRouter()


@router.get("/summary")
def get_analytics_summary(db: Session = Depends(get_db)):

    # Total number of invoices
    total_invoices = db.query(func.count(Invoice.id)).scalar() or 0

    # Count invoices by status
    paid_count = db.query(func.count(Invoice.id)).filter(
        Invoice.status == "paid"
    ).scalar() or 0

    pending_count = db.query(func.count(Invoice.id)).filter(
        Invoice.status == "pending"
    ).scalar() or 0

    overdue_count = db.query(func.count(Invoice.id)).filter(
        Invoice.status == "overdue"
    ).scalar() or 0

    cancelled_count = db.query(func.count(Invoice.id)).filter(
        Invoice.status == "cancelled"
    ).scalar() or 0

    # Total revenue from paid invoices
    total_revenue = db.query(
        func.sum(Invoice.amount)
    ).filter(
        Invoice.status == "paid"
    ).scalar() or Decimal("0.00")

    # Outstanding amount from pending and overdue invoices
    outstanding_amount = db.query(
        func.sum(Invoice.amount)
    ).filter(
        Invoice.status.in_(["pending", "overdue"])
    ).scalar() or Decimal("0.00")

    # Total overdue amount
    overdue_amount = db.query(
        func.sum(Invoice.amount)
    ).filter(
        Invoice.status == "overdue"
    ).scalar() or Decimal("0.00")

    return {
        "total_invoices": total_invoices,
        "paid_invoices": paid_count,
        "pending_invoices": pending_count,
        "overdue_invoices": overdue_count,
        "cancelled_invoices": cancelled_count,
        "total_revenue": float(total_revenue),
        "outstanding_amount": float(outstanding_amount),
        "overdue_amount": float(overdue_amount)
    }
