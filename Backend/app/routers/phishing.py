from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.schemas.analysis import PhishingPayload, PhishingAnalysisResponse
from app.models.analysis import Analysis
from app.services.phishing_service import predict_phishing
from app.services.malware_service import check_malware_url
from app.core.deps import get_current_user  # AJOUT
from app.models.user import User  # AJOUT

router = APIRouter(prefix="/phishing", tags=["Phishing Detection"])

@router.post("/analyze", response_model=PhishingAnalysisResponse)
def analyze_phishing(
    payload: PhishingPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # AJOUT
):
    result = predict_phishing(payload.url_or_text)
    malware = check_malware_url(payload.url_or_text)
    malware_found = malware["status"] == "malware_found"
    score = max(float(result["score"]), 0.99 if malware_found else 0.0)
    status = "MALICIOUS" if malware_found else result["status"]

    analysis = Analysis(
        type="phishing",
        target=payload.url_or_text,
        score=score,
        status=status,
        user_id=current_user.id,  # AJOUT
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return {
        "id": analysis.id,
        "type": analysis.type,
        "target": analysis.target,
        "score": analysis.score,
        "status": analysis.status,
        "created_at": analysis.created_at,
        "malware": malware,
    }
