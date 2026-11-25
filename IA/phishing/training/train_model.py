"""
train_model.py
============================================================
Entraîne un modèle XGBoost binaire (phishing vs légitime).

Prérequis : avoir lancé prepare_and_split.py au préalable.

Usage :
    python phishing\\training\\train_model.py
============================================================
"""

import sys
from pathlib import Path
import pandas as pd
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from utils.paths import PHISHING_FINAL_DIR, PHISHING_MODEL_DIR, PHISHING_MODEL_PATH
from utils.logging_config import get_logger

logger = get_logger(__name__)

RANDOM_STATE = 42


def main():
    logger.info("Chargement des données")
    X_train = pd.read_parquet(PHISHING_FINAL_DIR / "X_train.parquet")
    X_test = pd.read_parquet(PHISHING_FINAL_DIR / "X_test.parquet")
    y_train = pd.read_parquet(PHISHING_FINAL_DIR / "y_train.parquet")["is_phishing"].to_numpy()
    y_test = pd.read_parquet(PHISHING_FINAL_DIR / "y_test.parquet")["is_phishing"].to_numpy()

    logger.info("Train : {:,} lignes, {} features", X_train.shape[0], X_train.shape[1])
    logger.info("Test  : {:,} lignes", X_test.shape[0])

    # --------------------------------------------------------
    # Retrait des features qui causent une fuite de données.
    #
    # Le premier entraînement donnait un ROC-AUC parfait (1.0000,
    # zéro erreur sur 47k lignes de test) — signe classique de
    # leakage, pas d'un vrai bon modèle. URLSimilarityIndex mesure
    # la similarité avec une base de sites légitimes connus, donc
    # encode quasiment directement le label lui-même plutôt qu'un
    # vrai pattern de phishing.
    # --------------------------------------------------------
    LEAKY_FEATURES = ["URLSimilarityIndex"]
    cols_to_drop = [c for c in LEAKY_FEATURES if c in X_train.columns]
    if cols_to_drop:
        logger.warning("Retrait de features à fuite de données : {}", cols_to_drop)
        X_train = X_train.drop(columns=cols_to_drop)
        X_test = X_test.drop(columns=cols_to_drop)

    # léger déséquilibre (134850 légitime / 100945 phishing) -> pondération
    # automatique plutôt qu'un réglage manuel comme pour l'IDS réseau
    scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()
    logger.info("scale_pos_weight = {:.3f}", scale_pos_weight)

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        tree_method="hist",
        scale_pos_weight=scale_pos_weight,
        early_stopping_rounds=20,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )

    logger.info("Entraînement...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=20,
    )

    # --------------------------------------------------------
    # Évaluation
    # --------------------------------------------------------
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    print("\n--- Rapport de classification ---")
    report = classification_report(y_test, y_pred, target_names=["Légitime", "Phishing"])
    print(report)

    auc = roc_auc_score(y_test, y_proba)
    print(f"ROC-AUC : {auc:.4f}")

    cm = confusion_matrix(y_test, y_pred)
    cm_df = pd.DataFrame(cm, index=["Vrai Légitime", "Vrai Phishing"], columns=["Prédit Légitime", "Prédit Phishing"])
    print("\n--- Matrice de confusion ---")
    print(cm_df)
    cm_df.to_csv(PHISHING_MODEL_DIR / "confusion_matrix.csv")

    # --------------------------------------------------------
    # Importance des features
    # --------------------------------------------------------
    importances = pd.Series(model.feature_importances_, index=X_train.columns)
    top_features = importances.sort_values(ascending=False).head(20)
    print("\n--- Top 20 features les plus importantes ---")
    print(top_features)

    # --------------------------------------------------------
    # Sauvegarde
    # --------------------------------------------------------
    model.save_model(PHISHING_MODEL_PATH)
    logger.info("✓ Modèle sauvegardé : {}", PHISHING_MODEL_PATH)


if __name__ == "__main__":
    main()