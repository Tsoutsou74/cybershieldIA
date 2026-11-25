from pathlib import Path
import pandas as pd

RAW = Path(r"datasets\raw")
total = {}
for f in sorted(RAW.glob("*.parquet")):
    df = pd.read_parquet(f, columns=["Label"])
    print(f"{f.name} : {len(df)} lignes")
    for k, v in df["Label"].value_counts().items():
        print(f"    {k!r} : {v}")
        total[k] = total.get(k, 0) + v

labels = sorted(total)          # même ordre qu'un LabelEncoder
print(f"\n{len(labels)} classes, ordre alphabétique :")
for i, k in enumerate(labels):
    print(i, k, total[k])