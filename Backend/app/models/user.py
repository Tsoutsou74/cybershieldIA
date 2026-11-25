from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.database.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(120), nullable=False, default="")
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(String(30), nullable=False, default="user")
    email_otp_digest = Column(String(64), nullable=True)
    email_otp_expires_at = Column(DateTime, nullable=True)
    email_otp_challenge_id = Column(String(36), nullable=True)
    email_otp_attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
