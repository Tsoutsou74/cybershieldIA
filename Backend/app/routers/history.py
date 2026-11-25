from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.analysis import Analysis
from app.models.user import User
from app.schemas.analysis import AnalysisResponse
from app.core.deps import get_current_user, get_current_superadmin

router = APIRouter(prefix="/history", tags=["History"])


class AdminAnalysisResponse(AnalysisResponse):
    user_id: int | None
    user_email: str | None

@router.get("/", response_model=list[AnalysisResponse])
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # AJOUT
):
    return (
        db.query(Analysis)
        .filter(Analysis.user_id == current_user.id)  # AJOUT
        .order_by(Analysis.created_at.desc())
        .all()
    )


@router.get("/admin", response_model=list[AdminAnalysisResponse])
def get_all_user_activity(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_superadmin),
):
    rows = (
        db.query(Analysis, User.email)
        .outerjoin(User, Analysis.user_id == User.id)
        .order_by(Analysis.created_at.desc())
        .all()
    )
    return [
        {**AnalysisResponse.model_validate(analysis).model_dump(), "user_id": analysis.user_id, "user_email": email}
        for analysis, email in rows
    ]
