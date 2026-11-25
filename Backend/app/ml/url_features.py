import math
import re
from urllib.parse import urlparse

IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
SUSPICIOUS_WORDS = ["login", "verify", "bank", "free", "update", "secure",
                    "account", "confirm", "password", "signin", "wallet"]
SUSPICIOUS_TLDS = {"xyz", "top", "tk", "ml", "ga", "cf", "gq", "click",
                   "work", "zip", "icu", "cyou", "buzz"}

FEATURE_NAMES = [
    "url_length", "host_length", "path_length", "query_length",
    "host_dots", "subdomains", "tld_length", "tld_suspicious",
    "is_ip", "is_https", "has_port", "has_punycode", "has_at",
    "hyphens_host", "hyphens_url", "digits_url", "digit_ratio",
    "letters_url", "letter_ratio", "equals", "qmarks", "ampersands",
    "percents", "slashes", "path_depth", "other_special", "special_ratio",
    "suspicious_words", "host_entropy",
]


def _entropy(s: str) -> float:
    if not s:
        return 0.0
    n = len(s)
    return -sum((s.count(c) / n) * math.log2(s.count(c) / n) for c in set(s))


def extract_features(raw: str) -> list[float]:
    url = str(raw).strip()
    full = url if "://" in url else "http://" + url
    try:
        p = urlparse(full)
        host = (p.hostname or "").lower()
        port = p.port
    except ValueError:
        p, host, port = urlparse("http://invalid"), "", None
    path, query = p.path or "", p.query or ""
    low = full.lower()
    if host.startswith("www."):
        host = host[4:]
    parts = [x for x in host.split(".") if x]
    tld = parts[-1] if len(parts) > 1 else ""
    n = max(len(url), 1)
    letters = sum(c.isalpha() for c in url)
    digits = sum(c.isdigit() for c in url)
    other = sum(1 for c in url if not c.isalnum() and c not in "/.:-_?=&%@")
    return [
        len(url), len(host), len(path), len(query),
        host.count("."), max(len(parts) - 2, 0), len(tld),
        1.0 if tld in SUSPICIOUS_TLDS else 0.0,
        1.0 if IP_RE.match(host) else 0.0,
        1.0 if low.startswith("https://") else 0.0,
        1.0 if port else 0.0,
        1.0 if "xn--" in host else 0.0,
        1.0 if "@" in url else 0.0,
        host.count("-"), url.count("-"), digits, digits / n,
        letters, letters / n, url.count("="), url.count("?"), url.count("&"),
        url.count("%"), url.count("/"), len([s for s in path.split("/") if s]),
        other, other / n,
        sum(w in low for w in SUSPICIOUS_WORDS), _entropy(host),
    ]



def extract_host_features(raw: str) -> list[float]:
   url = str(raw).strip()
   full = url if "://" in url else "http://" + url
   try:
       p = urlparse(full)
       host = (p.hostname or "").lower()
       port = p.port
   except ValueError:
       host, port = "", None
   parts = [x for x in host.split(".") if x]
   tld = parts[-1] if len(parts) > 1 else ""
   n = max(len(host), 1)
   digits = sum(c.isdigit() for c in host)
   return [
       len(host), host.count("."), max(len(parts) - 2, 0), len(tld),
       1.0 if tld in SUSPICIOUS_TLDS else 0.0,
       1.0 if IP_RE.match(host) else 0.0,
       1.0 if port else 0.0,
       1.0 if "xn--" in host else 0.0,
       host.count("-"), digits, digits / n, _entropy(host),
       sum(w in host for w in SUSPICIOUS_WORDS),
       max((len(x) for x in parts), default=0),
   ]