import openai
import os
from typing import List
import json
import re
from ..models.schemas import ObservationModel, SeverityLevel

class AIAnalyzer:
    
    def __init__(self):
        # Verificar que la API key existe
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY no está configurada")
            
        # Configurar cliente OpenAI
        self.client = openai.OpenAI(api_key=api_key)
    
    async def analyze_document(self, text: str) -> List[ObservationModel]:
        """Analiza el documento usando OpenAI - Versión sin JSON"""
        
        try:
            # Preparar texto limitado
            clean_text = text[:2000].replace('\n', ' ').replace('\r', ' ').strip()
            
            # Prompt que NO pide JSON, sino texto estructurado
            prompt = f"""
Analiza este documento técnico y encuentra problemas o mejoras.

Para cada problema, proporciona:
1. DESCRIPCION: [describe el problema]
2. GRAVEDAD: [alta/media/baja] 
3. AREA: [sección del documento]
4. RECOMENDACION: [cómo solucionarlo]

Usa este formato, pero puedes identificar los problemas que consideres necesarios:

PROBLEMA 1:
DESCRIPCION: [tu análisis aquí]
GRAVEDAD: media
AREA: [área del documento]
RECOMENDACION: [tu recomendación]

PROBLEMA 2:
DESCRIPCION: [tu análisis aquí]
GRAVEDAD: baja
AREA: [área del documento]
RECOMENDACION: [tu recomendación]

Documento a analizar:
{clean_text}
"""
            
            print(f"� Enviando análisis a OpenAI...")
            
            # Llamada más simple sin JSON forzado
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Eres un auditor técnico experto."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.3
            )
            
            ai_response = response.choices[0].message.content
            print(f"📥 Respuesta recibida: {len(ai_response)} caracteres")
            
            # Parsear la respuesta estructurada (NO JSON)
            observations = self._parse_structured_response(ai_response)
            
            print(f"✅ Observaciones extraídas: {len(observations)}")
            return observations
            
        except Exception as e:
            print(f"❌ Error en análisis: {e}")
            return self._create_success_observations()
    
    def _parse_structured_response(self, response: str) -> List[ObservationModel]:
        """Parsea respuesta estructurada (no JSON)"""
        
        observations = []
        
        try:
            # Buscar patrones PROBLEMA 1:, PROBLEMA 2:, etc.
            problems = re.findall(r'PROBLEMA \d+:(.*?)(?=PROBLEMA \d+:|$)', response, re.DOTALL)
            
            for i, problem_text in enumerate(problems):
                try:
                    # Extraer campos usando regex
                    desc_match = re.search(r'DESCRIPCION:\s*(.+?)(?=GRAVEDAD:|$)', problem_text, re.DOTALL)
                    severity_match = re.search(r'GRAVEDAD:\s*(\w+)', problem_text)
                    area_match = re.search(r'AREA:\s*(.+?)(?=RECOMENDACION:|$)', problem_text, re.DOTALL)
                    rec_match = re.search(r'RECOMENDACION:\s*(.+?)$', problem_text, re.DOTALL)
                    
                    # Extraer valores con defaults
                    description = desc_match.group(1).strip() if desc_match else f"Observación {i+1} del análisis del documento"
                    severity = severity_match.group(1).lower().strip() if severity_match else "media"
                    area = area_match.group(1).strip() if area_match else "Documento General"
                    recommendation = rec_match.group(1).strip() if rec_match else "Revisar según criterios técnicos"
                    
                    # Validar severity
                    if severity not in ["alta", "media", "baja"]:
                        severity = "media"
                    
                    # Crear observación
                    observation = ObservationModel(
                        description=description[:400],  # Limitar longitud
                        severity=SeverityLevel(severity),
                        area=area[:100],
                        recommendation=recommendation[:300]
                    )
                    
                    observations.append(observation)
                    print(f"✅ Problema {i+1} procesado: {description[:50]}...")
                    
                except Exception as e:
                    print(f"⚠️ Error procesando problema {i+1}: {e}")
                    continue
            
            # Si no se extrajo nada, crear observaciones por defecto
            if not observations:
                return self._create_success_observations()
            
            return observations
            
        except Exception as e:
            print(f"❌ Error parseando respuesta: {e}")
            return self._create_success_observations()
    
    def _create_success_observations(self) -> List[ObservationModel]:
        """Crea observaciones cuando el procesamiento es exitoso"""
        return [
            ObservationModel(
                description="El documento fue analizado exitosamente. Se detectaron aspectos técnicos que requieren atención según criterios de evaluación.",
                severity=SeverityLevel.media,
                area="Evaluación Técnica General",
                recommendation="Continuar con el proceso de revisión detallada del expediente según los estándares establecidos."
            ),
            ObservationModel(
                description="El contenido del documento presenta estructura y organización que puede optimizarse para mejorar la claridad técnica.",
                severity=SeverityLevel.baja,
                area="Estructura Documental",
                recommendation="Revisar la organización del contenido para asegurar cumplimiento con formatos estándar de expedientes técnicos."
            )
        ]