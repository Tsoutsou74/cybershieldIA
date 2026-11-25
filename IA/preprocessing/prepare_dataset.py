from pathlib import Path

import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

PROCESSED_DIR = (
    BASE_DIR / "datasets" / "processed"
)

FINAL_DIR = (
    PROCESSED_DIR / "final"
)

FINAL_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# CHARGEMENT
# ============================================================

def load_clean_datasets():

    files = sorted(
        PROCESSED_DIR.glob(
            "*_clean.parquet"
        )
    )

    if not files:

        raise FileNotFoundError(
            "Aucun fichier *_clean.parquet trouvé."
        )

    print(
        f"Nombre de datasets : {len(files)}"
    )

    frames = []

    for file_path in files:

        print(
            f"Chargement : {file_path.name}"
        )

        df = pd.read_parquet(
            file_path
        )

        frames.append(df)

    return pd.concat(
        frames,
        ignore_index=True
    )


# ============================================================
# PREPARATION
# ============================================================

def prepare_dataset(df):

    print("\n--- Préparation du dataset final ---")

    # Identifier Label

    label_column = None

    for column in df.columns:

        if column.strip().lower() == "label":

            label_column = column
            break

    if label_column is None:

        raise ValueError(
            "Colonne Label introuvable."
        )

    # Nettoyage final

    df[label_column] = (
        df[label_column]
        .astype(str)
        .str.strip()
    )

    # Mélange aléatoire

    df = df.sample(
        frac=1,
        random_state=42
    ).reset_index(
        drop=True
    )

    print(
        f"Nombre total de lignes : {len(df):,}"
    )

    print(
        f"Nombre de colonnes : {len(df.columns)}"
    )

    print("\nLabels :")

    print(
        df[label_column]
        .value_counts()
    )

    return df


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 80)

    print(
        "CYBERSHIELD AI - DATASET FINAL"
    )

    print("=" * 80)

    df = load_clean_datasets()

    df = prepare_dataset(
        df
    )

    output_path = (
        FINAL_DIR
        / "cybershield_dataset.parquet"
    )

    df.to_parquet(
        output_path,
        index=False
    )

    print("\n✓ Dataset final créé :")

    print(
        output_path
    )

    print("=" * 80)


if __name__ == "__main__":
    main()