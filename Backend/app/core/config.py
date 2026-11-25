from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./cybershield.db"
    SECRET_KEY: str = "15cd02472de4275e667bc1641e740fd2b62550efac4a5164cc741aa6d41661c3"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    SUPERADMIN_EMAIL: str | None = None
    SUPERADMIN_PASSWORD: str | None = None
    FRONTEND_URL: str | None = None
    URLHAUS_AUTH_KEY: str | None = None
    INTEGRATION_WEBHOOK_SECRET: str | None = None
    GMAIL_ADDRESS: str | None = None
    GMAIL_APP_PASSWORD: str | None = None
    GMAIL_SMTP_HOST: str = "smtp.gmail.com"
    GMAIL_SMTP_PORT: int = 587
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
