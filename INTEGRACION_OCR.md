# Integración API Python OCR - Resumen Ejecutivo

## 🎯 Objetivo Cumplido

Sistema integrado para **revisar admisibilidad de entregables** usando OCR de la API Python.

## 📋 Cambios Implementados

### 1. Frontend (`Proyectos.tsx`)
- ✅ Botón "Revisar Admisibilidad" llama al backend Node.js
- ✅ Interface actualizada para incluir campo `ocr_digits`
- ✅ Modal muestra resultados de OCR extraídos

### 2. Backend Node.js (`routes/expedientes_tecnicos.js`)
- ✅ Nuevo endpoint: `POST /api/expedientes_tecnicos/revisar-admisibilidad`
- ✅ Convierte PDF → Imágenes PNG (usando poppler)
- ✅ Envía cada imagen a API Python
- ✅ Extrae solo campo `ocr_digits` de respuesta
- ✅ Limpia archivos temporales automáticamente

### 3. Utilidad de Conversión (`utils/pdfConverter.js`)
- ✅ Convierte PDFs a imágenes de alta calidad (300 DPI)
- ✅ Maneja múltiples páginas
- ✅ Limpieza automática de temporales

### 4. Configuración
- ✅ `.env` actualizado con `PYTHON_API_BASE_URL`
- ✅ `package.json` con dependencias: `form-data`, `node-fetch`

## 🔄 Flujo Completo

```
Usuario → Clic "Revisar Admisibilidad"
    ↓
Frontend → POST /api/expedientes_tecnicos/revisar-admisibilidad
    ↓
Backend Node.js:
    1. Busca PDF en BD (tabla documentos)
    2. Convierte PDF → Imágenes PNG (pdftoppm)
    3. Por cada imagen:
       - POST http://127.0.0.1:8000/predict?ocr=true&digits_only=true
       - Extrae ocr_digits de response
    4. Limpia imágenes temporales
    5. Retorna resultado consolidado
    ↓
Frontend → Muestra resultados en modal
```

## 📦 Request/Response

### Frontend → Backend Node.js

**POST** `/api/expedientes_tecnicos/revisar-admisibilidad`
```json
{
  "documento_id": "1234-5678",
  "proyecto_id": "abc",
  "tdr_id": "def",
  "orden": 1
}
```

### Backend Node.js → API Python

**POST** `http://127.0.0.1:8000/predict?ocr=true&digits_only=true&digits_engine=auto`
```
Content-Type: multipart/form-data
file: [imagen PNG]
```

### API Python → Backend Node.js

```json
{
  "ocr_digits": {
    "numeros_encontrados": ["123.45", "67890"],
    "confianza": 0.95,
    "coordenadas": [...],
    "metadata": {}
  },
  "otros_campos": "..." 
}
```

### Backend Node.js → Frontend

```json
{
  "success": true,
  "data": {
    "admisible": true,
    "puntaje": 100,
    "ocr_digits": [
      {
        "pagina": 1,
        "ocr_digits": { ... }
      },
      {
        "pagina": 2,
        "ocr_digits": { ... }
      }
    ],
    "observaciones": [],
    "detalles": {
      "total_paginas": 15,
      "paginas_procesadas": 15,
      "documento_id": "1234-5678",
      "orden": 1
    }
  }
}
```

## 🚀 Instalación

### 1. Instalar Poppler

**Windows:**
```powershell
# Descargar de: https://github.com/oschwartz10612/poppler-windows/releases
# Extraer a: C:\Program Files\poppler-24.08.0\
# Agregar al PATH: C:\Program Files\poppler-24.08.0\Library\bin

# Verificar
pdftoppm -v
```

**Linux:**
```bash
sudo apt-get install poppler-utils
```

**macOS:**
```bash
brew install poppler
```

### 2. Instalar Dependencias Node.js

```bash
cd C:\Users\AmarilisProject\Development\file-review
npm install
```

### 3. Configurar Variables de Entorno

