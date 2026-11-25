"""
clean_data.py
============================================================
Nettoie les fichiers CSV bruts de phishing/datasets/raw/ et
standardise le label en une colonne unique 'is_phishing'
(1 = phishing, 0 = légitime), quelle que soit la convention
d'origine du fichier source.

Pourquoi standardiser maintenant : si vous ajoutez d'autres
datasets de phishing plus tard (comme prévu), chacun risque
d'avoir sa PROPRE convention 0/1 pour le label — un des pièges
classiques quand on fusionne plusieurs sources. En réglant ça
ici, une fois pour toutes, dataset par dataset, tout le reste du
pipeline (feature engineering, entraînement) peut travailler sur
'is_phishing' sans jamais se soucier de la source.

Pour ajouter un nouveau fichier source plus tard :
  1. Placez son .csv dans datasets/raw/
  2. Ajoutez une entrée dans LABEL_CONVENTIONS ci-dessous
  3. Relancez ce script

Usage :
    python phishing\\preprocessing\\clean_data.py
============================================================
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from utils.paths import PHISHING_RAW_DIR, PHISHING_PROCESSED_DIR
from utils.logging_config import get_logger

logger = get_logger(__name__)

# --------------------------------------------------------
# Convention de label par source (basée sur un extrait du nom
# de fichier, insensible à la casse). "phishing_value" = la
# valeur brute qui signifie "phishing" dans CETTE source.
# --------------------------------------------------------
LABEL_CONVENTIONS = {
    "phiusiil": {"column": "label", "phishing_value": 0},
    # exemple pour un futur ajout (à adapter une fois le fichier inspecté) :
    # "nom_du_fichier": {"column": "Result", "phishing_value": -1},
}

# colonnes texte brutes à exclure des features (identifiants, contenu
# brut non directement exploitable numériquement).
# NOTE : 'domain' n'est PAS dans cette liste — on la conserve dans le
# fichier nettoyé (mais elle ne sera jamais utilisée comme feature de
# prédiction) pour permettre un split train/test groupé par domaine
# dans prepare_and_split.py, et éviter qu'un même site se retrouve à
# la fois en train et en test (fuite de données par domaine).
TEXT_COLUMNS_TO_DROP = ["filename", "url", "title", "tld"]


def find_label_convention(filename: str):
    name_lower = filename.lower()
    for key, convention in LABEL_CONVENTIONS.items():
        if key in name_lower:
            return convention
    return None


def clean_file(csv_path: Path) -> pd.DataFrame:
    logger.info("Traitement : {}", csv_path.name)
    df = pd.read_csv(csv_path)
    n_original = len(df)
    logger.info("  {:,} lignes brutes", n_original)

    convention = find_label_convention(csv_path.name)
    if convention is None:
        logger.error(
            "Aucune convention de label connue pour '{}'. "
            "Ajoutez une entrée dans LABEL_CONVENTIONS avant de continuer. Fichier ignoré.",
            csv_path.name,
        )
        return None

    label_col = convention["column"]
    if label_col not in df.columns:
        logger.error("Colonne label '{}' introuvable dans {}. Fichier ignoré.", label_col, csv_path.name)
        return None

    # standardisation : is_phishing = 1 si phishing, peu importe la
    # convention d'origine
    df["is_phishing"] = (df[label_col] == convention["phishing_value"]).astype(int)
    n_phishing = df["is_phishing"].sum()
    logger.info("  Répartition standardisée : {:,} phishing / {:,} légitime", n_phishing, n_original - n_phishing)

    # retirer les colonnes texte brutes + la colonne label d'origine
    cols_to_drop = [c for c in df.columns if c.strip().lower() in TEXT_COLUMNS_TO_DROP]
    cols_to_drop += [label_col] if label_col not in cols_to_drop else []
    df = df.drop(columns=[c for c in cols_to_drop if c in df.columns])
    logger.info("  Colonnes texte retirées : {}", cols_to_drop)

    # nettoyage standard : infinis, doublons, valeurs manquantes
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    n_inf = np.isinf(df[numeric_cols]).sum().sum()
    if n_inf > 0:
        df[numeric_cols] = df[numeric_cols].replace([np.inf, -np.inf], np.nan)
        logger.warning("  {} valeurs infinies remplacées par NaN", n_inf)

    n_before = len(df)
    df = df.drop_duplicates()
    n_dropped = n_before - len(df)
    if n_dropped > 0:
        logger.info("  {:,} doublons supprimés", n_dropped)

    n_missing = df.isna().sum().sum()
    if n_missing > 0:
        for col in df.select_dtypes(include=[np.number]).columns:
            df[col] = df[col].fillna(df[col].median())
        logger.warning("  {} valeurs manquantes imputées par la médiane", n_missing)

    logger.info("  ✓ {:,} lignes finales, {} colonnes", len(df), df.shape[1])
    return df


def main():
    csv_files = sorted(PHISHING_RAW_DIR.glob("*.csv"))
    if not csv_files:
        logger.error("Aucun fichier .csv trouvé dans {}", PHISHING_RAW_DIR)
        return

    for csv_path in csv_files:
        print("=" * 80)
        cleaned = clean_file(csv_path)
        if cleaned is None:
            continue

        output_path = PHISHING_PROCESSED_DIR / f"{csv_path.stem}_clean.parquet"
        cleaned.to_parquet(output_path, index=False)
        logger.info("✓ Sauvegardé : {}", output_path)
        print()


if __name__ == "__main__":
    main()