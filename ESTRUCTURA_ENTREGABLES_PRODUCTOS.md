# Nueva Estructura: Entregables → Productos → Archivos

## Resumen del Cambio

Se ha reformulado la estructura de proyectos para reflejar mejor la realidad de los entregables:

**Antes:**
- Proyecto → Entregables (archivos directos)

**Ahora:**
- Proyecto → Entregables → Productos → Archivos

## Jerarquía Completa

```
PROYECTO (Ej: "Mejoramiento del Servicio Educativo")
│
├─ ENTREGABLE 1 (Ej: "Primer Entregable - 30%")
│  ├─ PRODUCTO 1.1 (Ej: "Informe Técnico de Topografía")
│  │  ├─ Archivo 1: memoria_descriptiva.pdf
│  │  ├─ Archivo 2: panel_fotografico.pdf
│  │  └─ Archivo 3: anexos.pdf
│  │
│  ├─ PRODUCTO 1.2 (Ej: "Planos Topográficos")
│  │  ├─ Archivo 1: plano_ubicacion_A1.pdf
│  │  └─ Archivo 2: plano_perimetrico_A1.pdf
│  │
│  └─ PRODUCTO 1.3 (Ej: "Estudio de Suelos")
│     ├─ Archivo 1: informe_ensayos.pdf
│     └─ Archivo 2: resultados_laboratorio.xlsx
│
├─ ENTREGABLE 2 (Ej: "Segundo Entregable - 40%")
│  ├─ PRODUCTO 2.1 (Ej: "Memoria Descriptiva de Arquitectura")
│  │  └─ Archivo 1: memoria_arquitectura.pdf
│  │
│  ├─ PRODUCTO 2.2 (Ej: "Planos de Arquitectura")
│  │  ├─ Archivo 1: plantas_A1.pdf
│  │  ├─ Archivo 2: cortes_A1.pdf
│  │  └─ Archivo 3: elevaciones_A1.pdf
│  │
│  └─ PRODUCTO 2.3 (Ej: "Especificaciones Técnicas")
│     └─ Archivo 1: especificaciones.pdf
│
└─ ENTREGABLE 3 (Ej: "Entregable Final - 30%")
   ├─ PRODUCTO 3.1 (Ej: "Presupuesto Final")
   │  ├─ Archivo 1: presupuesto.xlsx
   │  └─ Archivo 2: analisis_precios.xlsx
   │
   └─ PRODUCTO 3.2 (Ej: "Cronograma de Obra")
      └─ Archivo 1: cronograma_gantt.pdf
```

## Tablas de Base de Datos

### 1. `tdr_entregable`
Representa cada entregable del proyecto con su información de pago.

```sql
CREATE TABLE tdr_entregable (
    id INT PRIMARY KEY AUTO_INCREMENT,
    proyecto_id VARCHAR(255) NOT NULL,
    nombre_entregable VARCHAR(255) NOT NULL,
    porcentaje_pago DECIMAL(5,2),
    plazo_dias INT,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (proyecto_id) REFERENCES proyecto(id) ON DELETE CASCADE
);
```

**Ejemplo de datos:**
| id | proyecto_id | nombre_entregable | porcentaje_pago | plazo_dias |
|----|-------------|-------------------|-----------------|------------|
| 1  | 1732567890  | Primer Entregable | 30.00          | 45         |
| 2  | 1732567890  | Segundo Entregable| 40.00          | 60         |
| 3  | 1732567890  | Entregable Final  | 30.00          | 90         |

### 2. `tdr_producto` (Nueva tabla)
Representa cada producto dentro de un entregable.

```sql
CREATE TABLE tdr_producto (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entregable_id INT NOT NULL,
    nombre_producto VARCHAR(255) NOT NULL,
    descripcion TEXT,
    orden INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (entregable_id) REFERENCES tdr_entregable(id) ON DELETE CASCADE
);
```

**Ejemplo de datos:**
| id | entregable_id | nombre_producto | descripcion | orden |
|----|---------------|-----------------|-------------|-------|
| 1  | 1             | Informe Técnico de Topografía | Memoria descriptiva con levantamiento topográfico | 1 |
| 2  | 1             | Planos Topográficos | Planos en formato A1 | 2 |
| 3  | 1             | Estudio de Suelos | Informe con ensayos de laboratorio | 3 |
| 4  | 2             | Memoria Descriptiva de Arquitectura | Descripción del proyecto arquitectónico | 1 |
| 5  | 2             | Planos de Arquitectura | Plantas, cortes y elevaciones | 2 |

### 3. `documentos` (Actualizada)
Representa cada archivo físico. Ahora incluye relación con `producto_id`.

```sql
ALTER TABLE documentos 
ADD COLUMN producto_id INT UNSIGNED NULL,
ADD FOREIGN KEY (producto_id) REFERENCES tdr_producto(id) ON DELETE SET NULL;
```

**Campos de la tabla:**
- `id`: Identificador único del documento
- `proyecto_id`: ID del proyecto al que pertenece
- `producto_id`: **NUEVO** - ID del producto al que pertenece (nullable)
- `nombre_archivo`: Nombre del archivo
- `ruta_archivo`: Ruta en el servidor
- `tipo_documento`: 'tdr', 'entregable', 'producto', etc.
- `orden`: Orden dentro del producto
- `estado`: 'pendiente', 'en_revision', 'aprobado'
- `fecha_subida`: Timestamp de cuando se subió

**Ejemplo de datos:**
| id | proyecto_id | producto_id | nombre_archivo | tipo_documento | orden |
|----|-------------|-------------|----------------|----------------|-------|
| 101| 1732567890  | 1           | memoria_descriptiva.pdf | producto | 1 |
| 102| 1732567890  | 1           | panel_fotografico.pdf | producto | 2 |
| 103| 1732567890  | 2           | plano_ubicacion_A1.pdf | producto | 1 |
| 104| 1732567890  | 2           | plano_perimetrico_A1.pdf | producto | 2 |
| 105| 1732567890  | 3           | informe_ensayos.pdf | producto | 1 |