Verificar `.env`:
```bash
PYTHON_API_BASE_URL=http://127.0.0.1:8000
```

### 4. Iniciar Servicios

**Terminal 1 - API Python:**
```bash
# Tu comando para iniciar la API Python
python main.py
```

**Terminal 2 - Backend Node.js:**
```bash
node server.js
```

**Terminal 3 - Frontend:**
```bash
cd fe-expedientes
npm run dev
```

## ✅ Testing

1. Abrir http://localhost:5173
2. Seleccionar proyecto con TDR
3. Subir entregables (PDFs)
4. Clic en **"Revisar Admisibilidad"**
5. Esperar procesamiento (muestra spinner)
6. Ver modal con resultados y `ocr_digits`

## 📊 Visualización de Resultados

El modal muestra:
- Estado por entregable (Admisible / No admisible)
- Puntaje de revisión
- **OCR Digits extraídos** por página
- Observaciones automáticas
- Detalles técnicos (páginas procesadas, etc.)

## 🔧 Personalización

### Agregar Lógica de Validación

En `routes/expedientes_tecnicos.js`, línea ~400:

```javascript
// Analizar resultados y determinar admisibilidad
const observaciones = [];
let admisible = true;
let puntaje = 100;

// AQUÍ: Agrega tu lógica personalizada
for (const result of ocrResults) {
    const digits = result.ocr_digits.numeros_encontrados || [];
    
    // Ejemplo: Verificar que hay montos
    if (digits.length === 0) {
        observaciones.push({
            tipo: 'critico',
            seccion: `Página ${result.pagina}`,
            mensaje: 'No se encontraron valores numéricos'
        });
        admisible = false;
        puntaje -= 10;
    }
    
    // Ejemplo: Verificar rangos de valores
    const hasValidAmounts = digits.some(d => parseFloat(d) > 0);
    if (!hasValidAmounts) {
        observaciones.push({
            tipo: 'advertencia',
            seccion: `Página ${result.pagina}`,
            mensaje: 'Valores numéricos parecen incorrectos'
        });
        puntaje -= 5;
    }
}
```

## 📝 Logs

Revisar logs en tiempo real:
```
C:\Users\AmarilisProject\Development\file-review\logs\
```

Buscar:
- `[PDFConverter]` - Conversión de PDFs
- `[RevisionAdmisibilidad]` - Llamadas a API Python
- `[ExpedientesDocs]` - Operaciones con documentos

## ⚠️ Consideraciones

1. **Rendimiento:**
   - PDFs grandes (>100 páginas) tardan varios minutos
   - Considerar procesar en background (workers)

2. **Almacenamiento:**
   - Imágenes temporales se limpian automáticamente
   - Directorio `temp/pdf-images/` crece durante procesamiento

3. **Seguridad:**
   - API Python debe estar en red privada
   - Agregar autenticación si es necesario

4. **Escalabilidad:**
   - Procesar tomos en paralelo (actualmente secuencial)
   - Usar Redis/Bull para cola de trabajos

## 🐛 Troubleshooting Común

**Error: "pdftoppm no encontrado"**
→ Instalar poppler y agregarlo al PATH

**Error: "Cannot find module 'form-data'"**
→ Ejecutar `npm install`

**Error: "Error consultando API de OCR"**
→ Verificar que API Python esté corriendo en puerto 8000

**Error: "Archivo PDF no encontrado"**
→ Verificar ruta en BD coincide con archivo físico

## 📚 Documentación Adicional

- **Instalación Poppler:** `INSTALACION_POPPLER.md`
- **API Integration:** `REVISION_ADMISIBILIDAD.md`

## 🎉 Resultado Final

Sistema completamente funcional que:
✅ Convierte PDFs a imágenes automáticamente
✅ Extrae dígitos vía OCR de API Python
✅ Muestra resultados en interfaz amigable
✅ Maneja errores y limpia recursos
✅ Listo para producción (con poppler instalado)

---

**¡El sistema está listo para usar!** 🚀
