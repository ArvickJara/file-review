
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv
import openai
from .services.document_processor import DocumentProcessor
from .services.ai_analyzer import AIAnalyzer
from .models.schemas import AnalysisResponse, ObservationModel

load_dotenv()

app = FastAPI(
    title="EvalIA Expedientes API",
    description="API para análisis de expedientes técnicos con IA",
    version="1.0.0"
)

# Configurar CORS para el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Tu frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configurar OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

document_processor = DocumentProcessor()
ai_analyzer = AIAnalyzer()

@app.get("/")
async def root():
    return {"message": "EvalIA Expedientes API - Funcionando correctamente"}

@app.post("/api/process-document", response_model=AnalysisResponse)
async def process_document(file: UploadFile = File(...)):
    """
    Procesa un documento (PDF, DOC, DOCX) y extrae observaciones usando IA
    """
    # Validar tipo de archivo
    allowed_types = ["application/pdf", "application/msword", 
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de archivo no soportado")
    
    try:
        # Extraer texto del documento
        text_content = await document_processor.extract_text(file)
        
        if not text_content:
            raise HTTPException(status_code=400, detail="No se pudo extraer texto del documento")
        
        # Analizar con IA
        observations = await ai_analyzer.analyze_document(text_content)
        
        # Guardar en base de datos (implementar después)
        # await save_analysis_to_db(file.filename, observations)
        
        
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando documento: {str(e)}")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}