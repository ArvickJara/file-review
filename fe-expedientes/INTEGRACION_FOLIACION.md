# Integración Frontend - API de Detección de Foliación

## 📋 Resumen

El frontend en `fe-expedientes` ahora integra la API de detección de foliación que utiliza:
- **Detección en la nube**: Roboflow para identificar celdas de foliación
- **OCR local**: Procesamiento de números en el servidor de la API (no en el navegador)

## 🏗️ Arquitectura de la Integración

```
┌─────────────────┐
│   Frontend      │
│  (React/Vite)   │
└────────┬────────┘
         │
         │ HTTP Request
         │ (Descarga PDF)
         ↓
┌─────────────────┐
│  Backend API    │
│  (Node.js)      │
│  Puerto 5000    │
└────────┬────────┘
         │
         │ PDF File
         ↓
┌─────────────────┐
│  API Foliación  │
│  (FastAPI)      │
│  Puerto 8000    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ↓         ↓
┌────────┐ ┌───────┐
│Roboflow│ │  OCR  │
│ (☁️)   │ │(Local)│
└────────┘ └───────┘
```

## 📁 Archivos Modificados/Creados

### 1. **Nuevo Servicio** 
`src/services/foliacionService.ts`
- ✅ Cliente para API de foliación
- ✅ Tipos TypeScript para respuestas
- ✅ Funciones de extracción de información
- ✅ Generador de observaciones automáticas
- ✅ Health check de la API

### 2. **Vista Actualizada**
`src/pages/contenido-minimo/Admisibilidad.tsx`
- ✅ Integración con servicio de foliación
- ✅ Revisión automática con IA
- ✅ Indicador de disponibilidad de API
- ✅ Actualización automática de evaluaciones
- ✅ Panel de resultados detallados de IA

### 3. **Configuración**
`.env.example`
- ✅ Variable `VITE_FOLIACION_API_URL`
- ✅ Documentación de variables requeridas

## 🚀 Configuración

### 1. Variables de Entorno

Crea un archivo `.env` en `fe-expedientes/`:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_FOLIACION_API_URL=http://127.0.0.1:8000
```

### 2. Instalar Dependencias

```bash
cd file-review/fe-expedientes
npm install
```

### 3. Ejecutar el Frontend

```bash
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

## 🔌 API Endpoints Utilizados

### Backend Principal (Puerto 5000)
- `GET /api/proyectos/:id` - Obtener datos del proyecto
- `GET /api/expedientes_tecnicos/documentos/:proyecto_id` - Listar documentos
- `GET /api/expedientes_tecnicos/documento/:id/download` - Descargar PDF

### API Foliación (Puerto 8000)
- `POST /process-pdf` - Procesar PDF completo
- `GET /` - Health check

## 📊 Flujo de Revisión Automática

1. **Usuario hace clic en "Revisar con IA"**
2. **Frontend verifica** disponibilidad de API (health check)
3. **Para cada documento**:
   - Descarga PDF del backend principal
   - Envía PDF a API de foliación
   - Procesa respuesta y extrae información
   - Actualiza campos de evaluación automáticamente
   - Muestra progreso en tiempo real

## 🎨 Componentes UI Nuevos

### Indicador de API
```tsx
{foliacionApiDisponible ? (
  <span className="bg-emerald-50 text-emerald-700">
    ✨ API IA activa
  </span>
) : (
  <span className="bg-amber-50 text-amber-700">
    ⚠️ API IA no disponible
  </span>
)}
```

### Botón de Revisión Automática
- Deshabilitado si API no está disponible
- Muestra loader durante procesamiento
- Tooltip con información de error

### Panel de Resultados Detallados
- Métricas por documento
- Gráficos de coincidencia
- Información de arquitectura híbrida
- Detalles de confianza y legibilidad

## 🔧 Funciones Principales

### `processPdfFoliacion(file, options)`
Envía un PDF a la API de foliación con opciones configurables:

```typescript
const resultado = await processPdfFoliacion(pdfFile, {
  dpi: 300,
  min_confidence: 0.5,
  ocr: true,
  digits_only: true,
  digits_engine: 'auto'
});
```

