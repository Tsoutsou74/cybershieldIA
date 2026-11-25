"""
inspect_dataset.py
============================================================
Première étape du module phishing : inspecte le(s) fichier(s)
CSV bruts dans phishing/datasets/raw/ avant tout nettoyage.

Objectif : confirmer le schéma réel du dataset téléchargé
(PhiUSIIL ou équivalent) avant d'écrire le pipeline de
nettoyage — les noms de colonnes varient parfois légèrement
selon la version/le re-upload Kaggle.

Usage :
    python phishing\\preprocessing\\inspect_dataset.py
============================================================
"""

import sys
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from utils.paths import PHISHING_RAW_DIR
from utils.logging_config import get_logger

logger = get_logger(__name__)

# mots-clés qui indiquent probablement la colonne cible (label)
LABEL_KEYWORDS = ["label", "phish", "result", "class", "target"]

# mots-clés qui indiquent probablement une colonne texte/identifiant
# à exclure des features (pas du signal numérique exploitable tel quel)
TEXT_KEYWORDS = ["url", "domain", "title", "filename", "file_name"]


def main():
    csv_files = sorted(PHISHING_RAW_DIR.glob("*.csv"))
    if not csv_files:
        logger.error("Aucun fichier .csv trouvé dans {}", PHISHING_RAW_DIR)
        logger.info("Téléchargez le dataset PhiUSIIL (ou équivalent) et placez le .csv là.")
        return

    for csv_path in csv_files:
        print("=" * 80)
        print(f"Fichier : {csv_path.name}")
        print("=" * 80)

        df = pd.read_csv(csv_path)
        print(f"\nDimensions : {df.shape[0]:,} lignes x {df.shape[1]} colonnes\n")

        print("--- Colonnes et types ---")
        for col in df.columns:
            print(f"  {col:35s} {str(df[col].dtype):10s}  ex: {df[col].iloc[0]!r}")

        # détection de la colonne label probable
        candidates = [c for c in df.columns if any(k in c.lower() for k in LABEL_KEYWORDS)]
        print(f"\n--- Colonne(s) candidate(s) pour le label : {candidates} ---")
        for col in candidates:
            print(f"\nRépartition de '{col}' :")
            print(df[col].value_counts())

        # détection des colonnes texte à exclure
        text_cols = [c for c in df.columns if any(k in c.lower() for k in TEXT_KEYWORDS)]
        print(f"\n--- Colonnes probablement texte/identifiant (à exclure des features) : {text_cols} ---")

        # colonnes object non capturées ci-dessus (à vérifier manuellement)
        other_object_cols = [
            c for c in df.select_dtypes(include="object").columns
            if c not in text_cols and c not in candidates
        ]
        if other_object_cols:
            print(f"\n⚠ Autres colonnes texte non catégorisées (à vérifier) : {other_object_cols}")
            for col in other_object_cols[:5]:
                print(f"  {col} — valeurs uniques (max 10) : {df[col].unique()[:10]}")

        # valeurs manquantes
        n_missing = df.isna().sum().sum()
        print(f"\nValeurs manquantes totales : {n_missing:,}")
        print(f"Doublons : {df.duplicated().sum():,}")

        print("\n--- Aperçu (5 premières lignes) ---")
        print(df.head())
        print("\n")


if __name__ == "__main__":
    main()