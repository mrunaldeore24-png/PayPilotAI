
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.analytics import router as analytics_router
from app.api.payments import router as payments_router
from app.api.ai import router as ai_router
# Import models before creating database tables
from app.models.invoice import Invoice
from app.core.database import Base, engine

from app.api.health import router as health_router
from app.api.invoices import router as invoice_router

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PayPilot AI",
    description="AI-powered financial operations agent",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    health_router,
    prefix="/api",
    tags=["Health"]
)

app.include_router(
    invoice_router,
    prefix="/api/invoices",
    tags=["Invoices"]
)

app.include_router(
    payments_router,
    prefix="/api/payments",
    tags=["Payments"]
)

app.include_router(
    analytics_router,
    prefix="/api/analytics",
    tags=["Analytics"]
)

app.include_router(
    ai_router,
    prefix="/api/ai", 
    tags=["AI Insights"]
)
@app.get("/")
def root():
    return {
        "message": "Welcome to PayPilot AI",
        "status": "running"
    }
