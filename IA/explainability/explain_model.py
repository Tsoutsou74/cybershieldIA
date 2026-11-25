"""
explain_model.py
============================================================
Explicabilité SHAP du modèle IDS.

Produit dans explainability/ :
  - summary_<classe>.png : top 15 features qui pèsent le plus
    dans la décision du modèle pour chaque classe (barres,
    valeur SHAP moyenne absolue)
  - beeswarm_global.png : vue d'ensemble (échantillon global,
    toutes classes confondues) montrant aussi le SENS de l'effet
    (valeur haute/basse de la feature -> pousse vers/contre la
    classe)
  - bot_false_positives_waterfall_<i>.png : pour Bot (notre point
    faible, precision 0.55), explique cas par cas pourquoi un
    trafic Benign a été classé à tort comme Bot

Prérequis : avoir lancé merge_and_split.py et train_model.py.
La bibliothèque `shap` doit être installée (déjà dans
requirements.txt).

Note : SHAP sur un modèle multiclasse est coûteux en calcul.
Ce script travaille sur un ÉCHANTILLON (SAMPLE_SIZE lignes),
pas sur tout le test set — c'est suffisant pour l'interprétation
globale et évite un calcul de plusieurs heures.
============================================================
"""

from pathlib import Path
import pandas as pd
import numpy as np
import joblib
import shap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from xgboost import XGBClassifier

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = Path(__file__).resolve().parent.parent
FINAL_DIR = BASE_DIR / "datasets" / "final"
MODEL_DIR = BASE_DIR / "models"
EXPLAIN_DIR = BASE_DIR / "explainability"
EXPLAIN_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42
SAMPLE_SIZE = 3000          # taille de l'échantillon pour l'analyse globale
TOP_N_FEATURES = 15
N_WATERFALL_EXAMPLES = 5    # nombre de faux positifs Bot à détailler


