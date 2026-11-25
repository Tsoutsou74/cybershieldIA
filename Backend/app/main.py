import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.database import Base, engine, SessionLocal

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from sqlalchemy import inspect, text

# Crée les tables en base si elles n'existent pas encore
# (lit tous les modèles déclarés dans app/database/models.py,
# d'où l'import ci-dessous — nécessaire même s'il semble inutilisé)
from app.database import models  # noqa: F401

Base.metadata.create_all(bind=engine)


def _ensure_role_column_and_superadmin():
    columns = {column["name"] for column in inspect(engine).get_columns("users")}
    with engine.begin() as connection:
        if "role" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(30) NOT NULL DEFAULT 'user'"))
        if "full_name" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR(120) NOT NULL DEFAULT ''"))
        if "email_otp_digest" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_otp_digest VARCHAR(64)"))
        if "email_otp_expires_at" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_otp_expires_at TIMESTAMP"))
        if "email_otp_challenge_id" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_otp_challenge_id VARCHAR(36)"))
        if "email_otp_attempts" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_otp_attempts INTEGER NOT NULL DEFAULT 0"))

    if not settings.SUPERADMIN_EMAIL or not settings.SUPERADMIN_PASSWORD:
        return

    with SessionLocal() as db:
        email = settings.SUPERADMIN_EMAIL.strip().lower()
        admin = db.query(User).filter(User.email == email).first()
        if admin is None:
            admin = User(
                email=email,
                hashed_password=get_password_hash(settings.SUPERADMIN_PASSWORD),
                role="superadmin",
            )
            db.add(admin)
        else:
            admin.role = "superadmin"
        db.commit()


_ensure_role_column_and_superadmin()

from app.services.threat_feed_service import run_feed_refresh_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    feed_task = asyncio.create_task(run_feed_refresh_loop())
    try:
        yield
    finally:
        feed_task.cancel()
        with suppress(asyncio.CancelledError):
            await feed_task


app = FastAPI(
    title="CyberShield AI Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS ouvert pour le développement — à restreindre à des origines
# précises avant un déploiement en production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
def root():
    return {"service": "CyberShield AI Backend", "docs": "/docs"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


# --------------------------------------------------------------
# Routers
# --------------------------------------------------------------
from app.routers import users
app.include_router(users.router, prefix="/users", tags=["users"])

from app.routers import auth, phishing, intrusion, history, support, subscriptions, threat_intel, webhooks
app.include_router(auth.router)
app.include_router(phishing.router)
app.include_router(intrusion.router)
app.include_router(history.router)
app.include_router(support.router)
app.include_router(subscriptions.router)
app.include_router(threat_intel.router)
app.include_router(webhooks.router)
