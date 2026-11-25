"""Inference service for the IDS model trained in the sibling IA directory."""

from functools import lru_cache
from pathlib import Path
import re

from loguru import logger

PROJECT_ROOT = Path(__file__).resolve().parents[3]
AI_DIR = PROJECT_ROOT / "IA"
MODEL_PATH = AI_DIR / "models" / "xgb_ids_model.json"
ENCODER_PATH = AI_DIR / "datasets" / "final" / "label_encoder.joblib"
TRAINING_SCHEMA = AI_DIR / "datasets" / "final" / "X_train.parquet"
AI_LOG_DIR = AI_DIR / "logs"
AI_LOG_DIR.mkdir(parents=True, exist_ok=True)
logger.add(
    str(AI_LOG_DIR / "inference_{time:YYYY-MM-DD}.log"),
    level="INFO",
    rotation="00:00",
    retention="30 days",
    encoding="utf-8",
    filter=lambda record: record["extra"].get("service") == "ai-inference",
    format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {message}",
)
ai_logger = logger.bind(service="ai-inference")


@lru_cache(maxsize=1)
def _load_model():
    import joblib
    from xgboost import XGBClassifier

    for artifact in (MODEL_PATH, ENCODER_PATH, TRAINING_SCHEMA):
        if not artifact.is_file():
            raise RuntimeError(f"Artefact IA introuvable : {artifact}")

    model = XGBClassifier()
    model.load_model(str(MODEL_PATH))
    encoder = joblib.load(ENCODER_PATH)
    feature_names = model.get_booster().feature_names
    if not feature_names:
        import pyarrow.parquet as pq

        feature_names = pq.ParquetFile(TRAINING_SCHEMA).schema_arrow.names
    ai_logger.info("IDS model loaded: {} ({} features)", MODEL_PATH.name, len(feature_names))
    return model, encoder, feature_names


def _normalize(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")


def predict_intrusion(data: dict) -> dict:
    """Score one network flow using the trained XGBoost IDS model."""
    import numpy as np
    import pandas as pd

    model, encoder, feature_names = _load_model()
    supplied = data.get("features") or {}

    # Accept the original form fields and let callers provide the full flow
    # vector expected by the training pipeline for more accurate detections.
    values = {_normalize(str(key)): value for key, value in supplied.items()}
    aliases = {
        "packet_size": data.get("packet_size"),
        "source_ip": data.get("source_ip"),
        "flags": data.get("flags"),
    }
    for key, value in aliases.items():
        if value is not None:
            values.setdefault(_normalize(key), value)

    # Map the compact dashboard form fields to the closest CICIDS flow fields.
    packet_size = data.get("packet_size")
    if packet_size is not None:
        for name in (
            "Total Length of Fwd Packets", "Fwd Packet Length Max",
            "Fwd Packet Length Mean", "Packet Length Max", "Packet Length Mean",
        ):
            values.setdefault(_normalize(name), packet_size)
    flags = {part.strip().upper() for part in str(data.get("flags", "")).replace(",", " ").split()}
    for flag in ("FIN", "SYN", "RST", "PSH", "ACK", "URG", "ECE", "CWR"):
        values.setdefault(_normalize(f"{flag} Flag Count"), float(flag in flags))

    row = {}
    for feature in feature_names:
        value = values.get(_normalize(feature), 0)
        try:
            number = float(value)
            row[feature] = number if np.isfinite(number) else 0.0
        except (TypeError, ValueError):
            row[feature] = 0.0

    probabilities = model.predict_proba(pd.DataFrame([row], columns=feature_names))[0]
    labels = encoder.inverse_transform(np.arange(len(probabilities)))
    probability_by_label = dict(zip(labels, probabilities))
    benign_probability = float(probability_by_label.get("Benign", 0.0))
    predicted_label = str(labels[int(np.argmax(probabilities))])
    risk = 1.0 - benign_probability

    if float(np.max(probabilities)) < 0.60:
        status = "UNKNOWN"
    else:
        status = "SAFE" if predicted_label == "Benign" else "MALICIOUS"

    result = {
        "score": round(float(np.clip(risk, 0.0, 1.0)), 4),
        "status": status,
        "predicted_label": predicted_label,
        "confidence": round(float(np.max(probabilities)), 4),
    }
    ai_logger.info(
        "IDS prediction complete: status={} label={} risk={} confidence={}",
        result["status"], result["predicted_label"], result["score"], result["confidence"],
    )
    return result
