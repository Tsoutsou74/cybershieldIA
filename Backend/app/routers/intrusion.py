import csv
import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.schemas.analysis import IntrusionPayload, AnalysisResponse
from app.models.analysis import Analysis
from app.services.intrusion_service import predict_intrusion
from app.core.deps import get_current_user  # AJOUT
from app.models.user import User  # AJOUT

router = APIRouter(prefix="/intrusion", tags=["Intrusion Detection"])

MAX_CSV_BYTES = 20 * 1024 * 1024
MAX_CSV_FLOWS = 10_000


@router.post("/analyze-csv")
def analyze_intrusion_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Veuillez fournir un fichier CSV.")
    try:
        content = file.file.read(MAX_CSV_BYTES + 1)
        if len(content) > MAX_CSV_BYTES:
            raise HTTPException(status_code=413, detail="Le fichier CSV dépasse la limite de 20 Mo.")
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise ValueError("Le fichier ne contient pas d'en-têtes CSV.")
        rows = []
        for row in reader:
            if any(value and value.strip() for value in row.values()):
                rows.append(row)
                if len(rows) > MAX_CSV_FLOWS:
                    raise HTTPException(status_code=413, detail="Le fichier dépasse la limite de 10 000 flux.")
        if not rows:
            raise ValueError("Le fichier ne contient aucun flux à analyser.")
        predictions = [predict_intrusion({"features": row}) for row in rows]
    except HTTPException:
        raise
    except (UnicodeDecodeError, csv.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"CSV invalide : {exc}") from exc
    except (RuntimeError, ImportError, OSError) as exc:
        raise HTTPException(status_code=503, detail=f"Modèle IA IDS indisponible : {exc}") from exc
    finally:
        file.file.close()

    counts: dict[str, int] = {}
    for prediction in predictions:
        label = prediction["predicted_label"]
        counts[label] = counts.get(label, 0) + 1
    malicious = sum(prediction["status"] == "MALICIOUS" for prediction in predictions)
    low_confidence = sum(prediction["status"] == "UNKNOWN" for prediction in predictions)
    mean_confidence = sum(prediction["confidence"] for prediction in predictions) / len(predictions)
    dominant_attack = max(counts, key=counts.get) if counts else None
    analysis = Analysis(
        type="intrusion",
        target=f"CSV: {file.filename}",
        score=round(sum(prediction["score"] for prediction in predictions) / len(predictions), 4),
        status="MALICIOUS" if malicious else "UNKNOWN" if low_confidence else "SAFE",
        user_id=current_user.id,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return {
        "analysis_id": analysis.id,
        "filename": file.filename,
        "status": analysis.status,
        "total_flows": len(predictions),
        "malicious_flows": malicious,
        "malicious_ratio": malicious / len(predictions),
        "low_confidence_flows": low_confidence,
        "mean_confidence": round(mean_confidence, 4),
        "dominant_attack": dominant_attack if dominant_attack != "Benign" else None,
        "counts": counts,
    }

@router.post("/analyze", response_model=AnalysisResponse)
def analyze_intrusion(
    payload: IntrusionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # AJOUT
):
    try:
        result = predict_intrusion(payload.model_dump())
    except (RuntimeError, ImportError, OSError) as exc:
        raise HTTPException(status_code=503, detail=f"Modèle IA IDS indisponible : {exc}") from exc

    analysis = Analysis(
        type="intrusion",
        target=payload.source_ip,
        score=result["score"],
        status=result["status"],
        user_id=current_user.id,  # AJOUT
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis
