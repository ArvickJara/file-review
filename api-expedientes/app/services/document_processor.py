import io
from typing import Optional
from fastapi import UploadFile
import PyPDF2
import pdfplumber
from docx import Document

class DocumentProcessor:
    
    async def extract_text(self, file: UploadFile) -> Optional[str]:
        """Extrae texto de diferentes tipos de documentos"""
        content = await file.read()
        
        if file.content_type == "application/pdf":
            return await self._extract_from_pdf(content)
        elif file.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return await self._extract_from_docx(content)
        elif file.content_type == "application/msword":
            return await self._extract_from_doc(content)
        
        return None
    
    async def _extract_from_pdf(self, content: bytes) -> str:
        """Extrae texto de PDF usando pdfplumber (mejor para tablas)"""
        text = ""
        with io.BytesIO(content) as pdf_file:
            with pdfplumber.open(pdf_file) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        return text
    
    async def _extract_from_docx(self, content: bytes) -> str:
        """Extrae texto de DOCX"""
        text = ""
        with io.BytesIO(content) as docx_file:
            doc = Document(docx_file)
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
        return text
    
    async def _extract_from_doc(self, content: bytes) -> str:
        """Extrae texto de DOC (requiere python-docx2txt o similar)"""
        # Para archivos .doc antiguos, necesitarás una librería adicional
        # como python-docx2txt o antiword
        raise NotImplementedError("Formato .doc no implementado aún")