from pathlib import Path
import pandas as pd
import numpy as np


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

RAW_DIR = BASE_DIR / "datasets" / "raw"
PROCESSED_DIR = BASE_DIR / "datasets" / "processed"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# NETTOYAGE D'UN DATASET
# ============================================================

def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:

    print("\n--- Nettoyage du dataset ---")

    # --------------------------------------------------------
    # 1. Nettoyage des noms de colonnes
    # --------------------------------------------------------

    df.columns = (
        df.columns
        .str.strip()
        .str.replace(" ", "_")
        .str.replace("/", "_")
    )

    print("✓ Noms des colonnes nettoyés")

    # --------------------------------------------------------
    # 2. Remplacer les valeurs infinies
    # --------------------------------------------------------

    df = df.replace(
        [np.inf, -np.inf],
        np.nan
    )

    print("✓ Valeurs infinies remplacées")

    # --------------------------------------------------------
    # 3. Supprimer les lignes entièrement vides
    # --------------------------------------------------------

    before = len(df)

    df = df.dropna(
        how="all"
    )

    removed = before - len(df)

    print(
        f"✓ Lignes entièrement vides supprimées : {removed:,}"
    )

    # --------------------------------------------------------
    # 4. Supprimer les doublons
    # --------------------------------------------------------

    before = len(df)

    df = df.drop_duplicates()

    removed = before - len(df)

    print(
        f"✓ Doublons supprimés : {removed:,}"
    )

    # --------------------------------------------------------
    # 5. Identifier la colonne Label
    # --------------------------------------------------------

    label_column = None

    for column in df.columns:

        if column.strip().lower() == "label":

            label_column = column
            break

    if label_column is None:

        raise ValueError(
            "La colonne 'Label' est introuvable."
        )

    # --------------------------------------------------------
    # 6. Nettoyer les labels
    # --------------------------------------------------------

    df[label_column] = (
        df[label_column]
        .astype(str)
        .str.strip()
    )

    # Supprimer les lignes sans label réel

    df = df[
        df[label_column].notna()
    ]

    print("✓ Labels nettoyés")

    # --------------------------------------------------------
    # 7. Supprimer les colonnes complètement vides
    # --------------------------------------------------------

    empty_columns = [
        column
        for column in df.columns
        if df[column].isna().all()
    ]

    if empty_columns:

        df = df.drop(
            columns=empty_columns
        )

        print(
            f"✓ Colonnes vides supprimées : "
            f"{len(empty_columns)}"
        )

    # --------------------------------------------------------
    # 8. Remplacer les NaN numériques
    # --------------------------------------------------------

    numeric_columns = df.select_dtypes(
        include=np.number
    ).columns

    for column in numeric_columns:

        median = df[column].median()

        if pd.notna(median):

            df[column] = df[column].fillna(
                median
            )

    print("✓ Valeurs numériques manquantes traitées")

    # --------------------------------------------------------
    # 9. Afficher les résultats
    # --------------------------------------------------------

    print("\n--- Résultat du nettoyage ---")

    print(
        f"Lignes finales   : {len(df):,}"
    )

    print(
        f"Colonnes finales : {len(df.columns)}"
    )

    print("\nRépartition des labels :")

    print(
        df[label_column].value_counts()
    )

    return df


# ============================================================
# TRAITEMENT D'UN FICHIER
# ============================================================

def process_file(file_path: Path):

    print("\n" + "=" * 80)

    print(
        f"Traitement : {file_path.name}"
    )

    print("=" * 80)

    try:

        # ----------------------------------------------------
        # Lecture
        # ----------------------------------------------------

        if file_path.suffix.lower() == ".parquet":

            df = pd.read_parquet(
                file_path
            )

        elif file_path.suffix.lower() == ".csv":

            df = pd.read_csv(
                file_path,
                low_memory=False
            )

        else:

            print(
                f"Format ignoré : {file_path.suffix}"
            )

            return

        print(
            f"Dataset original : "
            f"{len(df):,} lignes"
        )

        # ----------------------------------------------------
        # Nettoyage
        # ----------------------------------------------------

        df_clean = clean_dataframe(
            df
        )

        # ----------------------------------------------------
        # Nom du fichier de sortie
        # ----------------------------------------------------

        output_name = (
            file_path.stem
            + "_clean.parquet"
        )

        output_path = (
            PROCESSED_DIR
            / output_name
        )

        # ----------------------------------------------------
        # Sauvegarde
        # ----------------------------------------------------

        df_clean.to_parquet(
            output_path,
            index=False
        )

        print(
            f"\n✓ Dataset sauvegardé :"
        )

        print(
            output_path
        )

    except Exception as error:

        print(
            f"\n❌ ERREUR : {error}"
        )


# ============================================================
# PROGRAMME PRINCIPAL
# ============================================================

def main():

    print("=" * 80)

    print(
        "CYBERSHIELD AI - NETTOYAGE DES DONNÉES"
    )

    print("=" * 80)

    if not RAW_DIR.exists():

        print(
            f"Dossier introuvable : {RAW_DIR}"
        )

        return

    # --------------------------------------------------------
    # Recherche des fichiers
    # --------------------------------------------------------

    parquet_files = sorted(
        RAW_DIR.glob("*.parquet")
    )

    csv_files = sorted(
        RAW_DIR.glob("*.csv")
    )

    files = parquet_files + csv_files

    if not files:

        print(
            "\nAucun fichier trouvé."
        )

        return

    print(
        f"\nFichiers trouvés : {len(files)}"
    )

    # --------------------------------------------------------
    # Traitement
    # --------------------------------------------------------

    for file_path in files:

        process_file(
            file_path
        )

    print("\n" + "=" * 80)

    print(
        "NETTOYAGE TERMINÉ"
    )

    print("=" * 80)


# ============================================================
# POINT D'ENTRÉE
# ============================================================

if __name__ == "__main__":
    main()