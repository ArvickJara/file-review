import openai
from typing import List
import json
from ..models.schemas import ObservationModel, SeverityLevel

class AIAnalyzer:
    
    def __init__(self):
        self.prompt_template = """
Analiza el siguiente expediente técnico y extrae todas las observaciones, deficiencias, incumplimientos o puntos de mejora mencionados.

Para cada observación encontrada, proporciona la información en el siguiente formato JSON:

{
  "observations": [
    {
      "description": "Descripción detallada de la observación",
      "severity": "alta|media|baja",
      "area": "Área o sección afectada",
      "recommendation": "Recomendación específica de acción"
    }
  ]
}

Criterios de severidad:
- Alta: Incumplimientos críticos, riesgos de seguridad, violaciones normativas
- Media: Deficiencias importantes que requieren atención
- Baja: Mejoras menores o recomendaciones de optimización

Texto del expediente:
{document_text}

Responde únicamente con el JSON válido:
"""
    
    async def analyze_document(self, text: str) -> List[ObservationModel]:
        """Analiza el documento usando OpenAI y retorna observaciones estructuradas"""
        
        try:
            # Preparar el prompt
            prompt = self.prompt_template.format(document_text=text[:8000])  # Limitar tokens
            
            # Llamar a OpenAI
            response = await openai.ChatCompletion.acreate(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Eres un experto auditor técnico especializado en análisis de expedientes."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.3
            )
            
            # Parsear respuesta
            ai_response = response.choices[0].message.content
            observations_data = json.loads(ai_response)
            
            # Convertir a modelos Pydantic
            observations = []
            for obs_data in observations_data.get("observations", []):
                observation = ObservationModel(
                    description=obs_data["description"],
                    severity=SeverityLevel(obs_data["severity"]),
                    area=obs_data["area"],
                    recommendation=obs_data["recommendation"]
                )
                observations.append(observation)
            
            return observations
            
        except Exception as e:
            raise Exception(f"Error en análisis de IA: {str(e)}")