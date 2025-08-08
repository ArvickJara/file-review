import io
from typing import Optional
from fastapi import UploadFile
import PyPDF2
import pdfplumber
from docx import Document

class DocumentProcessor:
    
    async def extract_text(self, file: UploadFile) -> Optional[str]:
        """Extrae texto de diferentes tipos de documentos"""
        try:
            content = await file.read()
            
            if file.content_type == "application/pdf":
                return await self._extract_from_pdf(content)
            elif file.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                return await self._extract_from_docx(content)
            elif file.content_type == "application/msword":
                return "Formato .doc no soportado actualmente. Use .docx"
            
            return None
            
        except Exception as e:
            print(f"Error extrayendo texto: {e}")
            raise Exception(f"Error procesando archivo: {str(e)}")
    
    async def _extract_from_pdf(self, content: bytes) -> str:
        """Extrae texto de PDF"""
        text = ""
        try:
            with io.BytesIO(content) as pdf_file:
                with pdfplumber.open(pdf_file) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
            return text
        except Exception as e:
            print(f"Error extrayendo PDF: {e}")
            raise
    
    async def _extract_from_docx(self, content: bytes) -> str:
        """Extrae texto de DOCX"""
        text = ""
        try:
            with io.BytesIO(content) as docx_file:
                doc = Document(docx_file)
                for paragraph in doc.paragraphs:
                    text += paragraph.text + "\n"
            return text
        except Exception as e:
            print(f"Error extrayendo DOCX: {e}")
            raise