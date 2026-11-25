from pathlib import Path

import pandas as pd
import numpy as np


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

PROCESSED_DIR = (
    BASE_DIR / "datasets" / "processed"
)


# ============================================================
# PREPARATION DES FEATURES
# ============================================================

def prepare_features(df: pd.DataFrame):

    print("\n--- Préparation des caractéristiques ---")

    # --------------------------------------------------------
    # Identifier Label
    # --------------------------------------------------------

    label_column = None

    for column in df.columns:

        if column.strip().lower() == "label":

            label_column = column
            break

    if label_column is None:

        raise ValueError(
            "Colonne Label introuvable."
        )

    # --------------------------------------------------------
    # Séparer X et y
    # --------------------------------------------------------

    X = df.drop(
        columns=[label_column]
    )

    y = df[label_column]

    # --------------------------------------------------------
    # Convertir les colonnes numériques
    # --------------------------------------------------------

    for column in X.columns:

        X[column] = pd.to_numeric(
            X[column],
            errors="coerce"
        )

    # --------------------------------------------------------
    # Remplacer les valeurs invalides
    # --------------------------------------------------------

    X = X.replace(
        [np.inf, -np.inf],
        np.nan
    )

    # --------------------------------------------------------
    # Remplacer NaN par la médiane
    # --------------------------------------------------------

    for column in X.columns:

        median = X[column].median()

        if pd.notna(median):

            X[column] = X[column].fillna(
                median
            )

    # --------------------------------------------------------
    # Sélection des colonnes numériques
    # --------------------------------------------------------

    X = X.select_dtypes(
        include=np.number
    )

    print(
        f"Nombre de features : {X.shape[1]}"
    )

    print(
        f"Nombre d'observations : {X.shape[0]:,}"
    )

    return X, y


# ============================================================
# PROGRAMME PRINCIPAL
# ============================================================

def main():

    files = sorted(
        PROCESSED_DIR.glob(
            "*_clean.parquet"
        )
    )

    if not files:

        print(
            "Aucun dataset nettoyé trouvé."
        )

        print(
            "Lance d'abord clean_data.py"
        )

        return

    for file_path in files:

        print(
            f"\nTraitement : {file_path.name}"
        )

        df = pd.read_parquet(
            file_path
        )

        X, y = prepare_features(
            df
        )

        output_x = (
            PROCESSED_DIR
            / f"{file_path.stem}_X.parquet"
        )

        output_y = (
            PROCESSED_DIR
            / f"{file_path.stem}_y.parquet"
        )

        X.to_parquet(
            output_x,
            index=False
        )

        y.to_frame(
            name="Label"
        ).to_parquet(
            output_y,
            index=False
        )

        print(
            f"✓ X sauvegardé : {output_x.name}"
        )

        print(
            f"✓ y sauvegardé : {output_y.name}"
        )


if __name__ == "__main__":
    main()