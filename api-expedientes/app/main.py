from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Importar servicios
from .services.document_processor import DocumentProcessor
from .services.ai_analyzer import AIAnalyzer
from .models.schemas import AnalysisResponse

# Cargar variables de entorno
load_dotenv()

app = FastAPI(
    title="EvalIA Expedientes API",
    description="API para análisis de expedientes técnicos con IA",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instanciar servicios
document_processor = DocumentProcessor()
ai_analyzer = AIAnalyzer()

@app.get("/")
async def root():
    return {"message": "EvalIA Expedientes API - Funcionando correctamente"}

@app.post("/api/process-document", response_model=AnalysisResponse)
async def process_document(file: UploadFile = File(...)):
    """Procesa un documento y extrae observaciones usando IA"""
    
    # Validar tipo de archivo
    allowed_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no soportado: {file.content_type}")
    
    try:
        print(f"Procesando archivo: {file.filename}")  # Debug
        
        # Extraer texto del documento
        text_content = await document_processor.extract_text(file)
        
        if not text_content or len(text_content.strip()) == 0:
            raise HTTPException(status_code=400, detail="No se pudo extraer texto del documento")
        
        print(f"Texto extraído: {len(text_content)} caracteres")  # Debug
        
        # Analizar con IA
        observations = await ai_analyzer.analyze_document(text_content)
        
        print(f"Observaciones encontradas: {len(observations)}")  # Debug
        
        return AnalysisResponse(
            filename=file.filename,
            total_observations=len(observations),
            observations=observations,
            status="completed"
        )
        
    except Exception as e:
        print(f"Error completo: {e}")  # Debug
        raise HTTPException(status_code=500, detail=f"Error procesando documento: {str(e)}")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}