from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.database.database import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse, ManagedUserUpdate
from app.core.deps import get_current_superadmin

router = APIRouter(dependencies=[Depends(get_current_superadmin)])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/", response_model=UserResponse)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    hashed_password = pwd_context.hash(payload.password)
    user = User(email=payload.email, full_name=payload.full_name.strip(), hashed_password=hashed_password)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: ManagedUserUpdate,
    db: Session = Depends(get_db),
    current_superadmin: User = Depends(get_current_superadmin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    changes = payload.model_dump(exclude_unset=True)
    if user.id == current_superadmin.id and (("email" in changes and changes["email"] != user.email) or changes.get("is_active") is False):
        raise HTTPException(status_code=400, detail="Modifiez votre profil personnel pour gérer votre compte superadmin")
    if "email" in changes and changes["email"] != user.email:
        if db.query(User).filter(User.email == changes["email"]).first():
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
        user.email = changes["email"]
    if "full_name" in changes and changes["full_name"] is not None:
        full_name = changes["full_name"].strip()
        if not full_name:
            raise HTTPException(status_code=422, detail="Le nom complet est obligatoire")
        user.full_name = full_name
    if changes.get("password"):
        user.hashed_password = pwd_context.hash(changes["password"])
    if "is_active" in changes and changes["is_active"] is not None:
        user.is_active = changes["is_active"]

    db.commit()
    db.refresh(user)
    return user
