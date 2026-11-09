
from collections import defaultdict
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.invoice import Invoice
from app.services.gemini_service import generate_financial_insights


router = APIRouter()


@router.get("/insights")
def get_ai_insights(db: Session = Depends(get_db)):

    today = date.today()

    # Update pending invoices whose due dates have passed.
    db.query(Invoice).filter(
        Invoice.status == "pending",
        Invoice.due_date < today
    ).update(
        {"status": "overdue"},
        synchronize_session=False
    )

    db.commit()

    invoices = db.query(Invoice).order_by(
        Invoice.due_date.asc()
    ).all()

    # Separate financial calculations by currency.
    currency_data = defaultdict(
        lambda: {
            "total_invoices": 0,
            "paid_invoices": 0,
            "pending_invoices": 0,
            "overdue_invoices": 0,
            "cancelled_invoices": 0,
            "paid_revenue": 0.0,
            "outstanding_amount": 0.0,
            "total_invoiced_value": 0.0,
        }
    )

    total_invoices = len(invoices)
    paid_invoices = 0
    pending_invoices = 0
    overdue_invoices = 0
    cancelled_invoices = 0

    invoices_requiring_attention = []

    for invoice in invoices:

        currency = invoice.currency

        amount = float(invoice.amount)

        summary = currency_data[currency]

        summary["total_invoices"] += 1
        summary["total_invoiced_value"] += amount

        if invoice.status == "paid":
            paid_invoices += 1
            summary["paid_invoices"] += 1
            summary["paid_revenue"] += amount

        elif invoice.status == "pending":
            pending_invoices += 1
            summary["pending_invoices"] += 1
            summary["outstanding_amount"] += amount

        elif invoice.status == "overdue":
            overdue_invoices += 1
            summary["overdue_invoices"] += 1
            summary["outstanding_amount"] += amount

        elif invoice.status == "cancelled":
            cancelled_invoices += 1
            summary["cancelled_invoices"] += 1

        # Include unpaid invoices for AI prioritization.
        if invoice.status in ("pending", "overdue"):

            days_overdue = max(
                (today - invoice.due_date).days,
                0
            )

            invoices_requiring_attention.append({
                "invoice_number": invoice.invoice_number,
                "amount": amount,
                "currency": currency,
                "status": invoice.status,
                "due_date": invoice.due_date.isoformat(),
                "days_overdue": days_overdue,
            })

    # Round monetary values to two decimal places.
    for summary in currency_data.values():
        for key in (
            "paid_revenue",
            "outstanding_amount",
            "total_invoiced_value",
        ):
            summary[key] = round(summary[key], 2)

    financial_data = {
        "total_invoices": total_invoices,
        "paid_invoices": paid_invoices,
        "pending_invoices": pending_invoices,
        "overdue_invoices": overdue_invoices,
        "cancelled_invoices": cancelled_invoices,
        "currency_breakdown": dict(currency_data),
        "invoices_requiring_attention": invoices_requiring_attention,
    }

    try:
        insights = generate_financial_insights(financial_data)

        return {
            "message": "AI financial insights generated successfully.",
            "generated_at": datetime.now().isoformat(),
            "financial_data": financial_data,
            "insights": insights,
        }

    except RuntimeError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error)
        )