### `extractFoliacionInfo(result)`
Extrae información útil de los resultados:

```typescript
const info = extractFoliacionInfo(resultado);
// info contiene:
// - totalPages
// - lastFolio
// - exactMatchPercentage
// - averageConfidence
// - legibilityScore
// - isContinuous
```

### `generateObservations(result)`
Genera observaciones automáticas en español:

```typescript
const observations = generateObservations(resultado);
// Array de strings con observaciones
```

## 🎯 Campos Actualizados Automáticamente

Cuando se completa la revisión automática, se actualizan:

1. **Sin Hojas en Blanco**
   - ✅ Cumple: Si todas las páginas tienen foliación
   - ❌ No cumple: Si hay páginas sin detección

2. **Foliación**
   - Total de páginas detectadas
   - Último folio consignado

3. **Legibilidad**
   - Texto: Basado en score de legibilidad
   - Foliado: Basado en confianza promedio
   - Imagen: Basado en score de legibilidad

4. **Observaciones**
   - Generadas automáticamente
   - Incluyen estadísticas y alertas

## ⚠️ Manejo de Errores

### API No Disponible
```typescript
if (!foliacionApiDisponible) {
  alert('La API de detección de foliación no está disponible...');
  return;
}
```

### Error en Procesamiento
```typescript
catch (error) {
  console.error(`Error revisando ${tomo.id}:`, error);
  setProgresoRevision(prev => ({ ...prev, [tomo.id]: 'error' }));
  // Actualiza observaciones con el error
}
```

## 🧪 Pruebas

### 1. Verificar Conexión
- El indicador debe mostrar "API IA activa" si el servidor está corriendo
- Si no está disponible, el botón de revisión estará deshabilitado

### 2. Probar Revisión Automática
1. Selecciona un proyecto con documentos
2. Haz clic en "Revisar con IA"
3. Observa el progreso por cada documento
4. Verifica que los campos se llenen automáticamente
5. Revisa el panel de "Resultados de Detección IA"

## 📈 Métricas Mostradas

Para cada documento procesado:
- Total de páginas
- Último folio detectado
- Número de detecciones
- Confianza promedio
- Páginas con detección
- Páginas con coincidencia exacta
- Foliación continua (Sí/No)
- Score de legibilidad (ALTA/MEDIA/BAJA)

## 🔐 Seguridad y Privacidad

- ✅ **Detección en la nube**: Solo imágenes de las páginas
- ✅ **OCR local**: Los números extraídos se procesan en el servidor de la API
- ✅ **No se almacenan**: Los PDFs no se guardan en Roboflow
- ✅ **Tokens seguros**: API key no expuesta en frontend

## 🐛 Troubleshooting

### El botón está deshabilitado
1. Verifica que la API esté corriendo: `http://127.0.0.1:8000/docs`
2. Revisa la consola del navegador para errores
3. Confirma variable de entorno `VITE_FOLIACION_API_URL`

### No se descargan los PDFs
1. Verifica que el backend principal esté corriendo en puerto 5000
2. Confirma que los documentos tengan archivos asociados
3. Revisa permisos de descarga

### Resultados incorrectos
1. Ajusta parámetros en `processPdfFoliacion`:
   - `min_confidence`: Aumentar para mayor precisión
   - `dpi`: Aumentar para mejor calidad (más lento)
   - `digits_engine`: Cambiar motor OCR

## 📚 Recursos Adicionales

- [Documentación de la API de Foliación](../../bind-pdf/INICIO_RAPIDO.md)
- [Arquitectura Híbrida](../../bind-pdf/ejemplo_hibrido.md)
- [Comparación de Modos](../../bind-pdf/comparacion_modos.py)

## 🎉 ¡Listo!

El frontend ahora puede:
- ✅ Detectar foliación automáticamente
- ✅ Extraer números de folio
- ✅ Validar continuidad
- ✅ Evaluar legibilidad
- ✅ Generar observaciones
- ✅ Mostrar resultados detallados

Todo con la arquitectura híbrida: **Detección en la nube + OCR local**.
