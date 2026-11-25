"""
data_cleaning.py
============================================================
Fonctions de nettoyage partagées entre les différentes étapes
du pipeline (feature_engineering.py, merge_and_split.py,
predict.py).

Centraliser ça ici évite le bug qu'on a eu : predict.py avait sa
propre version (incomplète) du nettoyage de noms de colonnes,
différente de celle de clean_data.py, donc aucune colonne ne
matchait au moment de la prédiction.

Usage :

    from utils.data_cleaning import clean_column_name, drop_leaky_columns, merge_web_attack_labels
============================================================
"""

import re
import pandas as pd


# Colonnes à exclure si elles ont survécu jusqu'ici (identifiants,
# fuite d'information). Complétez cette liste si vous repérez
# d'autres colonnes identifiantes dans vos données.
LEAKY_COLUMNS = [
    "flow_id", "source_ip", "src_ip", "destination_ip", "dst_ip",
    "timestamp", "source_port", "src_port",
]


def clean_column_name(name: str) -> str:
    """
    Normalise un nom de colonne : espaces et slashs -> underscore.
    Ex: "Flow Bytes/s" -> "Flow_Bytes_s", "ACK Flag Count" -> "ACK_Flag_Count"

    Doit être IDENTIQUE partout dans le pipeline (nettoyage,
    fusion, prédiction) — sinon les colonnes ne matchent plus
    entre les étapes.
    """
    name = name.strip()
    name = re.sub(r"[\s/]+", "_", name)
    return name


def clean_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Applique clean_column_name à toutes les colonnes d'un DataFrame."""
    return df.rename(columns=clean_column_name)


def drop_leaky_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Retire les colonnes identifiantes (voir LEAKY_COLUMNS) si présentes."""
    cols_to_drop = [c for c in df.columns if c.strip().lower() in LEAKY_COLUMNS]
    if cols_to_drop:
        df = df.drop(columns=cols_to_drop)
    return df, cols_to_drop


def merge_web_attack_labels(y: pd.Series) -> pd.Series:
    """
    Fusionne 'Web Attack ... Brute Force' et 'Web Attack ... XSS' en
    une seule classe 'Web Attack HTTP'.

    Justification (voir experiments/analyze_bruteforce_vs_xss.py) :
    ces deux classes sont structurellement indiscernables avec les
    features de flux disponibles (AUC univarié max 0.59). 'Sql
    Injection' reste séparée : elle est déjà distinguée parfaitement.

    Matching insensible à l'encodage exact du tiret (le fichier
    source contient un caractère mal décodé).
    """
    y = y.copy()
    is_web_attack = y.str.contains("Web Attack", case=False, na=False)
    is_brute_force = is_web_attack & y.str.contains("Brute Force", case=False, na=False)
    is_xss = is_web_attack & y.str.contains("XSS", case=False, na=False)
    merged_mask = is_brute_force | is_xss
    y.loc[merged_mask] = "Web Attack HTTP"
    return y, int(merged_mask.sum())
