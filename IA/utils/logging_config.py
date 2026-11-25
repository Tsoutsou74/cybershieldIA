"""
logging_config.py
============================================================
Configuration loguru centralisée.

Usage dans un script :

    from utils.logging_config import get_logger
    logger = get_logger(__name__)

    logger.info("Chargement des données...")
    logger.warning("Colonnes manquantes : {}", missing_cols)
    logger.success("Modèle sauvegardé")
    logger.error("Fichier introuvable : {}", path)

Avantages par rapport à print() :
- horodatage automatique
- niveaux (DEBUG/INFO/WARNING/ERROR) filtrables
- écrit AUSSI dans un fichier logs/cybershield_YYYY-MM-DD.log,
  donc vous gardez une trace de vos entraînements même après
  avoir fermé le terminal (fini le problème qu'on a eu où les
  résultats étaient perdus en fermant la console)
============================================================
"""

import sys
from loguru import logger as _logger

from utils.paths import LOGS_DIR

_configured = False


def get_logger(name: str = "cybershield"):
    """
    Retourne le logger loguru configuré. Sûr à appeler plusieurs
    fois (la configuration ne se fait qu'une seule fois même si
    plusieurs scripts appellent get_logger()).
    """
    global _configured
    if not _configured:
        _logger.remove()  # retire le handler par défaut pour éviter les doublons

        # Console : coloré, niveau INFO et plus
        _logger.add(
            sys.stderr,
            level="INFO",
            format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - <level>{message}</level>",
        )

        # Fichier : tout (DEBUG et plus), un fichier par jour, conservé 14 jours
        _logger.add(
            LOGS_DIR / "cybershield_{time:YYYY-MM-DD}.log",
            level="DEBUG",
            rotation="1 day",
            retention="14 days",
            encoding="utf-8",
        )
        _configured = True

    return _logger.bind(name=name)
