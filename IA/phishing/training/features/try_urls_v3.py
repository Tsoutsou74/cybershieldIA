from pathlib import Path
import numpy as np
import xgboost as xgb
from url_features import extract_host_features

MODEL = Path(__file__).resolve().parents[2] / "models" / "xgb_phishing_host_model_v3.json"
b = xgb.Booster()
b.load_model(str(MODEL))

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
    ("OK ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ("BAD", "http://paypal-secure-login.xyz/verify"),
    ("BAD", "http://192.168.0.1/bank/login.php"),
    ("BAD", "http://secure-update-account.top/signin?id=8841"),
    ("BAD", "http://amaz0n-verify-account.click/login"),
]
for expected, u in URLS:
    x = xgb.DMatrix(np.array([extract_host_features(u)], dtype=np.float32))
    print(f"{expected}   {float(b.predict(x)[0]):.3f}   {u}")