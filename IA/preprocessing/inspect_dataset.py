from pathlib import Path
import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "datasets" / "raw"


# ============================================================
# INSPECTION D'UN FICHIER
# ============================================================

def inspect_file(file_path: Path) -> None:
    print("\n" + "=" * 80)
    print(f"FICHIER : {file_path.name}")
    print("=" * 80)

    try:
        # --------------------------------------------------------
        # Lecture selon le format
        # --------------------------------------------------------

        if file_path.suffix.lower() == ".parquet":
            df = pd.read_parquet(file_path)

        elif file_path.suffix.lower() == ".csv":
            df = pd.read_csv(file_path, low_memory=False)

        else:
            print(f"Format non supporté : {file_path.suffix}")
            return

        # --------------------------------------------------------
        # Informations générales
        # --------------------------------------------------------

        print(f"Nombre de lignes   : {len(df):,}")
        print(f"Nombre de colonnes : {len(df.columns)}")

        # --------------------------------------------------------
        # Colonnes
        # --------------------------------------------------------

        print("\n--- Colonnes ---")

        for column in df.columns:
            print(f"  - {column}")

        # --------------------------------------------------------
        # Types de données
        # --------------------------------------------------------

        print("\n--- Types de données ---")
        print(df.dtypes)

        # --------------------------------------------------------
        # Valeurs manquantes
        # --------------------------------------------------------

        print("\n--- Valeurs manquantes ---")

        missing = df.isnull().sum()
        missing = missing[missing > 0]

        if missing.empty:
            print("Aucune valeur manquante.")
        else:
            print(missing.sort_values(ascending=False))

        # --------------------------------------------------------
        # Doublons
        # --------------------------------------------------------

        print("\n--- Doublons ---")

        duplicates = df.duplicated().sum()

        print(f"Nombre de doublons : {duplicates:,}")

        # --------------------------------------------------------
        # Recherche de la colonne Label
        # --------------------------------------------------------

        label_column = None

        for column in df.columns:

            normalized_column = (
                str(column)
                .strip()
                .lower()
            )

            if normalized_column == "label":
                label_column = column
                break

        # --------------------------------------------------------
        # Répartition des attaques
        # --------------------------------------------------------

        if label_column:

            print("\n--- Répartition des attaques ---")

            labels = df[label_column].value_counts()

            for label, count in labels.items():

                percentage = (
                    count / len(df)
                ) * 100

                print(
                    f"{str(label):40} "
                    f"{count:12,} "
                    f"({percentage:6.2f}%)"
                )

        else:

            print(
                "\nATTENTION : colonne 'Label' introuvable."
            )

    except Exception as error:

        print(
            f"\nERREUR avec {file_path.name}"
        )

        print(error)


# ============================================================
# INSPECTION DE TOUS LES DATASETS
# ============================================================

def main():

    print("=" * 80)
    print("CYBERSHIELD AI - INSPECTION DU DATASET")
    print("=" * 80)

    # --------------------------------------------------------
    # Vérification du dossier
    # --------------------------------------------------------

    if not RAW_DIR.exists():

        print(
            f"\nDossier introuvable : {RAW_DIR}"
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

    all_files = parquet_files + csv_files

    # --------------------------------------------------------
    # Aucun fichier
    # --------------------------------------------------------

    if not all_files:

        print(
            f"\nAucun fichier CSV ou Parquet trouvé dans : "
            f"{RAW_DIR}"
        )

        return

    # --------------------------------------------------------
    # Résumé des fichiers
    # --------------------------------------------------------

    print(
        f"\nNombre total de fichiers trouvés : "
        f"{len(all_files)}"
    )

    print(
        f"Parquet : {len(parquet_files)}"
    )

    print(
        f"CSV     : {len(csv_files)}"
    )

    # --------------------------------------------------------
    # Inspection
    # --------------------------------------------------------

    for file_path in all_files:

        inspect_file(file_path)

    # --------------------------------------------------------
    # Fin
    # --------------------------------------------------------

    print("\n" + "=" * 80)

    print(
        "INSPECTION TERMINEE"
    )

    print("=" * 80)


# ============================================================
# POINT D'ENTREE
# ============================================================

if __name__ == "__main__":
    main()