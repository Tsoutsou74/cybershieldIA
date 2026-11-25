"""Signed event receiver for authorized provider integrations."""
import hashlib
import hmac
import json

from fastapi import APIRouter, Header, HTTPException, Request
from app.core.config import settings
from app.database.database import SessionLocal
from app.models.analysis import Analysis
from app.services.intrusion_service import predict_intrusion
from app.services.malware_service import check_malware_url
from app.services.phishing_service import predict_phishing

router = APIRouter(prefix="/webhooks", tags=["Integrations"])


@router.post("/events", status_code=202)
async def receive_provider_event(
    request: Request,
    x_cybershield_signature: str = Header(default=""),
):
    """Accept `{provider, type, target, features}` signed with HMAC-SHA256."""
    secret = settings.INTEGRATION_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook désactivé : configurez INTEGRATION_WEBHOOK_SECRET côté serveur.")
    body = await request.body()
    if len(body) > 1_048_576:
        raise HTTPException(status_code=413, detail="Événement trop volumineux (1 Mo maximum).")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest().encode("ascii")
    supplied = x_cybershield_signature.removeprefix("sha256=").encode("ascii", errors="ignore")
    if not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="Signature webhook invalide.")
    try:
        event = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Événement JSON invalide.") from exc
    if not isinstance(event, dict) or not isinstance(event.get("provider"), str) or not event["provider"].strip() or len(event["provider"]) > 100:
        raise HTTPException(status_code=422, detail="Le champ provider est obligatoire.")

    kind = event.get("type")
    if not isinstance(kind, str):
        raise HTTPException(status_code=422, detail="Le champ type est obligatoire.")
    if kind in {"phishing", "url"}:
        target = event.get("target")
        if not isinstance(target, str) or not target.strip() or len(target) > 4096:
            raise HTTPException(status_code=422, detail="target doit contenir une URL ou un texte (4096 caractères max).")
        result = predict_phishing(target.strip())
        malware = check_malware_url(target.strip())
        score = max(float(result["score"]), 0.99 if malware["status"] == "malware_found" else 0)
        status = "MALICIOUS" if malware["status"] == "malware_found" else result["status"]
        target = target.strip()
    elif kind == "intrusion":
        features = event.get("features")
        if not isinstance(features, dict) or len(features) > 300:
            raise HTTPException(status_code=422, detail="features doit être un objet de flux réseau (300 champs max).")
        try:
            result = predict_intrusion({"features": features, "source_ip": str(event.get("source_ip", "webhook"))})
        except (RuntimeError, ImportError, OSError) as exc:
            raise HTTPException(status_code=503, detail=f"Modèle IDS indisponible : {exc}") from exc
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=422, detail=f"Caractéristiques réseau invalides : {exc}") from exc
        score, status = float(result["score"]), str(result["status"])
        target = str(event.get("source_ip", event["provider"]))[:255]
    else:
        raise HTTPException(status_code=422, detail="type doit être phishing, url ou intrusion.")

    with SessionLocal() as db:
        analysis = Analysis(type="phishing" if kind in {"phishing", "url"} else "intrusion", target=target,
                            score=score, status=status, user_id=None)
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        return {"accepted": True, "analysis_id": analysis.id, "provider": event["provider"], "status": analysis.status, "score": analysis.score}
