from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Remplacez par votre URL de connexion MySQL
# DATABASE_URL = "mysql+pymysql://root:@localhost/cyberhieldia"
DATABASE_URL = settings.DATABASE_URL

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    Dépendance FastAPI : ouvre une session DB pour la durée de la
    requête, la ferme toujours après (même en cas d'erreur).
    Utilisation dans un router : db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
