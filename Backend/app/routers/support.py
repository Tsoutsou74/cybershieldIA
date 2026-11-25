import unicodedata
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_superadmin, get_current_user
from app.database.database import get_db
from app.models.support_message import SupportMessage
from app.models.user import User
from app.schemas.support import (
    SupportChatRequest,
    SupportChatResponse,
    SupportMessageResponse,
    SupportReplyRequest,
)

router = APIRouter(prefix="/support", tags=["Support"])


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    return "".join(char for char in normalized if not unicodedata.combining(char))


def _automatic_reply(message: str) -> tuple[str, bool]:
    text = _normalize(message)

    if any(term in text for term in ("phishing", "url", "lien", "site suspect", "message suspect")):
        return (
            "Ouvrez Â« Analyse IA Â», choisissez lâ€™analyse de phishing, puis collez lâ€™URL ou le message Ã  vÃ©rifier. Le rÃ©sultat sera aussi enregistrÃ© dans votre historique.",
            False,
        )
    if any(term in text for term in ("intrusion", "reseau", "flux", "paquet", "adresse ip")):
        return (
            "Ouvrez Â« Analyse IA Â», choisissez lâ€™analyse rÃ©seau et renseignez lâ€™adresse IP source, la taille du paquet et les indicateurs rÃ©seau. Vous pouvez aussi importer un fichier CSV compatible.",
            False,
        )
    if any(term in text for term in ("historique", "resultat", "resultats", "analyse precedente")):
        return (
            "La page Â« Historique Â» contient les rÃ©sultats enregistrÃ©s sur votre compte. Ouvrez une analyse pour retrouver sa cible, son statut et son score.",
            False,
        )
    if any(term in text for term in ("alerte", "alertes", "menace", "suspect")):
        return (
            "Consultez la page Â« Alertes Â» pour retrouver les rÃ©sultats suspects. Une analyse classÃ©e Â« Ã€ vÃ©rifier Â» demande une vÃ©rification complÃ©mentaire.",
            False,
        )
    if any(term in text for term in ("connexion", "connecter", "identifiant", "login")):
        return (
            "VÃ©rifiez lâ€™adresse e-mail saisie, puis reconnectez-vous depuis la page de connexion. Si le problÃ¨me continue, dÃ©crivez le message dâ€™erreur : je transmettrai votre demande au support.",
            False,
        )
    if any(term in text for term in ("mot de passe", "password", "compte bloque", "compte bloquÃ©")):
        return (
            "La rÃ©initialisation automatique du mot de passe nâ€™est pas disponible dans lâ€™application. Votre demande est transmise Ã  lâ€™Ã©quipe support pour quâ€™elle puisse vous aider.",
            True,
        )
    if any(term in text for term in ("csv", "fichier", "importer")):
        return (
            "Dans Â« Analyse IA Â», choisissez lâ€™analyse rÃ©seau puis importez votre fichier CSV. Les colonnes doivent correspondre aux caractÃ©ristiques dâ€™un flux rÃ©seau.",
            False,
        )

    return (
        "Je nâ€™ai pas trouvÃ© de rÃ©ponse automatique adaptÃ©e. Votre message est transmis Ã  lâ€™Ã©quipe superadmin pour examen ; vous nâ€™avez pas besoin dâ€™attendre une rÃ©ponse humaine pour continuer Ã  utiliser lâ€™application.",
        True,
    )


def _to_response(item: SupportMessage, user_email: str | None = None) -> SupportMessageResponse:
    return SupportMessageResponse(
        id=item.id,
        user_id=item.user_id,
        sender=item.sender,
        message=item.message,
        escalated=item.escalated,
        created_at=item.created_at,
        user_email=user_email,
    )


@router.get("/chat", response_model=list[SupportMessageResponse])
def get_chat(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SupportMessageResponse]:
    messages = (
        db.query(SupportMessage)
        .filter(SupportMessage.user_id == current_user.id)
        .order_by(SupportMessage.created_at.desc(), SupportMessage.id.desc())
        .limit(200)
        .all()
    )
    return [_to_response(item) for item in reversed(messages)]


@router.post("/chat", response_model=SupportChatResponse)
def send_chat_message(
    payload: SupportChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SupportChatResponse:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Le message ne peut pas Ãªtre vide.")

    # Le chat est une messagerie directe avec l’équipe superadmin.
    # Chaque message utilisateur est transmis sans réponse automatique.
    is_escalated = True
    created_at = datetime.utcnow()
    user_message = SupportMessage(
        user_id=current_user.id,
        sender="user",
        message=message,
        escalated=is_escalated,
        created_at=created_at,
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)
    return SupportChatResponse(
        messages=[_to_response(user_message)],
        escalated=is_escalated,
    )


@router.get("/inbox", response_model=list[SupportMessageResponse])
def get_support_inbox(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin),
) -> list[SupportMessageResponse]:
    messages = (
        db.query(SupportMessage, User.email)
        .join(User, User.id == SupportMessage.user_id)
        .filter(SupportMessage.sender == "user", SupportMessage.escalated.is_(True))
        .order_by(SupportMessage.created_at.desc())
        .limit(100)
        .all()
    )
    return [_to_response(item, email) for item, email in messages]


def _get_escalated_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    has_escalated_message = db.query(SupportMessage.id).filter(
        SupportMessage.user_id == user_id,
        SupportMessage.sender == "user",
        SupportMessage.escalated.is_(True),
    ).first()
    if user is None or has_escalated_message is None:
        raise HTTPException(status_code=404, detail="Conversation support introuvable")
    return user


@router.get("/inbox/{user_id}", response_model=list[SupportMessageResponse])
def get_support_conversation(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin),
) -> list[SupportMessageResponse]:
    user = _get_escalated_user(db, user_id)
    messages = (
        db.query(SupportMessage)
        .filter(SupportMessage.user_id == user.id)
        .order_by(SupportMessage.created_at.asc(), SupportMessage.id.asc())
        .limit(200)
        .all()
    )
    return [_to_response(item, user.email) for item in messages]


@router.post("/inbox/{user_id}", response_model=SupportMessageResponse)
def reply_to_support_conversation(
    user_id: int,
    payload: SupportReplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin),
) -> SupportMessageResponse:
    user = _get_escalated_user(db, user_id)
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Le message ne peut pas être vide.")

    reply = SupportMessage(
        user_id=user.id,
        sender="superadmin",
        message=message,
        escalated=True,
        created_at=datetime.utcnow(),
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return _to_response(reply, user.email)
