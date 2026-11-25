"""
config.py
============================================================
Charge config/config.json et expose ses valeurs en accès par
attribut plutôt que par clé de dictionnaire.

Usage dans un script :

    from utils.config import config

    print(config.model.n_estimators)      # 400
    print(config.data.test_size)           # 0.2
    print(config.prediction.confidence_threshold)  # 0.6

Le fichier est lu une seule fois (mis en cache) même si plusieurs
scripts importent `config` dans le même processus.
============================================================
"""

import json
from types import SimpleNamespace

from utils.paths import CONFIG_DIR

CONFIG_PATH = CONFIG_DIR / "config.json"

_cached_config = None


def _dict_to_namespace(d):
    """Convertit récursivement un dict en SimpleNamespace pour l'accès par attribut."""
    if isinstance(d, dict):
        return SimpleNamespace(**{
            k: _dict_to_namespace(v) for k, v in d.items() if not k.startswith("_")
        })
    if isinstance(d, list):
        return [_dict_to_namespace(item) for item in d]
    return d


def load_config():
    global _cached_config
    if _cached_config is None:
        if not CONFIG_PATH.exists():
            raise FileNotFoundError(
                f"Fichier de configuration introuvable : {CONFIG_PATH}\n"
                "Assurez-vous que config/config.json existe à la racine du projet."
            )
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        _cached_config = _dict_to_namespace(raw)
    return _cached_config


# instance prête à l'emploi : from utils.config import config
config = load_config()
