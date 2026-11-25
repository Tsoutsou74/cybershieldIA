"""
prepare_and_split.py
============================================================
Fusionne tous les fichiers *_clean.parquet de phishing/datasets/
processed/ (un seul pour l'instant : PhiUSIIL, mais le script
gère nativement plusieurs fichiers si vous en ajoutez un jour)
et effectue un split train/test stratifié sur 'is_phishing'.

Usage :
    python phishing\\training\\prepare_and_split.py
============================================================
"""

import sys
from pathlib import Path
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from utils.paths import PHISHING_PROCESSED_DIR, PHISHING_FINAL_DIR
from utils.logging_config import get_logger

logger = get_logger(__name__)

TEST_SIZE = 0.2
RANDOM_STATE = 42


def main():
    clean_files = sorted(PHISHING_PROCESSED_DIR.glob("*_clean.parquet"))
    if not clean_files:
        logger.error("Aucun fichier *_clean.parquet trouvé dans {}", PHISHING_PROCESSED_DIR)
        logger.info("Lancez d'abord clean_data.py")
        return

    parts = []
    for f in clean_files:
        df = pd.read_parquet(f)
        parts.append(df)
        logger.info("{} : {:,} lignes", f.name, len(df))

    full_df = pd.concat(parts, axis=0, ignore_index=True)
    logger.info("Dataset fusionné : {:,} lignes, {} colonnes", full_df.shape[0], full_df.shape[1])

    if "is_phishing" not in full_df.columns:
        logger.error("Colonne 'is_phishing' introuvable — vérifiez clean_data.py")
        return

    print("\nRépartition :")
    print(full_df["is_phishing"].value_counts().rename({0: "Légitime", 1: "Phishing"}))

    # --------------------------------------------------------
    # Split GROUPÉ par domaine, pas aléatoire par ligne.
    #
    # Pourquoi : plusieurs lignes peuvent partager le même domaine
    # (sous-pages différentes du même site). Un split aléatoire
    # classique peut placer des lignes du même domaine à la fois en
    # train et en test -> le modèle "reconnaît" le domaine au lieu
    # d'apprendre un vrai pattern de phishing, ce qui gonfle
    # artificiellement le score (c'est un piège documenté sur ce
    # type de dataset).
    # --------------------------------------------------------
    if "Domain" not in full_df.columns:
        logger.warning("Colonne 'Domain' absente — split aléatoire classique utilisé à la place (moins fiable)")
        groups = None
    else:
        groups = full_df["Domain"]
        logger.info("{:,} domaines uniques pour {:,} lignes", groups.nunique(), len(full_df))

    y = full_df["is_phishing"]
    X = full_df.drop(columns=["is_phishing"] + (["Domain"] if "Domain" in full_df.columns else []))

    if groups is not None:
        splitter = GroupShuffleSplit(n_splits=1, test_size=TEST_SIZE, random_state=RANDOM_STATE)
        train_idx, test_idx = next(splitter.split(X, y, groups=groups))
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        # vérification : aucun domaine ne doit apparaître des deux côtés
        overlap = set(groups.iloc[train_idx]) & set(groups.iloc[test_idx])
        logger.info("Domaines en commun train/test : {} (doit être 0)", len(overlap))
    else:
        from sklearn.model_selection import train_test_split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y,
        )

    logger.info("Train : {:,} lignes | Test : {:,} lignes", len(X_train), len(X_test))
    print("\nRépartition train :")
    print(y_train.value_counts().rename({0: "Légitime", 1: "Phishing"}))
    print("Répartition test :")
    print(y_test.value_counts().rename({0: "Légitime", 1: "Phishing"}))

    X_train.to_parquet(PHISHING_FINAL_DIR / "X_train.parquet", index=False)
    X_test.to_parquet(PHISHING_FINAL_DIR / "X_test.parquet", index=False)
    pd.DataFrame({"is_phishing": y_train}).to_parquet(PHISHING_FINAL_DIR / "y_train.parquet", index=False)
    pd.DataFrame({"is_phishing": y_test}).to_parquet(PHISHING_FINAL_DIR / "y_test.parquet", index=False)

    logger.info("✓ Fichiers sauvegardés dans {}", PHISHING_FINAL_DIR)


if __name__ == "__main__":
    main()