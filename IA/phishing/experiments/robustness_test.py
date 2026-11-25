"""
robustness_test.py
============================================================
Réentraîne un modèle SANS les features de "richesse de contenu"
(NoOfExternalRef, LineOfCode, etc.) qui dominaient le premier
modèle (85% de son poids de décision à elles seules).

Objectif : évaluer si le modèle apprend un vrai pattern
structurel de phishing (URL, sécurité, réputation de domaine)
plutôt que de se reposer sur "cette page a peu de contenu, donc
c'est louche" — un signal qui s'effondre face à un phishing
sophistiqué qui clone entièrement une page légitime.

Ne modifie PAS le modèle principal (phishing/models/xgb_phishing_model.json)
— ce script est un test de diagnostic, pas un remplacement.

Prérequis : avoir lancé prepare_and_split.py.

Usage :
    python phishing\\experiments\\robustness_test.py
============================================================
"""

import sys
from pathlib import Path
import pandas as pd
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from utils.paths import PHISHING_FINAL_DIR, PHISHING_DIR
from utils.logging_config import get_logger

logger = get_logger(__name__)

RANDOM_STATE = 42

# features qui mesurent la "quantité de contenu" de la page plutôt
# qu'un vrai pattern de phishing (structure d'URL, sécurité, réputation)
CONTENT_RICHNESS_FEATURES = [
    "NoOfExternalRef", "NoOfSelfRef", "NoOfEmptyRef",
    "LineOfCode", "LargestLineLength",
    "NoOfImage", "NoOfCSS", "NoOfJS",
]

# également retirée dans le modèle principal (fuite de données)
LEAKY_FEATURES = ["URLSimilarityIndex"]


def main():
    logger.info("Chargement des données")
    X_train = pd.read_parquet(PHISHING_FINAL_DIR / "X_train.parquet")
    X_test = pd.read_parquet(PHISHING_FINAL_DIR / "X_test.parquet")
    y_train = pd.read_parquet(PHISHING_FINAL_DIR / "y_train.parquet")["is_phishing"].to_numpy()
    y_test = pd.read_parquet(PHISHING_FINAL_DIR / "y_test.parquet")["is_phishing"].to_numpy()

    cols_to_drop = [c for c in (LEAKY_FEATURES + CONTENT_RICHNESS_FEATURES) if c in X_train.columns]
    logger.warning("Features retirées pour ce test : {}", cols_to_drop)
    X_train = X_train.drop(columns=cols_to_drop)
    X_test = X_test.drop(columns=cols_to_drop)

    logger.info("Train : {:,} lignes, {} features restantes", X_train.shape[0], X_train.shape[1])
    logger.info("Features conservées : {}", list(X_train.columns))

    scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()

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

    logger.info("Entraînement (sans les features de richesse de contenu)...")
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=20)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    print("\n" + "=" * 60)
    print("RÉSULTAT DU TEST DE ROBUSTESSE")
    print("(sans les features de richesse de contenu)")
    print("=" * 60)

    print("\n--- Rapport de classification ---")
    print(classification_report(y_test, y_pred, target_names=["Légitime", "Phishing"]))

    auc = roc_auc_score(y_test, y_proba)
    print(f"ROC-AUC : {auc:.4f}")

    cm = confusion_matrix(y_test, y_pred)
    cm_df = pd.DataFrame(cm, index=["Vrai Légitime", "Vrai Phishing"], columns=["Prédit Légitime", "Prédit Phishing"])
    print("\n--- Matrice de confusion ---")
    print(cm_df)

    importances = pd.Series(model.feature_importances_, index=X_train.columns)
    print("\n--- Top 20 features (sans richesse de contenu) ---")
    print(importances.sort_values(ascending=False).head(20))

    # sauvegarde séparée, ne touche pas au modèle principal
    output_dir = PHISHING_DIR / "experiments"
    output_dir.mkdir(parents=True, exist_ok=True)
    model.save_model(output_dir / "xgb_phishing_robust.json")
    logger.info("✓ Modèle de test sauvegardé (séparément) : {}", output_dir / "xgb_phishing_robust.json")


if __name__ == "__main__":
    main()
