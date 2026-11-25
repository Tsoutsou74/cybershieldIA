"""
analyze_bruteforce_vs_xss.py
============================================================
Analyse ciblée : quelles features distinguent le mieux
"Web Attack Brute Force" de "Web Attack XSS" ?

Le modèle multiclasse global confond ces deux classes à 60-80%
(voir confusion_matrix_normalized.png). Cette analyse isole les
deux classes pour voir si un signal discriminant existe malgré
tout dans les 77 features de flux, ou si la confusion est
structurelle (info absente du dataset).

Produit dans experiments/ :
  - classification_report_binaire.csv : performance d'un mini-
    classifieur Brute Force vs XSS
  - feature_ranking.csv : pour chaque feature, son AUC univarié
    (pouvoir discriminant seul) ET son importance dans le modèle
    binaire (effet en combinaison avec les autres features)
  - top_features_comparison.png : distribution des 6 features
    les plus discriminantes, une classe vs l'autre

Prérequis : avoir lancé merge_and_split.py.
============================================================
"""

from pathlib import Path
import pandas as pd
import numpy as np
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = Path(__file__).resolve().parent.parent
FINAL_DIR = BASE_DIR / "datasets" / "final"
EXPERIMENTS_DIR = BASE_DIR / "experiments"
EXPERIMENTS_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42

# noms exacts tels qu'ils apparaissent dans encoder.classes_
# (avec l'encodage corrompu du tiret cadratin, à ajuster si vous
# avez corrigé les labels entre temps)
CLASS_A = "Web Attack \ufffd Brute Force"
CLASS_B = "Web Attack \ufffd XSS"


def main():
    print("--- Chargement des données ---")
    encoder = joblib.load(FINAL_DIR / "label_encoder.joblib")
    X_train = pd.read_parquet(FINAL_DIR / "X_train.parquet")
    X_test = pd.read_parquet(FINAL_DIR / "X_test.parquet")
    y_train = pd.read_parquet(FINAL_DIR / "y_train.parquet")["Label"].to_numpy()
    y_test = pd.read_parquet(FINAL_DIR / "y_test.parquet")["Label"].to_numpy()

    # fusionner train+test pour avoir un maximum d'échantillons
    # (ces classes sont rares, on refait un split propre juste après)
    X_all = pd.concat([X_train, X_test], axis=0, ignore_index=True)
    y_all = np.concatenate([y_train, y_test])
    y_all_labels = encoder.inverse_transform(y_all)

    # --------------------------------------------------------
    # Isoler les deux classes
    # --------------------------------------------------------
    mask = np.isin(y_all_labels, [CLASS_A, CLASS_B])
    if mask.sum() == 0:
        print("⚠ Aucune ligne trouvée pour ces classes. Noms disponibles :")
        for cls in encoder.classes_:
            if "Web Attack" in cls or "Web" in cls:
                print(f"    {cls!r}")
        return

    X_sub = X_all[mask].reset_index(drop=True)
    y_sub_labels = y_all_labels[mask]
    y_binary = (y_sub_labels == CLASS_B).astype(int)  # 1 = XSS, 0 = Brute Force

    print(f"Brute Force : {(y_binary == 0).sum():,} lignes")
    print(f"XSS         : {(y_binary == 1).sum():,} lignes")

    # --------------------------------------------------------
    # 1. AUC univarié par feature (pouvoir discriminant SEUL,
    #    sans interaction avec les autres features)
    # --------------------------------------------------------
    print("\n--- Calcul de l'AUC univarié par feature ---")
    univariate_auc = {}
    for col in X_sub.columns:
        try:
            auc = roc_auc_score(y_binary, X_sub[col])
            # une feature peut être discriminante "à l'envers"
            # (AUC < 0.5 = discriminante mais dans l'autre sens)
            univariate_auc[col] = max(auc, 1 - auc)
        except ValueError:
            univariate_auc[col] = np.nan

    auc_series = pd.Series(univariate_auc, name="univariate_auc").sort_values(ascending=False)

    # --------------------------------------------------------
    # 2. Mini-classifieur binaire (capte les interactions entre
    #    features, pas seulement l'effet individuel)
    # --------------------------------------------------------
    print("\n--- Entraînement du classifieur binaire ---")
    X_tr, X_te, y_tr, y_te = train_test_split(
        X_sub, y_binary, test_size=0.25, random_state=RANDOM_STATE, stratify=y_binary
    )

    model = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        eval_metric="logloss",
        random_state=RANDOM_STATE,
    )
    model.fit(X_tr, y_tr)
    y_pred = model.predict(X_te)

    report = classification_report(y_te, y_pred, target_names=["Brute Force", "XSS"], zero_division=0)
    print(report)
    pd.DataFrame(
        classification_report(y_te, y_pred, target_names=["Brute Force", "XSS"], output_dict=True, zero_division=0)
    ).transpose().to_csv(EXPERIMENTS_DIR / "classification_report_binaire.csv")

    model_importance = pd.Series(model.feature_importances_, index=X_sub.columns, name="model_importance")

    # --------------------------------------------------------
    # 3. Combiner et sauvegarder le classement
    # --------------------------------------------------------
    ranking = pd.concat([auc_series, model_importance], axis=1).sort_values("univariate_auc", ascending=False)
    ranking.to_csv(EXPERIMENTS_DIR / "feature_ranking.csv")

    print("\n--- Top 15 features les plus discriminantes (AUC univarié) ---")
    print(ranking.head(15).round(4))

    # --------------------------------------------------------
    # 4. Visualiser la distribution des top features
    # --------------------------------------------------------
    top6 = ranking.head(6).index.tolist()
    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    for ax, feature in zip(axes.flat, top6):
        data_a = X_sub.loc[y_binary == 0, feature]
        data_b = X_sub.loc[y_binary == 1, feature]
        ax.boxplot([data_a, data_b], labels=["Brute Force", "XSS"], showfliers=False)
        ax.set_title(feature, fontsize=9)
    fig.suptitle("Distribution des features les plus discriminantes\n(Brute Force vs XSS)")
    fig.tight_layout()
    fig.savefig(EXPERIMENTS_DIR / "top_features_comparison.png", dpi=150)
    plt.close(fig)

    print(f"\n✓ Résultats sauvegardés dans {EXPERIMENTS_DIR}")

    # --------------------------------------------------------
    # 5. Verdict
    # --------------------------------------------------------
    best_auc = ranking["univariate_auc"].iloc[0]
    print("\n--- Verdict ---")
    if best_auc < 0.65:
        print(f"Meilleur AUC univarié : {best_auc:.3f} — signal faible, confirme une")
        print("limite structurelle : les features de flux ne suffisent probablement pas")
        print("à distinguer ces deux classes de façon fiable.")
    else:
        print(f"Meilleur AUC univarié : {best_auc:.3f} — un signal existe, il vaut le coup")
        print("de construire des features d'interaction à partir du top classement ci-dessus.")


if __name__ == "__main__":
    main()