from pathlib import Path
import numpy as np
import xgboost as xgb
from url_features import extract_features

MODELS = Path(__file__).resolve().parents[2] / "models"
b1, b2 = xgb.Booster(), xgb.Booster()
b1.load_model(str(MODELS / "xgb_phishing_url_model.json"))
b2.load_model(str(MODELS / "xgb_phishing_url_model_v2.json"))

URLS = [
    ("OK ", "https://www.wikipedia.org"),
    ("OK ", "https://www.linkedin.com/mynetwork/grow/"),
    ("OK ", "https://github.com/anthropics/anthropic-sdk-python/issues/123"),
    ("OK ", "https://www.amazon.com/dp/B08N5WRWNW?ref=nav_cart&th=1"),
    ("OK ", "https://docs.python.org/3/library/urllib.parse.html"),
    ("OK ", "https://www.bbc.com/news/world-africa-12345678"),
    ("OK ", "https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster"),
    ("OK ", "https://accounts.google.com/signin/v2/identifier"),
    ("OK ", "https://www.facebook.com/login/"),
    ("BAD", "http://paypal-secure-login.xyz/verify"),
    ("BAD", "http://192.168.0.1/bank/login.php"),
    ("BAD", "http://secure-update-account.top/signin?id=8841"),
]

print("attendu   v1     v2     url")
for expected, u in URLS:
    x = xgb.DMatrix(np.array([extract_features(u)], dtype=np.float32))
    print(f"{expected}      {float(b1.predict(x)[0]):.3f}  {float(b2.predict(x)[0]):.3f}  {u}")