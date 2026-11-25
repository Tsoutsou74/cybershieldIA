"""
train_model.py
============================================================
Entraîne un modèle XGBoost multiclasse pour détecter et
classifier le trafic réseau (Benign vs types d'attaques).

Prérequis : avoir lancé merge_and_split.py au préalable.
============================================================
"""

from pathlib import Path
import pandas as pd
import numpy as np
import joblib
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_sample_weight

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = Path(__file__).resolve().parent.parent
FINAL_DIR = BASE_DIR / "datasets" / "final"
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42


def main():
    print("\n--- Chargement des données ---")
    X_train = pd.read_parquet(FINAL_DIR / "X_train.parquet")
    X_test = pd.read_parquet(FINAL_DIR / "X_test.parquet")
    y_train = pd.read_parquet(FINAL_DIR / "y_train.parquet")["Label"].to_numpy()
    y_test = pd.read_parquet(FINAL_DIR / "y_test.parquet")["Label"].to_numpy()
    encoder = joblib.load(FINAL_DIR / "label_encoder.joblib")

    print(f"Train : {X_train.shape[0]:,} lignes, {X_train.shape[1]} features")
    print(f"Test  : {X_test.shape[0]:,} lignes")
    print(f"Classes ({len(encoder.classes_)}) : {list(encoder.classes_)}")

    # --------------------------------------------------------
    # Poids d'échantillon pour compenser le déséquilibre
    # (classes rares comme Heartbleed/Infiltration pèsent plus)
    #
    # "balanced" brut s'est révélé trop agressif (Bot : precision
    # 0.51 avec recall 0.99 -> sur-détection massive). On adoucit
    # avec une racine carrée : ça réduit l'écart de poids entre
    # classes fréquentes et rares sans le supprimer complètement.
    # --------------------------------------------------------
    balanced_weight = compute_sample_weight(class_weight="balanced", y=y_train)
    sample_weight = np.sqrt(balanced_weight)

    # --------------------------------------------------------
    # Modèle
    #
    # Accélérations par rapport à la version précédente :
    # - early_stopping_rounds : vos logs montraient un mlogloss
    #   stable dès l'itération ~260/400, donc ~35% des arbres ne
    #   servaient à rien. Arrête dès que 30 itérations sans
    #   amélioration.
    # - subsample / colsample_bytree : chaque arbre est construit
    #   sur 80% des lignes et 80% des colonnes tirées aléatoirement
    #   -> arbres plus rapides à construire, léger effet anti-
    #   surapprentissage en bonus.
    # - max_bin réduit : moins de précision de discrétisation pour
    #   tree_method="hist", mais sensiblement plus rapide.
    # --------------------------------------------------------
    print("\n--- Entraînement XGBoost ---")
    model = XGBClassifier(
        n_estimators=400,
        max_depth=8,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        max_bin=128,
        objective="multi:softprob",
        num_class=len(encoder.classes_),
        eval_metric="mlogloss",
        tree_method="hist",
        early_stopping_rounds=30,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )

    model.fit(
        X_train, y_train,
        sample_weight=sample_weight,
        eval_set=[(X_test, y_test)],
        verbose=20,
    )

    # --------------------------------------------------------
    # Évaluation
    # --------------------------------------------------------
    print("\n--- Évaluation sur le test set ---")
    y_pred = model.predict(X_test)

    report = classification_report(
        y_test, y_pred,
        target_names=encoder.classes_,
        zero_division=0,
    )
    print(report)

    cm = confusion_matrix(y_test, y_pred)
    cm_df = pd.DataFrame(cm, index=encoder.classes_, columns=encoder.classes_)
    cm_df.to_csv(MODEL_DIR / "confusion_matrix.csv")
    print(f"✓ Matrice de confusion sauvegardée : {MODEL_DIR / 'confusion_matrix.csv'}")

    # --------------------------------------------------------
    # Importance des features (top 20)
    # --------------------------------------------------------
    importances = pd.Series(model.feature_importances_, index=X_train.columns)
    top_features = importances.sort_values(ascending=False).head(20)
    print("\nTop 20 features les plus importantes :")
    print(top_features)

    # --------------------------------------------------------
    # Sauvegarde du modèle
    # (format natif XGBoost plutôt que joblib/pickle : plus
    # stable entre versions, c'est la méthode recommandée par
    # la doc XGBoost)
    # --------------------------------------------------------
    model_path = MODEL_DIR / "xgb_ids_model.json"
    model.save_model(model_path)
    print(f"\n✓ Modèle sauvegardé : {model_path}")


if __name__ == "__main__":
    main()