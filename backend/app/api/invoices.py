
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.invoice import Invoice
from app.schemas.invoice import InvoiceCreate, InvoiceResponse

router = APIRouter()


@router.post("/", response_model=InvoiceResponse, status_code=201)
def create_invoice(
    invoice_data: InvoiceCreate,
    db: Session = Depends(get_db)
):
    invoice = Invoice(**invoice_data.model_dump())

    db.add(invoice)

    try:
        db.commit()
        db.refresh(invoice)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An invoice with this invoice number already exists."
        )

    return invoice


@router.get("/", response_model=list[InvoiceResponse])
def get_invoices(
    search: str | None = Query(default=None, max_length=100),
    status: Literal["pending", "paid", "overdue", "cancelled"] | None = None,
    db: Session = Depends(get_db)
):
    # Automatically update pending invoices past their due date
    db.query(Invoice).filter(
        Invoice.status == "pending",
        Invoice.due_date < date.today()
    ).update(
        {"status": "overdue"},
        synchronize_session=False
    )

    db.commit()

    query = db.query(Invoice)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Invoice.customer_name.ilike(search_term),
                Invoice.customer_email.ilike(search_term),
                Invoice.invoice_number.ilike(search_term)
            )
        )

    if status:
        query = query.filter(Invoice.status == status)

    return query.order_by(Invoice.created_at.desc()).all()


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found."
        )

    return invoice
