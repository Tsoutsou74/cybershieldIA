"""
predict.py
============================================================
Applique le modèle IDS entraîné à du nouveau trafic réseau.

Usage :
    python prediction\\predict.py chemin\\vers\\nouveau_trafic.parquet
    python prediction\\predict.py chemin\\vers\\nouveau_trafic.csv

Le fichier d'entrée doit contenir les mêmes colonnes de flux
réseau que le dataset d'entraînement (mêmes noms que dans
datasets/raw/*.parquet, avant nettoyage). La colonne Label,
si présente, est ignorée (elle n'est utile que pour comparer
si vous testez sur des données déjà étiquetées).

Prérequis : avoir lancé merge_and_split.py ET train_model.py.
============================================================
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
import pyarrow.parquet as pq
from xgboost import XGBClassifier

# ajoute la racine du projet (AI/) au chemin Python, pour pouvoir
# importer utils/ même si predict.py est lancé directement
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.paths import FINAL_DIR, MODEL_PATH, PREDICTION_DIR, LABEL_ENCODER_PATH
from utils.logging_config import get_logger
from utils.data_cleaning import clean_column_names

logger = get_logger(__name__)

# ============================================================
# CONFIGURATION
# ============================================================
# Seuil de confiance en dessous duquel on signale une prédiction
# comme incertaine plutôt que de la prendre pour argent comptant
CONFIDENCE_THRESHOLD = 0.60


# ============================================================
# CHARGEMENT DES ARTEFACTS D'ENTRAÎNEMENT
# ============================================================
def load_artifacts():
    model = XGBClassifier()
    model.load_model(MODEL_PATH)
    encoder = joblib.load(LABEL_ENCODER_PATH)

    # colonnes attendues par le modèle, dans le bon ordre,
    # récupérées depuis le schéma du dataset d'entraînement
    # (lecture du schéma seul, sans charger les 1,8M lignes)
    schema = pq.ParquetFile(FINAL_DIR / "X_train.parquet").schema_arrow
    feature_columns = [name for name in schema.names]

    return model, encoder, feature_columns


# ============================================================
# PRÉPARATION DES DONNÉES D'ENTRÉE
# ============================================================
def load_input(path: Path) -> pd.DataFrame:
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    elif path.suffix == ".csv":
        return pd.read_csv(path)
    else:
        raise ValueError(f"Format non supporté : {path.suffix} (utilisez .parquet ou .csv)")


def prepare_input(df: pd.DataFrame, feature_columns: list) -> pd.DataFrame:
    logger.info("Préparation des données d'entrée")

    # nettoyer les noms de colonnes comme clean_data.py : espaces et
    # slashs remplacés par underscore (ex: "Flow Bytes/s" -> "Flow_Bytes_s")
    # -> fonction partagée dans utils/data_cleaning.py, garantit que
    # predict.py reste toujours cohérent avec le reste du pipeline
    df = clean_column_names(df)

    # retirer la colonne Label si présente (pas utile pour la prédiction)
    for col in list(df.columns):
        if col.strip().lower() == "label":
            df = df.drop(columns=[col])

    # convertir en numérique
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.replace([np.inf, -np.inf], np.nan)

    # aligner sur les colonnes attendues par le modèle :
    # - colonnes manquantes -> ajoutées à 0
    # - colonnes en trop -> ignorées
    # - ordre -> identique à l'entraînement (obligatoire pour XGBoost)
    missing = set(feature_columns) - set(df.columns)
    extra = set(df.columns) - set(feature_columns)
    if missing:
        logger.warning("Colonnes manquantes, complétées à 0 : {}", sorted(missing))
        for col in missing:
            df[col] = 0.0
    if extra:
        logger.warning("Colonnes ignorées (absentes du modèle) : {}", sorted(extra))

    df = df[feature_columns]

    # imputation des valeurs manquantes restantes par la médiane du lot
    df = df.fillna(df.median(numeric_only=True)).fillna(0)

    logger.info("{:,} lignes prêtes pour la prédiction", df.shape[0])
    return df


# ============================================================
# PRÉDICTION
# ============================================================
def predict(model, encoder, X: pd.DataFrame) -> pd.DataFrame:
    print("\n--- Prédiction ---")
    proba = model.predict_proba(X)
    pred_idx = proba.argmax(axis=1)
    confidence = proba.max(axis=1)

    results = pd.DataFrame({
        "predicted_label": encoder.inverse_transform(pred_idx),
        "confidence": confidence,
        "is_malicious": encoder.inverse_transform(pred_idx) != "Benign",
        "low_confidence": confidence < CONFIDENCE_THRESHOLD,
    })

    return results


# ============================================================
# PROGRAMME PRINCIPAL
# ============================================================
def main():
    if len(sys.argv) < 2:
        print("Usage : python prediction\\predict.py chemin\\vers\\fichier.parquet")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    if not input_path.exists():
        print(f"Fichier introuvable : {input_path}")
        sys.exit(1)

    logger.info("Chargement du modèle")
    model, encoder, feature_columns = load_artifacts()
    logger.info("Modèle chargé, {} features attendues, {} classes", len(feature_columns), len(encoder.classes_))

    raw_df = load_input(input_path)
    X = prepare_input(raw_df, feature_columns)
    results = predict(model, encoder, X)

    # --------------------------------------------------------
    # Résumé
    # --------------------------------------------------------
    print("\n--- Résumé des prédictions ---")
    print(results["predicted_label"].value_counts())

    n_malicious = results["is_malicious"].sum()
    n_low_conf = results["low_confidence"].sum()
    print(f"\nTrafic suspect détecté : {n_malicious:,} / {len(results):,} lignes")
    print(f"Prédictions peu fiables (confiance < {CONFIDENCE_THRESHOLD:.0%}) : {n_low_conf:,}")

    # --------------------------------------------------------
    # Sauvegarde
    # --------------------------------------------------------
    output_path = PREDICTION_DIR / f"{input_path.stem}_predictions.csv"
    results.to_csv(output_path, index=False)
    print(f"\n✓ Résultats sauvegardés : {output_path}")

    # extrait des cas les plus suspects (malveillant + haute confiance)
    top_alerts = (
        results[results["is_malicious"]]
        .sort_values("confidence", ascending=False)
        .head(20)
    )
    if not top_alerts.empty:
        print("\n--- Top 20 alertes (confiance la plus haute) ---")
        print(top_alerts)


if __name__ == "__main__":
    main()