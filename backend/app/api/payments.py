
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.invoice import Invoice
from app.services.paypal_service import create_paypal_order
from app.services.paypal_service import capture_paypal_order

router = APIRouter()


@router.post("/create-order/{invoice_id}")
def create_payment_order(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found.",
        )

    try:
        order = create_paypal_order(invoice)

        invoice.paypal_order_id = order["order_id"]

        db.commit()

        return {
            "message": "PayPal order created successfully.",
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "order_id": order["order_id"],
            "approval_url": order["approval_url"],
            "paypal_status": order["status"],
        }

    except ValueError as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except RuntimeError as error:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=str(error),
        )

@router.post("/capture/{invoice_id}")
def capture_invoice_payment(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found.",
        )

    if invoice.status == "paid":
        return {
            "message": "This invoice is already paid.",
            "invoice_id": invoice.id,
            "capture_id": invoice.paypal_capture_id,
            "status": "COMPLETED",
        }

    if not invoice.paypal_order_id:
        raise HTTPException(
            status_code=400,
            detail="No PayPal order exists for this invoice.",
        )

    try:
        result = capture_paypal_order(
            order_id=invoice.paypal_order_id,
            expected_invoice_id=invoice.id,
            expected_amount=invoice.amount,
            expected_currency=invoice.currency,
        )

        invoice.paypal_capture_id = result["capture_id"]
        invoice.status = "paid"

        db.commit()
        db.refresh(invoice)

        return {
            "message": "Payment captured and verified successfully.",
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "capture_id": result["capture_id"],
            "amount": result["amount"],
            "currency": result["currency"],
            "status": invoice.status,
        }

    except ValueError as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except RuntimeError as error:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=str(error),
        )
