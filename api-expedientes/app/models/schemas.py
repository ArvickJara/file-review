from pydantic import BaseModel
from typing import List, Optional
from enum import Enum
from datetime import datetime

class SeverityLevel(str, Enum):
    alta = "alta"
    media = "media"
    baja = "baja"

class ObservationModel(BaseModel):
    description: str
    severity: SeverityLevel
    area: str
    recommendation: str

class AnalysisResponse(BaseModel):
    filename: str
    total_observations: int
    observations: List[ObservationModel]
    status: str
    processing_time: Optional[float] = None
    file_size: Optional[int] = None