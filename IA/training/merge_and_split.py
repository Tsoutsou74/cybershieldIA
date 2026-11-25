"""
merge_and_split.py
============================================================
Fusionne toutes les paires X/y produites par feature_engineering.py
en un seul dataset, encode les labels de façon cohérente, et
effectue un split train/test stratifié.

Prérequis : avoir déjà lancé feature_engineering.py, qui doit
produire des fichiers du type :
    datasets/processed/<nom>_clean_X.parquet
    datasets/processed/<nom>_clean_y.parquet
============================================================
"""

from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import joblib

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "datasets" / "processed"
FINAL_DIR = BASE_DIR / "datasets" / "final"
FINAL_DIR.mkdir(parents=True, exist_ok=True)

TEST_SIZE = 0.2
RANDOM_STATE = 42

# Colonnes à exclure si elles ont survécu jusqu'ici (identifiants,
# fuite d'information). Ajustez selon vos colonnes réelles.
LEAKY_COLUMNS = [
    "flow id", "source ip", "src ip", "destination ip", "dst ip",
    "timestamp", "source port", "src port",
]


# ============================================================
# CHARGEMENT ET FUSION
# ============================================================
def load_and_merge():
    x_files = sorted(PROCESSED_DIR.glob("*_clean_X.parquet"))
    if not x_files:
        raise FileNotFoundError(
            "Aucun fichier *_clean_X.parquet trouvé. "
            "Lancez d'abord feature_engineering.py."
        )

    X_parts, y_parts = [], []
    for x_path in x_files:
        y_path = x_path.with_name(x_path.name.replace("_X.parquet", "_y.parquet"))
        if not y_path.exists():
            print(f"⚠ y manquant pour {x_path.name}, fichier ignoré")
            continue

        X_part = pd.read_parquet(x_path)
        y_part = pd.read_parquet(y_path)["Label"]

        # retirer d'éventuelles colonnes identifiantes qui auraient survécu
        cols_to_drop = [c for c in X_part.columns if c.strip().lower() in LEAKY_COLUMNS]
        if cols_to_drop:
            print(f"  → colonnes retirées ({x_path.name}) : {cols_to_drop}")
            X_part = X_part.drop(columns=cols_to_drop)

        X_parts.append(X_part)
        y_parts.append(y_part)
        print(f"✓ {x_path.name} : {X_part.shape[0]:,} lignes")

    X = pd.concat(X_parts, axis=0, ignore_index=True)
    y = pd.concat(y_parts, axis=0, ignore_index=True)

    # aligner les colonnes si un fichier avait des colonnes en plus/moins
    X = X.fillna(X.median(numeric_only=True))

    return X, y


# ============================================================
# FUSION DE LABELS
# ============================================================
def merge_web_attack_labels(y: pd.Series) -> pd.Series:
    """
    Fusionne 'Web Attack ... Brute Force' et 'Web Attack ... XSS' en
    une seule classe 'Web Attack HTTP'.

    Justification (voir experiments/analyze_bruteforce_vs_xss.py) :
    ces deux classes sont structurellement indiscernables avec les
    features de flux disponibles (AUC univarié max 0.59, confusion
    60-80% dans les deux sens). 'Web Attack ... Sql Injection' reste
    séparée : elle est déjà distinguée parfaitement (1.00/1.00).

    Matching insensible à l'encodage exact du tiret (le fichier
    source contient un caractère mal décodé, "�" ou équivalent).
    """
    y = y.copy()
    is_brute_force = y.str.contains("Brute Force", case=False, na=False) & y.str.contains("Web Attack", case=False, na=False)
    is_xss = y.str.contains("XSS", case=False, na=False) & y.str.contains("Web Attack", case=False, na=False)
    merged_mask = is_brute_force | is_xss

    n_merged = merged_mask.sum()
    if n_merged > 0:
        print(f"\n✓ Fusion de labels : {n_merged:,} lignes (Brute Force + XSS) -> 'Web Attack HTTP'")
        y.loc[merged_mask] = "Web Attack HTTP"
    else:
        print("\n⚠ Aucune ligne 'Web Attack Brute Force'/'XSS' trouvée à fusionner")

    return y


# ============================================================
# PROGRAMME PRINCIPAL
# ============================================================
def main():
    print("\n--- Fusion des datasets ---")
    X, y = load_and_merge()

    y = merge_web_attack_labels(y)

    print(f"\nDataset fusionné : {X.shape[0]:,} lignes, {X.shape[1]} features")
    print("\nRépartition des labels (avant split) :")
    print(y.value_counts())

    # --------------------------------------------------------
    # Encodage cohérent des labels sur l'ensemble fusionné
    # --------------------------------------------------------
    encoder = LabelEncoder()
    y_encoded = encoder.fit_transform(y)
    joblib.dump(encoder, FINAL_DIR / "label_encoder.joblib")
    print(f"\n✓ Encodeur sauvegardé : {len(encoder.classes_)} classes")
    for i, cls in enumerate(encoder.classes_):
        print(f"    {i} -> {cls}")

    # --------------------------------------------------------
    # Split stratifié
    # --------------------------------------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y_encoded,
    )

    print(f"\nTrain : {X_train.shape[0]:,} lignes")
    print(f"Test  : {X_test.shape[0]:,} lignes")

    # --------------------------------------------------------
    # Sauvegarde
    # --------------------------------------------------------
    X_train.to_parquet(FINAL_DIR / "X_train.parquet", index=False)
    X_test.to_parquet(FINAL_DIR / "X_test.parquet", index=False)
    pd.DataFrame({"Label": y_train}).to_parquet(FINAL_DIR / "y_train.parquet", index=False)
    pd.DataFrame({"Label": y_test}).to_parquet(FINAL_DIR / "y_test.parquet", index=False)

    print(f"\n✓ Fichiers sauvegardés dans {FINAL_DIR}")


if __name__ == "__main__":
    main()