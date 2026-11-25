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
OUT = ROOT / "models" / "xgb_phishing_url_model.json"


def host_of(u: str) -> str:
    try:
        return (urlparse(u if "://" in u else "http://" + u).hostname or "").lower()
    except ValueError:
        return ""


df = pd.read_csv(CSV, usecols=["URL", "label"]).drop_duplicates("URL")
df["y"] = 1 - df["label"]            # 1 = phishing (dans le CSV : 1 = légitime)
print(len(df), "URLs,", int(df["y"].sum()), "phishing")

X = np.array([extract_features(u) for u in df["URL"]], dtype=np.float32)
y = df["y"].to_numpy()
groups = df["URL"].map(host_of).to_numpy()

# Séparation par domaine : un même site n'est jamais à la fois en train et en test
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