## API Endpoints

### Productos

#### 1. Obtener productos de un entregable
```
GET /api/entregable/:entregableId/productos
```

**Respuesta:**
```json
{
  "success": true,
  "productos": [
    {
      "id": 1,
      "entregable_id": 1,
      "nombre_producto": "Informe Técnico de Topografía",
      "descripcion": "Memoria descriptiva con levantamiento topográfico",
      "orden": 1,
      "created_at": "2025-12-05T10:30:00.000Z"
    }
  ]
}
```

#### 2. Crear un producto
```
POST /api/entregable/:entregableId/productos
```

**Body:**
```json
{
  "nombre_producto": "Planos Topográficos",
  "descripcion": "Planos en formato A1",
  "orden": 2
}
```

#### 3. Actualizar un producto
```
PUT /api/productos/:id
```

**Body:**
```json
{
  "nombre_producto": "Planos Topográficos Actualizados",
  "descripcion": "Versión final de planos",
  "orden": 2
}
```

#### 4. Eliminar un producto
```
DELETE /api/productos/:id
```

⚠️ **Nota:** No se puede eliminar un producto si tiene documentos asociados.

#### 5. Obtener archivos de un producto
```
GET /api/productos/:id/archivos
```

## Flujo de Trabajo Recomendado

### 1. Crear Proyecto
```javascript
POST /api/proyectos
{
  "nombre": "Mejoramiento del Servicio Educativo",
  "cui": "2468123",
  "numero_entregables": 3,
  "descripcion": "Proyecto de infraestructura educativa"
}
```

### 2. Crear Entregables
```javascript
// Se crean automáticamente al procesar el TDR
// O manualmente:
POST /api/tdr/entregables
{
  "proyecto_id": "1732567890",
  "nombre_entregable": "Primer Entregable",
  "porcentaje_pago": 30,
  "plazo_dias": 45
}
```

### 3. Crear Productos por Entregable
```javascript
POST /api/entregable/1/productos
{
  "nombre_producto": "Informe Técnico de Topografía",
  "descripcion": "Memoria descriptiva con levantamiento topográfico",
  "orden": 1
}

POST /api/entregable/1/productos
{
  "nombre_producto": "Planos Topográficos",
  "descripcion": "Planos en formato A1",
  "orden": 2
}
```

### 4. Subir Archivos a Productos
```javascript
POST /api/expedientes_tecnicos/documento
FormData {
  file: [archivo PDF],
  proyectoId: "1732567890",
  productoId: 1,  // ← Nuevo campo
  orden: 1
}
```

## Ventajas de esta Estructura

### ✅ **Organización Clara**
- Refleja la estructura real de TDRs: Entregable → Producto → Archivos
- Facilita la navegación y búsqueda de documentos

### ✅ **Flexibilidad**
- Un producto puede tener múltiples archivos
- Un entregable puede tener múltiples productos
- Fácil agregar/quitar productos sin afectar otros

### ✅ **Trazabilidad**
- Se puede rastrear exactamente qué archivos pertenecen a qué producto
- Facilita auditorías y revisiones

### ✅ **Escalabilidad**
- Permite agregar más niveles si es necesario
- Facilita reportes por producto o por entregable

## Migración de Datos Existentes

Para proyectos que ya tienen documentos sin `producto_id`:

1. Los documentos existentes permanecen con `producto_id = NULL`
2. Se pueden asociar manualmente posteriormente
3. O crear productos "Documentos Generales" y asociarlos automáticamente

```sql
-- Crear producto genérico para documentos sin clasificar
INSERT INTO tdr_producto (entregable_id, nombre_producto, orden)
VALUES (1, 'Documentos Generales', 999);

-- Asociar documentos huérfanos
UPDATE documentos 
SET producto_id = LAST_INSERT_ID() 
WHERE producto_id IS NULL AND proyecto_id = '1732567890';
```

## Próximos Pasos

### Frontend
- [ ] Actualizar interfaz de creación de proyectos
- [ ] Agregar gestión de productos por entregable
- [ ] Permitir subir archivos por producto
- [ ] Visualizar estructura jerárquica completa

### Backend
- [x] Crear tabla `tdr_producto`
- [x] Agregar `producto_id` a `documentos`
- [x] Implementar endpoints CRUD para productos
- [ ] Actualizar endpoint de subida de archivos
- [ ] Agregar validaciones de relaciones

### Base de Datos
- [x] Ejecutar migraciones
- [x] Actualizar esquema DBML
- [ ] Crear índices para optimizar consultas
- [ ] Agregar triggers para validaciones

## Preguntas Frecuentes

**Q: ¿Qué pasa con los proyectos existentes?**  
A: Los proyectos existentes siguen funcionando. Los documentos sin `producto_id` se muestran como documentos no clasificados.

**Q: ¿Es obligatorio usar productos?**  
A: No, `producto_id` es nullable. Los documentos pueden asociarse directamente al proyecto sin pasar por productos.

**Q: ¿Puedo mover archivos entre productos?**  
A: Sí, actualizando el `producto_id` del documento.

**Q: ¿Se eliminan los archivos al eliminar un producto?**  
A: No, la relación es `ON DELETE SET NULL`, los documentos quedan sin clasificar.

---

**Fecha de implementación:** 5 de Diciembre, 2025  
**Versión de la base de datos:** Batch 4  
**Archivos de migración:**
- `20251205000001_create_productos.js`
- `20251205000002_add_producto_to_documentos.js`
