
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "PayPilot AI",
        "message": "Backend is running successfully!"
    }
