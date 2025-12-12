# 🚀 Inicio Rápido - Integración Completa

## ✅ ¿Qué se ha implementado?

Se ha integrado la API de detección de foliación (arquitectura híbrida: nube + local) en el frontend de admisibilidad.

## 📋 Pasos para Ejecutar

### 1. Configurar Variables de Entorno

Crea el archivo `.env` en `file-review/fe-expedientes/`:

```bash
cd file-review/fe-expedientes
cp .env.example .env
```

Contenido de `.env`:
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_FOLIACION_API_URL=http://127.0.0.1:8000
```

### 2. Iniciar las APIs (en diferentes terminales)

#### Terminal 1 - API de Foliación (Puerto 8000)
```powershell
cd bind-pdf
.\.venv\Scripts\Activate.ps1
python -m uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

Deberías ver:
```
INFO: Uvicorn running on http://127.0.0.1:8000
```

#### Terminal 2 - Backend Principal (Puerto 5000)
```powershell
cd file-review
npm start
# o
node server.js
```

Deberías ver:
```
Server running on port 5000
```

#### Terminal 3 - Frontend (Puerto 5173)
```powershell
cd file-review/fe-expedientes
npm install  # Solo la primera vez
npm run dev
```

Deberías ver:
```
VITE ready in XXX ms
Local: http://localhost:5173/
```

### 3. Verificar Integración

1. **Abre el navegador**: `http://localhost:5173`
2. **Navega a**: Proyectos → Selecciona un proyecto → Admisibilidad
3. **Verifica el indicador**: Debe mostrar "✨ API IA activa" (verde)
4. **Prueba la revisión**: Haz clic en "Revisar con IA (Nube+Local)"

## 🎯 Lo que Hace la Revisión Automática

1. **Descarga** cada PDF del proyecto
2. **Envía** a la API de foliación (puerto 8000)
3. **Procesa** con:
   - 🌐 Detección de celdas: Roboflow (nube)
   - 💻 OCR de números: Local (servidor)
4. **Actualiza** automáticamente:
   - ✓ Hojas en blanco
   - ✓ Total de páginas
   - ✓ Último folio
   - ✓ Legibilidad
   - ✓ Observaciones
5. **Muestra** resultados detallados con métricas de IA

## 📊 Vista de Admisibilidad

La interfaz ahora incluye:

- **Indicador de API**: Verde si está activa, amarillo si no
- **Botón inteligente**: "Revisar con IA (Nube+Local)"
- **Progreso en tiempo real**: Por cada documento
- **Panel de resultados**: Métricas detalladas de IA
- **Autocompletado**: Campos llenados automáticamente

## 🔍 Verificar que Todo Funciona

### Health Check Manual

```bash
# API de Foliación
curl http://127.0.0.1:8000/

# Backend Principal
curl http://localhost:5000/api/health
```

### En el Frontend

1. El indicador debe estar verde: "✨ API IA activa"
2. El botón debe estar habilitado (no gris)
3. Al hacer clic, debe mostrar "Revisando con IA..."
4. Los campos se deben llenar automáticamente
5. Debe aparecer el panel "Resultados de Detección IA"

## 🐛 Solución de Problemas

### Indicador muestra "API IA no disponible" (amarillo)

**Causa**: La API de foliación no está corriendo

**Solución**:
```powershell
cd bind-pdf
.\.venv\Scripts\Activate.ps1
python -m uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

### Error: "No se pudo descargar el PDF"

**Causa**: El backend principal no está corriendo o el documento no existe

**Solución**:
1. Verifica que el backend esté en puerto 5000
2. Confirma que el proyecto tenga documentos cargados
3. Revisa la consola del navegador para más detalles

### Campos no se actualizan automáticamente

**Causa**: Error en el procesamiento

**Solución**:
1. Revisa la consola del navegador (F12)
2. Verifica los logs de la API de foliación
3. Confirma que el PDF sea válido y no esté corrupto

### Revisión muy lenta

**Causa**: PDFs grandes o muchas páginas

**Solución**:
- Es normal, la detección en la nube puede tardar ~500ms por página
- Para PDFs de 100+ páginas, espera 1-2 minutos
- El progreso se muestra en tiempo real

## 📁 Estructura de Archivos

```
file-review/
├── fe-expedientes/
│   ├── .env                              # ← CREAR (usa .env.example)
│   ├── .env.example                      # ✅ NUEVO
│   ├── INTEGRACION_FOLIACION.md         # ✅ NUEVO (documentación técnica)
│   ├── src/
│   │   ├── services/
│   │   │   └── foliacionService.ts      # ✅ NUEVO (cliente API)
│   │   └── pages/
│   │       └── contenido-minimo/
│   │           └── Admisibilidad.tsx    # ✅ MODIFICADO
│   └── package.json
└── server.js

bind-pdf/
├── api.py                                # ✅ Usando arquitectura híbrida
├── test_roboflow_connection.py          # ✅ NUEVO (verificar conexión)
├── INICIO_RAPIDO.md                     # ✅ NUEVO
├── CAMBIOS_HIBRIDO.md                   # ✅ NUEVO
├── ejemplo_hibrido.md                   # ✅ NUEVO
└── requirements.txt                      # ✅ MODIFICADO
```

## 🎉 ¡Todo Listo!

Ahora tienes:
- ✅ API de foliación configurada (híbrida)
- ✅ Frontend integrado con revisión automática
- ✅ Actualización automática de campos
- ✅ Visualización de resultados detallados
- ✅ Indicadores de estado en tiempo real

## 📚 Documentación Completa

- **Técnica**: `INTEGRACION_FOLIACION.md`
- **API**: `../../bind-pdf/INICIO_RAPIDO.md`
- **Arquitectura**: `../../bind-pdf/ejemplo_hibrido.md`

## 🆘 ¿Necesitas Ayuda?

1. Revisa los logs en las 3 terminales
2. Verifica la consola del navegador (F12)
3. Consulta `INTEGRACION_FOLIACION.md` para detalles técnicos
4. Ejecuta `python test_roboflow_connection.py` para verificar Roboflow

---

**Arquitectura**: 🌐 Detección en Roboflow + 💻 OCR Local = ⚡ Mejor precisión + privacidad