def main():
    print("--- Chargement du modèle et des données ---")
    model = XGBClassifier()
    model.load_model(MODEL_DIR / "xgb_ids_model.json")
    encoder = joblib.load(FINAL_DIR / "label_encoder.joblib")
    X_test = pd.read_parquet(FINAL_DIR / "X_test.parquet")
    y_test = pd.read_parquet(FINAL_DIR / "y_test.parquet")["Label"].to_numpy()

    classes = encoder.classes_
    print(f"Test complet : {X_test.shape[0]:,} lignes, {len(classes)} classes")

    # --------------------------------------------------------
    # Échantillonnage stratifié pour l'analyse globale
    # (au moins quelques lignes par classe, même rares)
    # --------------------------------------------------------
    rng = np.random.RandomState(RANDOM_STATE)
    df_idx = pd.DataFrame({"idx": np.arange(len(y_test)), "y": y_test})
    sample_idx = (
        df_idx.groupby("y", group_keys=False)
        .apply(lambda g: g.sample(
            n=min(len(g), max(1, int(SAMPLE_SIZE * len(g) / len(y_test)))),
            random_state=RANDOM_STATE,
        ))["idx"]
        .to_numpy()
    )
    X_sample = X_test.iloc[sample_idx].reset_index(drop=True)
    y_sample = y_test[sample_idx]
    print(f"Échantillon SHAP : {X_sample.shape[0]:,} lignes")

    # --------------------------------------------------------
    # Calcul des valeurs SHAP (TreeExplainer = rapide pour XGBoost)
    # --------------------------------------------------------
    print("\n--- Calcul des valeurs SHAP (peut prendre quelques minutes) ---")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X_sample)  # shap.Explanation, values shape (n, features, n_classes)
    print("✓ Valeurs SHAP calculées")

    values = shap_values.values
    if values.ndim == 2:
        # certains modèles binaires renvoient (n, features) directement
        values = values[:, :, np.newaxis]

    # --------------------------------------------------------
    # 1. Résumé par classe (top features, importance moyenne absolue)
    # --------------------------------------------------------
    print("\n--- Résumé par classe ---")
    top_features_per_class = {}
    for class_idx, class_name in enumerate(classes):
        class_values = values[:, :, class_idx] if values.shape[2] > 1 else values[:, :, 0]
        mean_abs_shap = np.abs(class_values).mean(axis=0)
        ranking = pd.Series(mean_abs_shap, index=X_sample.columns).sort_values(ascending=False)
        top_features_per_class[class_name] = ranking.head(TOP_N_FEATURES)

        fig, ax = plt.subplots(figsize=(8, 6))
        ranking.head(TOP_N_FEATURES).sort_values().plot.barh(ax=ax, color="#4C72B0")
        ax.set_xlabel("Impact moyen (|SHAP value|)")
        ax.set_title(f"Features les plus influentes — {class_name}")
        fig.tight_layout()
        safe_name = "".join(c if c.isalnum() else "_" for c in class_name)
        fig.savefig(EXPLAIN_DIR / f"summary_{safe_name}.png", dpi=150)
        plt.close(fig)

    pd.concat(top_features_per_class, axis=1).to_csv(EXPLAIN_DIR / "top_features_per_class.csv")
    print(f"✓ Résumés par classe sauvegardés dans {EXPLAIN_DIR}")

    # --------------------------------------------------------
    # 2. Vue globale (beeswarm) — utilise la classe la plus
    #    probable prédite pour chaque ligne, pour une vue agrégée
    #    interprétable
    # --------------------------------------------------------
    print("\n--- Génération du beeswarm global ---")
    pred_proba = model.predict_proba(X_sample)
    pred_class = pred_proba.argmax(axis=1)
    # valeurs SHAP correspondant à la classe prédite de chaque ligne
    values_for_predicted = np.take_along_axis(
        values, pred_class[:, None, None], axis=2
    )[:, :, 0]

    explanation_agg = shap.Explanation(
        values=values_for_predicted,
        base_values=np.zeros(len(X_sample)),
        data=X_sample.values,
        feature_names=X_sample.columns.tolist(),
    )
    fig = plt.figure(figsize=(10, 8))
    shap.plots.beeswarm(explanation_agg, max_display=20, show=False)
    plt.title("Impact des features sur la classe prédite (échantillon global)")
    plt.tight_layout()
    plt.savefig(EXPLAIN_DIR / "beeswarm_global.png", dpi=150)
    plt.close(fig)
    print(f"✓ beeswarm_global.png sauvegardé")

    # --------------------------------------------------------
    # 3. Zoom sur les faux positifs Bot (notre point faible)
    # --------------------------------------------------------
    print("\n--- Analyse des faux positifs Bot ---")
    bot_idx = np.where(classes == "Bot")[0]
    if len(bot_idx) == 0:
        print("⚠ Classe 'Bot' introuvable dans l'encodeur, étape ignorée")
    else:
        bot_class_idx = bot_idx[0]
        y_true_label = encoder.inverse_transform(y_sample)
        is_false_positive = (pred_class == bot_class_idx) & (y_true_label != "Bot")
        fp_positions = np.where(is_false_positive)[0]

        print(f"Faux positifs Bot dans l'échantillon : {len(fp_positions)}")
        n_to_plot = min(N_WATERFALL_EXAMPLES, len(fp_positions))

        for i in range(n_to_plot):
            pos = fp_positions[i]
            true_label = y_true_label[pos]
            single_explanation = shap.Explanation(
                values=values[pos, :, bot_class_idx],
                base_values=explainer.expected_value[bot_class_idx]
                    if hasattr(explainer.expected_value, "__len__") else explainer.expected_value,
                data=X_sample.iloc[pos].values,
                feature_names=X_sample.columns.tolist(),
            )
            fig = plt.figure(figsize=(10, 6))
            shap.plots.waterfall(single_explanation, max_display=15, show=False)
            plt.title(f"Pourquoi 'Bot' a été prédit (vraie classe : {true_label})")
            plt.tight_layout()
            plt.savefig(EXPLAIN_DIR / f"bot_false_positive_waterfall_{i}.png", dpi=150)
            plt.close(fig)

        if n_to_plot > 0:
            print(f"✓ {n_to_plot} waterfall(s) de faux positifs Bot sauvegardé(s)")

    print(f"\n✓ Explicabilité terminée. Fichiers dans : {EXPLAIN_DIR}")


if __name__ == "__main__":
    main()