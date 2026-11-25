import random
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit

from url_features import extract_features

ROOT = Path(__file__).resolve().parents[2]          # IA\phishing
CSV = ROOT / "datasets" / "raw" / "PhiUSIIL_Phishing_URL_Dataset.csv"
OUT = ROOT / "models" / "xgb_phishing_url_model_v2.json"

WORDS = ["about", "contact", "products", "product", "blog", "news", "docs", "help",
         "support", "pricing", "careers", "search", "category", "item", "article",
         "post", "user", "profile", "settings", "dashboard", "download", "images",
         "static", "assets", "en", "fr", "us", "index", "home", "shop", "cart",
         "checkout", "orders", "faq", "terms", "privacy", "team", "events",
         "gallery", "video", "watch", "wiki", "issues", "releases", "library",
         "reference", "guide", "tutorial", "api", "v1", "v2"]
RISKY = ["login", "verify", "account", "update", "secure", "signin",
         "confirm", "password", "bank", "wallet"]
EXT = ["", "", "", ".html", ".php", ".aspx", ".htm"]
PARAMS = ["id", "ref", "q", "page", "lang", "utm_source", "session", "token", "cat", "sort"]
VALUES = ["1", "abc", "42", "en", "x7Gh2", "true", "2024"]


def rand_path(rng: random.Random) -> str:
    segs = []
    for _ in range(rng.choice([1, 1, 2, 2, 3, 4])):
        r = rng.random()
        if r < 0.10:
            segs.append(rng.choice(RISKY))
        elif r < 0.25:
            segs.append(str(rng.randint(1, 99999)))
        elif r < 0.35:
            segs.append(rng.choice(WORDS) + "-" + rng.choice(WORDS))
        else:
            segs.append(rng.choice(WORDS))
    path = "/" + "/".join(segs) + rng.choice(EXT)
    if rng.random() < 0.3:
        n = rng.choice([1, 1, 2, 3])
        path += "?" + "&".join(f"{rng.choice(PARAMS)}={rng.choice(VALUES)}" for _ in range(n))
    return path


def parse(u: str):
    try:
        return urlparse(u if "://" in u else "http://" + u)
    except ValueError:
        return urlparse("http://invalid")


def host_of(u: str) -> str:
    return (parse(u).hostname or "").lower()


def has_path(u: str) -> bool:
    return len(parse(u).path.strip("/")) > 0


df = pd.read_csv(CSV, usecols=["URL", "label"]).drop_duplicates("URL")
df["y"] = 1 - df["label"]                  # 1 = phishing (dans le CSV : 1 = légitime)
df["has_path"] = df["URL"].map(has_path)
rates = df.groupby("y")["has_path"].mean()
print("Part d'URLs avec chemin AVANT (0 = légitime, 1 = phishing) :")
print(rates.round(3).to_string())

# Chaque classe reçoit assez de chemins pour atteindre le même taux
target = max(0.5, float(rates.max()))
prob = {c: max(0.0, (target - r) / (1 - r)) for c, r in rates.items()}

rng = random.Random(42)
rows = []
for u, y, hp in zip(df["URL"], df["y"], df["has_path"]):
    if not hp and rng.random() < prob[y]:
        p = parse(u)
        rows.append((f"{p.scheme}://{p.netloc}{rand_path(rng)}", y))

full = pd.concat([df[["URL", "y"]], pd.DataFrame(rows, columns=["URL", "y"])],
                 ignore_index=True).drop_duplicates("URL")
full["has_path"] = full["URL"].map(has_path)
print("Part d'URLs avec chemin APRÈS :")
print(full.groupby("y")["has_path"].mean().round(3).to_string())
print(len(full), "URLs,", int(full["y"].sum()), "phishing")

X = np.array([extract_features(u) for u in full["URL"]], dtype=np.float32)
y = full["y"].to_numpy()
groups = full["URL"].map(host_of).to_numpy()

# Les copies d'un même domaine restent du même côté (train ou test)
tr, te = next(GroupShuffleSplit(test_size=0.2, random_state=42).split(X, y, groups))

model = xgb.XGBClassifier(n_estimators=300, max_depth=6, learning_rate=0.1,
                          subsample=0.8, colsample_bytree=0.8,
                          eval_metric="logloss", n_jobs=-1)
model.fit(X[tr], y[tr])

proba = model.predict_proba(X[te])[:, 1]
print(classification_report(y[te], proba > 0.5, target_names=["légitime", "phishing"]))
print("AUC :", round(roc_auc_score(y[te], proba), 4))

model.save_model(OUT)
print("Modèle sauvegardé :", OUT)