import numpy as np
import pandas as pd
import xgboost as xgb

b = xgb.Booster()
b.load_model(r"models\xgb_ids_model.json")

X = pd.read_parquet(r"datasets\processed\DDoS-Friday-no-metadata_clean_X.parquet")
y = pd.read_parquet(r"datasets\processed\DDoS-Friday-no-metadata_clean_y.parquet")
pred = pd.read_csv(r"prediction\DDoS-Friday-no-metadata_predictions.csv")

print("lignes X / y / CSV :", len(X), len(y), len(pred))
print("y :", y.dtypes.to_dict(), y.iloc[:, 0].value_counts().head(15).to_dict())

p = b.predict(xgb.DMatrix(X[b.feature_names]))
cls = p.argmax(axis=1) if p.ndim == 2 else p.astype(int)

if len(pred) == len(cls):
    print(pd.crosstab(cls, pred["predicted_label"]))
else:
    print("Nombres de lignes différents : pas de comparaison possible")