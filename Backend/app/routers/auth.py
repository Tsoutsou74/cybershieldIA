import hashlib
import hmac
import secrets
import smtplib
import ssl
from email.message import EmailMessage
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, LoginRequest, EmailOtpCode, UserResponse, Token, ProfileUpdate
from app.core.deps import get_current_user
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _issue_token(user: User) -> dict:
    token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role}


def _send_login_code(user: User, db: Session) -> str:
    if not settings.GMAIL_ADDRESS or not settings.GMAIL_APP_PASSWORD:
        raise HTTPException(status_code=503, detail="L’envoi des codes par e-mail n’est pas configuré sur le serveur.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    digest = hmac.new(settings.SECRET_KEY.encode(), f"{user.id}:{user.email}:{code}".encode(), hashlib.sha256).hexdigest()
    challenge_id = str(uuid4())
    user.email_otp_digest = digest
    user.email_otp_expires_at = datetime.utcnow() + timedelta(minutes=5)
    user.email_otp_challenge_id = challenge_id
    user.email_otp_attempts = 0
    db.commit()
    token = create_access_token(
        {"sub": user.email, "purpose": "email_otp", "jti": challenge_id},
        expires_delta=timedelta(minutes=5),
    )
    message = EmailMessage()
    message["Subject"] = "Votre code de connexion CyberShield AI"
    message["From"] = settings.GMAIL_ADDRESS
    message["To"] = user.email
    message.set_content(
        f"Bonjour,\n\nVotre code de vérification CyberShield AI est : {code}\n\n"
        "Ce code expire dans 5 minutes. Si vous n’êtes pas à l’origine de cette connexion, ignorez ce message."
    )
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.GMAIL_SMTP_HOST, settings.GMAIL_SMTP_PORT, timeout=15) as smtp:
            smtp.starttls(context=context)
            smtp.login(settings.GMAIL_ADDRESS, settings.GMAIL_APP_PASSWORD.replace(" ", ""))
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise HTTPException(status_code=502, detail="Impossible d’envoyer le code de vérification par e-mail.") from exc
    return token


def _valid_email_code(user: User, code: str) -> bool:
    expected = user.email_otp_digest or ""
    actual = hmac.new(settings.SECRET_KEY.encode(), f"{user.id}:{user.email}:{code}".encode(), hashlib.sha256).hexdigest()
    return bool(expected) and hmac.compare_digest(expected, actual)


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email déjà enregistré")
    new_user = User(email=user_data.email, full_name=user_data.full_name.strip(), hashed_password=get_password_hash(user_data.password), role="user")
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login")
def login(user_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not user.is_active or not verify_password(user_data.password, user.hashed_password) or user.role != "user":
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    challenge = _send_login_code(user, db)
    return {
        "requires_2fa": True,
        "challenge_token": challenge,
        "email": user.email,
    }


@router.post("/superadmin/login")
def superadmin_login(user_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not user.is_active or not verify_password(user_data.password, user.hashed_password) or user.role != "superadmin":
        raise HTTPException(status_code=401, detail="Identifiants superadmin invalides")
    challenge = _send_login_code(user, db)
    return {
        "requires_2fa": True,
        "challenge_token": challenge,
        "email": user.email,
    }


@router.post("/2fa/verify", response_model=Token)
def verify_second_factor(code: EmailOtpCode, challenge_token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(challenge_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        if payload.get("purpose") != "email_otp" or not email:
            raise JWTError("Invalid challenge")
    except JWTError:
        raise HTTPException(status_code=401, detail="Le code a expiré. Recommencez la connexion.")
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Compte indisponible")
    if (not user.email_otp_expires_at or user.email_otp_expires_at < datetime.utcnow()
            or payload.get("jti") != user.email_otp_challenge_id):
        raise HTTPException(status_code=401, detail="Le code a expiré. Recommencez la connexion.")
    if user.email_otp_attempts >= 5:
        raise HTTPException(status_code=429, detail="Trop de tentatives. Recommencez la connexion.")
    if not _valid_email_code(user, code.code):
        user.email_otp_attempts += 1
        db.commit()
        raise HTTPException(status_code=401, detail="Code de vérification invalide")
    user.email_otp_digest = None
    user.email_otp_expires_at = None
    user.email_otp_challenge_id = None
    user.email_otp_attempts = 0
    db.commit()
    return _issue_token(user)


@router.get("/me", response_model=UserResponse)
def current_account(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_current_account(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=422, detail="Le nom complet est obligatoire")
    current_user.full_name = full_name
    if payload.password:
        current_user.hashed_password = get_password_hash(payload.password)
    db.commit()
    db.refresh(current_user)
    return current_user
