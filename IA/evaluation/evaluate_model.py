"""
evaluate_model.py
============================================================
Évaluation détaillée du modèle entraîné par train_model.py.

Produit :
  - un rapport de classification complet (CSV)
  - ROC-AUC par classe (one-vs-rest)
  - courbes precision-recall pour chaque classe (utile pour
    juger les classes rares comme Heartbleed/Infiltration,
    où l'accuracy globale ne veut rien dire)
  - matrice de confusion (brute + normalisée) en image

Prérequis : avoir lancé merge_and_split.py ET train_model.py.
============================================================
"""

from pathlib import Path
import pandas as pd
import numpy as np
import joblib
import matplotlib
matplotlib.use("Agg")  # pas d'affichage interactif, juste sauvegarde fichiers
import matplotlib.pyplot as plt

from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    roc_curve,
    precision_recall_curve,
    average_precision_score,
)
from sklearn.preprocessing import label_binarize
from xgboost import XGBClassifier

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = Path(__file__).resolve().parent.parent
FINAL_DIR = BASE_DIR / "datasets" / "final"
MODEL_DIR = BASE_DIR / "models"
EVAL_DIR = BASE_DIR / "evaluation"
EVAL_DIR.mkdir(parents=True, exist_ok=True)


def main():
    print("\n--- Chargement du modèle et des données de test ---")
    model = XGBClassifier()
    model.load_model(MODEL_DIR / "xgb_ids_model.json")
    encoder = joblib.load(FINAL_DIR / "label_encoder.joblib")
    X_test = pd.read_parquet(FINAL_DIR / "X_test.parquet")
    y_test = pd.read_parquet(FINAL_DIR / "y_test.parquet")["Label"].to_numpy()

    classes = encoder.classes_
    n_classes = len(classes)
    print(f"Test : {X_test.shape[0]:,} lignes, {n_classes} classes")

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)

    # --------------------------------------------------------
    # 1. Rapport de classification -> CSV
    # --------------------------------------------------------
    print("\n--- Rapport de classification ---")
    report_dict = classification_report(
        y_test, y_pred,
        target_names=classes,
        output_dict=True,
        zero_division=0,
    )
    report_df = pd.DataFrame(report_dict).transpose()
    report_df.to_csv(EVAL_DIR / "classification_report.csv")
    print(report_df.round(3))
    print(f"\n✓ Rapport sauvegardé : {EVAL_DIR / 'classification_report.csv'}")

    # --------------------------------------------------------
    # 2. ROC-AUC par classe (one-vs-rest)
    # --------------------------------------------------------
    print("\n--- ROC-AUC par classe (one-vs-rest) ---")
    y_test_bin = label_binarize(y_test, classes=range(n_classes))

    auc_scores = {}
    for i, cls in enumerate(classes):
        # classes absentes du test set (ou à une seule valeur) -> ROC-AUC indéfini
        if y_test_bin[:, i].sum() == 0:
            auc_scores[cls] = np.nan
            continue
        auc_scores[cls] = roc_auc_score(y_test_bin[:, i], y_proba[:, i])

    auc_df = pd.Series(auc_scores, name="roc_auc").sort_values(ascending=False)
    auc_df.to_csv(EVAL_DIR / "roc_auc_per_class.csv")
    print(auc_df.round(4))
    print(f"✓ ROC-AUC par classe sauvegardé : {EVAL_DIR / 'roc_auc_per_class.csv'}")

    # --------------------------------------------------------
    # 3. Courbes Precision-Recall (plus parlantes que ROC pour
    #    les classes très déséquilibrées)
    # --------------------------------------------------------
    print("\n--- Courbes Precision-Recall ---")
    fig, ax = plt.subplots(figsize=(10, 8))
    for i, cls in enumerate(classes):
        if y_test_bin[:, i].sum() == 0:
            continue
        precision, recall, _ = precision_recall_curve(y_test_bin[:, i], y_proba[:, i])
        ap = average_precision_score(y_test_bin[:, i], y_proba[:, i])
        ax.plot(recall, precision, label=f"{cls} (AP={ap:.3f})")

    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("Courbes Precision-Recall par classe")
    ax.legend(loc="lower left", fontsize=8)
    fig.tight_layout()
    fig.savefig(EVAL_DIR / "precision_recall_curves.png", dpi=150)
    plt.close(fig)
    print(f"✓ Courbes PR sauvegardées : {EVAL_DIR / 'precision_recall_curves.png'}")

    # --------------------------------------------------------
    # 4. Matrice de confusion (brute + normalisée)
    # --------------------------------------------------------
    print("\n--- Matrice de confusion ---")
    cm = confusion_matrix(y_test, y_pred)
    cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True)

    for matrix, name, fmt in [(cm, "confusion_matrix", "d"), (cm_norm, "confusion_matrix_normalized", ".2f")]:
        fig, ax = plt.subplots(figsize=(10, 9))
        im = ax.imshow(matrix, cmap="Blues")
        ax.set_xticks(range(n_classes))
        ax.set_yticks(range(n_classes))
        ax.set_xticklabels(classes, rotation=90)
        ax.set_yticklabels(classes)
        ax.set_xlabel("Prédiction")
        ax.set_ylabel("Vraie classe")
        ax.set_title(name.replace("_", " "))
        for i in range(n_classes):
            for j in range(n_classes):
                val = matrix[i, j]
                if val == 0:
                    continue
                ax.text(j, i, format(val, fmt), ha="center", va="center",
                         fontsize=6, color="white" if val > matrix.max() / 2 else "black")
        fig.colorbar(im, ax=ax)
        fig.tight_layout()
        fig.savefig(EVAL_DIR / f"{name}.png", dpi=150)
        plt.close(fig)
        print(f"✓ {name}.png sauvegardé")

    # --------------------------------------------------------
    # 5. Focus classes rares (celles qui nous intéressent le plus)
    # --------------------------------------------------------
    rare_classes = ["Heartbleed", "Infiltration"]
    print("\n--- Focus classes rares ---")
    for cls in rare_classes:
        if cls in report_df.index:
            row = report_df.loc[cls]
            print(f"{cls} : precision={row['precision']:.3f}  recall={row['recall']:.3f}  "
                  f"f1={row['f1-score']:.3f}  support={int(row['support'])}")

    print(f"\n✓ Évaluation terminée. Tous les fichiers sont dans : {EVAL_DIR}")


if __name__ == "__main__":
    main()