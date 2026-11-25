import re
from pathlib import Path
import re
from urllib.parse import urlparse

import numpy as np
import xgboost as xgb

from app.ml.url_features import (
    IP_RE, SUSPICIOUS_TLDS, SUSPICIOUS_WORDS, extract_host_features,
)

ML_DIR = Path(__file__).resolve().parent.parent / "ml"
MODEL_PATH = ML_DIR / "phishing_model.json"
WHITELIST_PATH = ML_DIR / "whitelist.txt"
BLOCKLIST_PATH = ML_DIR / "blocklist.txt"   # facultatif (ex. flux OpenPhish)
KEYWORDS = ["login", "verify", "bank", "free", "update"]

# Hébergeurs de contenu utilisateur : jamais en liste blanche
SHARED_HOSTS = (
    "docs.google.com", "drive.google.com", "sites.google.com", "forms.gle",
    "storage.googleapis.com", "github.io", "githubusercontent.com",
    "blogspot.com", "wordpress.com", "wixsite.com", "weebly.com",
    "web.app", "firebaseapp.com", "netlify.app", "vercel.app", "pages.dev",
    "herokuapp.com", "azurewebsites.net", "notion.site", "000webhostapp.com",
)


def _read_lines(path: Path) -> list[str]:
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    return [l.strip().lower() for l in lines if l.strip() and not l.startswith("#")]


def _strip_scheme(s: str) -> str:
    return re.sub(r"^[a-z]+://", "", s).rstrip("/")


_whitelist = {l.split(",")[-1].strip() for l in _read_lines(WHITELIST_PATH)}
_block_urls: set[str] = set()
_block_hosts: set[str] = set()


def reload_blocklist() -> int:
    global _block_urls, _block_hosts
    block_urls: set[str] = set()
    block_hosts: set[str] = set()
    for entry in _read_lines(BLOCKLIST_PATH):
        normalized = _strip_scheme(entry)
        (block_urls if "/" in normalized else block_hosts).add(normalized)
    _block_urls, _block_hosts = block_urls, block_hosts
    return len(block_urls) + len(block_hosts)


reload_blocklist()
_model = None
if MODEL_PATH.exists():
    try:
        _model = xgb.Booster()
        _model.load_model(str(MODEL_PATH))
    except Exception as exc:  # le serveur démarre quand même
        print(f"[phishing] modèle non chargé : {exc}")
        _model = None


def _parse(text: str):
    t = text.strip()
    try:
        return urlparse(t if "://" in t else "http://" + t)
    except ValueError:
        return urlparse("http://invalid")


def _host(text: str) -> str:
    h = (_parse(text).hostname or "").lower()
    return h[4:] if h.startswith("www.") else h


def _looks_like_url(text: str) -> bool:
    t = text.strip()
    return " " not in t and "." in t


def _is_shared(host: str) -> bool:
    return any(host == s or host.endswith("." + s) for s in SHARED_HOSTS)


def _is_whitelisted(host: str) -> bool:
    if _is_shared(host):
        return False
    parts = host.split(".")
    return any(".".join(parts[i:]) in _whitelist for i in range(len(parts) - 1))


def _strong_signal(host: str, raw: str) -> bool:
    parts = host.split(".")
    tld = parts[-1] if len(parts) > 1 else ""
    # domaine connu utilisé comme sous-domaine d'un autre : github.com.evil.xyz
    impersonation = any(".".join(parts[i:i + 2]) in _whitelist
                        for i in range(len(parts) - 2))
    return (
        bool(IP_RE.match(host))
        or "xn--" in host
        or "@" in _parse(raw).netloc
        or impersonation
        or (tld in SUSPICIOUS_TLDS and any(w in host for w in SUSPICIOUS_WORDS))
    )


def predict_phishing(target: str) -> dict:
    if not _looks_like_url(target):
        # Texte libre (e-mail, SMS) : repli par mots-clés
        score = 0.88 if any(k in target.lower() for k in KEYWORDS) else 0.05
        return {"score": score, "status": "SUSPICIOUS" if score > 0.5 else "SAFE"}

    host = _host(target)
    model_score = 0.5
    if _model is not None:
        x = np.array([extract_host_features(target)], dtype=np.float32)
        model_score = float(_model.predict(xgb.DMatrix(x))[0])

    if _strip_scheme(target.strip().lower()) in _block_urls or (
        host in _block_hosts and not _is_shared(host)
    ):
        return {"score": 0.99, "status": "SUSPICIOUS"}
    if _is_whitelisted(host):
        return {"score": 0.02, "status": "SAFE"}
    if _strong_signal(host, target):
        return {"score": round(max(model_score, 0.95), 4), "status": "SUSPICIOUS"}
    # Domaine inconnu : le modèle seul ne suffit pas pour accuser
    return {"score": round(model_score, 4), "status": "UNKNOWN"}
