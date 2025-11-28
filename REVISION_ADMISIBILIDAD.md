# Integración de Revisión de Admisibilidad

## Descripción

El sistema ahora cuenta con revisión automática de admisibilidad de entregables, procesando cada tomo a través del backend Python.

## Componentes Frontend

### Nuevas Interfaces TypeScript

```typescript
interface RevisionAdmisibilidad {
    tomo_id: string;
    estado: 'pendiente' | 'procesando' | 'completado' | 'error';
    progreso?: number;
    resultado?: {
        admisible: boolean;
        puntaje?: number;
        observaciones: Array<{
            tipo: 'critico' | 'advertencia' | 'info';
            seccion: string;
            mensaje: string;
        }>;
        detalles?: any;
    };
    error?: string;
    fecha_revision?: string;
}
```

### Funcionalidad

1. **Botón "Revisar Admisibilidad"**: Ubicado en la sección de entregables registrados
2. **Indicadores de Estado**: Cada tomo muestra su estado de revisión en tiempo real
3. **Modal de Resultados**: Vista detallada con observaciones por tomo
4. **Procesamiento Secuencial**: Los tomos se revisan uno por uno para evitar sobrecarga

## API Backend Python

### Endpoint Esperado

**POST** `/api/revisar-admisibilidad`

#### Request Body
```json
{
  "proyecto_id": "string",
  "tdr_id": "string",
  "tomo_id": "string",
  "tomo_orden": 1,
  "tomo_nombre": "TOMO I.pdf"
}
```

#### Response Exitoso (200)
```json
{
  "success": true,
  "data": {
    "admisible": true,
    "puntaje": 95,
    "observaciones": [
      {
        "tipo": "info",
        "seccion": "Memoria Descriptiva",
        "mensaje": "Documento completo y cumple requisitos"
      },
      {
        "tipo": "advertencia",
        "seccion": "Especificaciones Técnicas",
        "mensaje": "Falta detalle en ítem 3.2"
      },
      {
        "tipo": "critico",
        "seccion": "Presupuesto",
        "mensaje": "No se encontró análisis de precios unitarios"
      }
    ],
    "detalles": {
      "tiempo_procesamiento": "45s",
      "paginas_analizadas": 150,
      "modelo_utilizado": "gpt-4"
    }
  }
}
```

#### Response con Error (4xx/5xx)
```json
{
  "success": false,
  "error": "Mensaje de error descriptivo"
}
```

## Configuración

### Variables de Entorno (.env)

```bash
# Backend Node.js (existente)
VITE_API_BASE_URL=http://localhost:5000

# Backend Python para revisión de admisibilidad
VITE_PYTHON_API_BASE_URL=http://localhost:8000
```

### Ajustar URL del Backend Python

Si tu backend Python corre en un puerto diferente o URL distinta, actualiza la variable `VITE_PYTHON_API_BASE_URL` en el archivo `.env`.

## Flujo de Trabajo

1. Usuario carga TDR del proyecto
2. Usuario sube entregables (tomos PDF)
3. Usuario hace clic en **"Revisar Admisibilidad"**
4. Sistema procesa cada tomo secuencialmente:
   - Estado cambia a "Procesando..."
   - Se envía request al backend Python
   - Se recibe y muestra resultado
5. Al completar todos, se abre modal con resultados detallados
6. Cada tomo muestra badge visual:
   - ✅ Verde: Admisible
   - ❌ Rojo: No admisible
   - ⚠️ Naranja: Error en procesamiento
   - ⏱️ Gris: Pendiente

## Tipos de Observaciones

### Crítico (●)
- Faltantes obligatorios
- Incumplimientos normativos graves
- Documentos ilegibles

### Advertencia (▲)
- Información incompleta
- Recomendaciones de mejora
- Formatos no estándar

### Información (○)
- Confirmaciones de cumplimiento
- Sugerencias opcionales
- Notas generales

## Desarrollo Backend Python

### Requisitos Mínimos

Tu backend Python debe:

1. **Recibir datos del tomo**: ID, orden, nombre, proyecto asociado
2. **Procesar el documento**: Extraer texto, analizar estructura, validar contenido
3. **Retornar evaluación estructurada**: Admisible/No admisible + observaciones detalladas
4. **Manejo de errores**: Responder apropiadamente ante fallos

### Ejemplo Implementación FastAPI

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

class ObservacionRevision(BaseModel):
    tipo: str  # "critico" | "advertencia" | "info"
    seccion: str
    mensaje: str

class ResultadoRevision(BaseModel):
    admisible: bool
    puntaje: Optional[int] = None
    observaciones: List[ObservacionRevision]
    detalles: Optional[dict] = None

class RequestRevision(BaseModel):
    proyecto_id: str
    tdr_id: str
    tomo_id: str
    tomo_orden: int
    tomo_nombre: str

@app.post("/api/revisar-admisibilidad")
async def revisar_admisibilidad(request: RequestRevision):
    try:
        # 1. Obtener archivo del tomo desde base de datos
        archivo_path = obtener_ruta_documento(request.tomo_id)
        
        # 2. Procesar documento
        resultado = procesar_tomo(archivo_path, request.tdr_id)
        
        # 3. Retornar resultado
        return {
            "success": True,
            "data": resultado.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def procesar_tomo(archivo_path: str, tdr_id: str) -> ResultadoRevision:
    # Tu lógica de procesamiento aquí
    # - Extraer texto del PDF
    # - Analizar estructura vs TDR
    # - Generar observaciones
    # - Calcular puntaje
    pass

def obtener_ruta_documento(tomo_id: str) -> str:
    # Consultar base de datos para obtener ruta del archivo
    pass
```

## Testing

### Prueba Manual

1. Inicia el backend Python en el puerto configurado
2. Carga un proyecto con TDR
3. Sube al menos un entregable
4. Haz clic en "Revisar Admisibilidad"
5. Verifica que aparecen los estados y resultados

### Mock Response

Para testing sin backend, puedes crear un mock en el frontend:

```typescript
// Mock para testing sin backend Python
const mockRevision = {
  admisible: true,
  puntaje: 85,
  observaciones: [
    { tipo: 'info', seccion: 'Memoria Descriptiva', mensaje: 'Completo' },
    { tipo: 'advertencia', seccion: 'Presupuesto', mensaje: 'Revisar ítem 5' }
  ]
};
```

## Próximos Pasos

1. ✅ Frontend preparado para revisión automática
2. ⏳ Implementar backend Python con lógica de análisis
3. ⏳ Conectar con base de datos para obtener archivos
4. ⏳ Implementar análisis por IA (GPT-4, Claude, etc.)
5. ⏳ Guardar resultados de revisión en base de datos
6. ⏳ Generar reportes PDF de admisibilidad

## Notas Importantes

- **Procesamiento Secuencial**: Los tomos se procesan uno por uno, no en paralelo
- **Timeout**: Considera agregar timeout si el procesamiento puede tardar mucho
- **Reintentos**: El frontend actualmente no reintenta en caso de error
- **Persistencia**: Los resultados solo están en memoria, considera guardarlos en BD
- **CORS**: Asegúrate que el backend Python permita requests desde el frontend

## Soporte

Para consultas o problemas con la integración, revisa:
- Logs del navegador (consola)
- Network tab para ver requests/responses
- Logs del backend Python
- Variables de entorno correctamente configuradas
