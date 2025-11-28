# Instalación de Poppler para Conversión de PDF a Imágenes

## ¿Qué es Poppler?

Poppler es una biblioteca para renderizar PDFs. Incluye utilidades de línea de comandos como `pdftoppm` que convierte páginas PDF a imágenes.

## Instalación por Sistema Operativo

### Windows

1. **Descargar Poppler:**
   - Ir a: https://github.com/oschwartz10612/poppler-windows/releases
   - Descargar la última versión (ejemplo: `Release-24.08.0-0.zip`)

2. **Extraer el archivo:**
   ```
   C:\Program Files\poppler-24.08.0\
   ```

3. **Agregar al PATH:**
   - Abrir "Variables de entorno del sistema"
   - Editar la variable `Path`
   - Agregar: `C:\Program Files\poppler-24.08.0\Library\bin`
   - Clic en OK

4. **Verificar instalación:**
   ```powershell
   pdftoppm -v
   ```
   Debería mostrar la versión de poppler.

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install poppler-utils
```

Verificar:
```bash
pdftoppm -version
```

### macOS

```bash
brew install poppler
```

Verificar:
```bash
pdftoppm -version
```

## Uso en el Proyecto

Una vez instalado poppler, el sistema puede:

1. **Convertir PDFs a imágenes** automáticamente
2. **Enviar imágenes a la API Python** para OCR
3. **Extraer dígitos** usando `ocr_digits`

### Flujo de Trabajo

```
Entregable PDF → pdftoppm → Imágenes PNG → API Python → ocr_digits
```

### Configuración

En `.env`:
```bash
PYTHON_API_BASE_URL=http://127.0.0.1:8000
```

## Dependencias Node.js

Instalar las dependencias necesarias:

```bash
npm install form-data node-fetch
```

## API Python Esperada

**Endpoint:** `POST http://127.0.0.1:8000/predict?ocr=true&digits_only=true&digits_engine=auto`

**Body:** FormData con imagen
```
file: [archivo PNG/JPEG]
```

**Response esperado:**
```json
{
  "ocr_digits": {
    "numeros_encontrados": ["123.45", "67890"],
    "confianza": 0.95,
    "detalles": {}
  }
}
```

## Troubleshooting

### Error: "pdftoppm no encontrado"

**Solución:**
1. Verificar que poppler esté en el PATH
2. Reiniciar la terminal/IDE después de agregar al PATH
3. En Windows, usar PowerShell como administrador

### Error: "Cannot find module 'form-data'"

**Solución:**
```bash
cd C:\Users\AmarilisProject\Development\file-review
npm install
```

### Error: "ENOENT: no such file or directory"

**Solución:**
- Verificar que el archivo PDF existe en `public/uploads/`
- Verificar permisos de lectura del archivo

### API Python no responde

**Solución:**
1. Verificar que la API Python esté corriendo:
   ```bash
   curl http://127.0.0.1:8000/
   ```
2. Revisar logs del servidor Python
3. Verificar URL en `.env` (PYTHON_API_BASE_URL)

## Testing Manual

1. **Iniciar API Python:**
   ```bash
   # En el directorio de tu API Python
   python main.py  # o el comando que uses
   ```

2. **Iniciar backend Node.js:**
   ```bash
   cd C:\Users\AmarilisProject\Development\file-review
   node server.js
   ```

3. **Iniciar frontend:**
   ```bash
   cd fe-expedientes
   npm run dev
   ```

4. **Probar flujo completo:**
   - Crear proyecto con TDR
   - Subir entregables
   - Hacer clic en "Revisar Admisibilidad"
   - Ver resultados con `ocr_digits`

## Estructura de Archivos Temporales

El sistema crea imágenes temporales en:
```
C:\Users\AmarilisProject\Development\file-review\temp\pdf-images\
```

Estas se eliminan automáticamente después del procesamiento.

## Logs

Revisar logs para debugging:
```
C:\Users\AmarilisProject\Development\file-review\logs\
```

Buscar entradas con etiqueta `[PDFConverter]` o `[RevisionAdmisibilidad]`.

## Alternativas si Poppler No Está Disponible

Si no puedes instalar poppler, considera:

1. **pdf2pic** (requiere GraphicsMagick)
2. **pdf-lib + canvas** (más lento)
3. **Servicio externo** (CloudConvert, PDFtron)

Por ahora, el sistema requiere poppler para funcionar correctamente.
