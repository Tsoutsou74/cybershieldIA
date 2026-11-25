"""
paths.py
============================================================
Chemins centralisés du projet CyberShield AI.

Usage dans un script sous training/, evaluation/, prediction/,
experiments/, explainability/ (un niveau sous AI/) :

    from utils.paths import RAW_DIR, PROCESSED_DIR, FINAL_DIR, MODEL_DIR

Nécessite que AI/ soit sur le PYTHONPATH, ou que le script soit
lancé depuis AI/ (ce qui est déjà votre pratique actuelle :
python training\\train_model.py depuis E:\\...\\AI>).
============================================================
"""

from pathlib import Path

# Racine du projet = dossier contenant utils/, training/, datasets/, etc.
BASE_DIR = Path(__file__).resolve().parent.parent

# Données
DATASETS_DIR = BASE_DIR / "datasets"
RAW_DIR = DATASETS_DIR / "raw"
PROCESSED_DIR = DATASETS_DIR / "processed"
FINAL_DIR = DATASETS_DIR / "final"

# Sorties
MODEL_DIR = BASE_DIR / "models"
EVAL_DIR = BASE_DIR / "evaluation"
EXPLAIN_DIR = BASE_DIR / "explainability"
PREDICTION_DIR = BASE_DIR / "prediction"
EXPERIMENTS_DIR = BASE_DIR / "experiments"
CONFIG_DIR = BASE_DIR / "config"
LOGS_DIR = BASE_DIR / "logs"

# Artefacts nommés (évite de retaper le nom de fichier dans chaque script)
LABEL_ENCODER_PATH = FINAL_DIR / "label_encoder.joblib"
MODEL_PATH = MODEL_DIR / "xgb_ids_model.json"

# ============================================================
# Module Phishing (sous-projet séparé, même dépôt)
# ============================================================
PHISHING_DIR = BASE_DIR / "phishing"
PHISHING_DATASETS_DIR = PHISHING_DIR / "datasets"
PHISHING_RAW_DIR = PHISHING_DATASETS_DIR / "raw"
PHISHING_PROCESSED_DIR = PHISHING_DATASETS_DIR / "processed"
PHISHING_FINAL_DIR = PHISHING_DATASETS_DIR / "final"
PHISHING_MODEL_DIR = PHISHING_DIR / "models"
PHISHING_EVAL_DIR = PHISHING_DIR / "evaluation"
PHISHING_EXPLAIN_DIR = PHISHING_DIR / "explainability"

PHISHING_MODEL_PATH = PHISHING_MODEL_DIR / "xgb_phishing_model.json"

# Crée les dossiers de sortie s'ils n'existent pas encore
for _dir in (PROCESSED_DIR, FINAL_DIR, MODEL_DIR, EVAL_DIR, EXPLAIN_DIR,
             PREDICTION_DIR, EXPERIMENTS_DIR, LOGS_DIR,
             PHISHING_RAW_DIR, PHISHING_PROCESSED_DIR, PHISHING_FINAL_DIR,
             PHISHING_MODEL_DIR, PHISHING_EVAL_DIR, PHISHING_EXPLAIN_DIR):
    _dir.mkdir(parents=True, exist_ok=True)