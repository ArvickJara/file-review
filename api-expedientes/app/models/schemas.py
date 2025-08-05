# app/models/schemas.py
from pydantic import BaseModel
from typing import List, Optional
from enum import Enum

class SeverityLevel(str, Enum):
    HIGH = "alta"
    MEDIUM = "media"
    LOW = "baja"

class ObservationModel(BaseModel):
    id: Optional[int] = None
    description: str
    severity: SeverityLevel
    area: str
    recommendation: str
    page_number: Optional[int] = None

class AnalysisResponse(BaseModel):
    filename: str
    total_observations: int
    observations: List[ObservationModel]
    status: str
    processing_time: Optional[float] = None