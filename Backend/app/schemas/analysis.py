from pydantic import BaseModel, Field
from datetime import datetime

class IntrusionPayload(BaseModel):
    source_ip: str
    packet_size: int
    flags: str
    # Features réseau brutes du flux (noms alignés sur le jeu d'entraînement).
    features: dict[str, float | int | str] = Field(default_factory=dict)

class PhishingPayload(BaseModel):
    url_or_text: str

class AnalysisResponse(BaseModel):
    id: int
    type: str
    target: str
    score: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class MalwareCheckResponse(BaseModel):
    status: str
    source: str
    detail: str
    url_status: str | None = None
    threat: str | None = None
    tags: list[str] = Field(default_factory=list)
    reference: str | None = None

class PhishingAnalysisResponse(AnalysisResponse):
    malware: MalwareCheckResponse
