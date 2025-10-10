const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const multer = require('multer');
const upload = multer();
const OpenAI = require('openai');

const logger = require('../utils/logger');
const db = require('../db/knex');

// Usa el mismo directorio de uploads que expedientes_tecnicos.js
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');

// OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'o3';

// Utils
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function listPngsSorted(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(f => path.join(dir, f));
}

async function pdfToPngs(pdfPath, outDir, dpi = 150, force = false) {
  ensureDir(outDir);
  if (!force) {
    const existing = listPngsSorted(outDir);
    if (existing.length > 0) return existing;
  }
  const prefix = path.join(outDir, 'page');
  await execAsync(`pdftoppm -png -r ${dpi} "${pdfPath}" "${prefix}"`);
  return listPngsSorted(outDir);
}

async function extractTdrText(filePath) {
  const lower = filePath.toLowerCase();
  try {
    // DOC/DOCX con docx2txt
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
      const cmd = `python3 -c "import sys, docx2txt; print(docx2txt.process(sys.argv[1]))" ${JSON.stringify(filePath)}`;
      const { stdout } = await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
      if (stdout && stdout.trim().length > 0) return stdout;

      // fallback a PDF
      const outDir = path.dirname(filePath);
      const convertCmd = `libreoffice --headless --convert-to pdf --outdir ${JSON.stringify(outDir)} ${JSON.stringify(filePath)}`;
      await execAsync(convertCmd, { maxBuffer: 50 * 1024 * 1024 });
      const pdfName = path.basename(filePath).replace(/\.(docx?|odt)$/i, '.pdf');
      const pdfPath = path.join(outDir, pdfName);
      if (fs.existsSync(pdfPath)) {
        const { stdout: pdfText } = await execAsync(`pdftotext ${JSON.stringify(pdfPath)} -`, { maxBuffer: 50 * 1024 * 1024 });
        return pdfText;
      }
    }

    // PDF con texto
    if (lower.endsWith('.pdf')) {
      const { stdout } = await execAsync(`pdftotext ${JSON.stringify(filePath)} -`, { maxBuffer: 50 * 1024 * 1024 });
      return stdout;
    }
  } catch (e) {
    logger.warn(`No se pudo extraer texto del TDR: ${e.message}`, 'ContenidoMinimo');
  }
  return '(No fue posible extraer texto del TDR)';
}

function encodeImagesBase64(files, limit) {
  const result = [];
  const n = Math.min(files.length, limit);
  for (let i = 0; i < n; i++) {
    const b = fs.readFileSync(files[i]);
    result.push(b.toString('base64'));
  }
  return result;
}

// POST /api/expedientes_tecnicos/evaluar-contenido-minimo
router.post('/evaluar-contenido-minimo', upload.none(), async (req, res) => {
  try {
    logger.info(`ContenidoMinimo body keys: ${Object.keys(req.body).join(', ')}`, 'ContenidoMinimo');

    const { proyecto_id, tdr_id } = req.body;
    const force = req.query.force === 'true' || req.body.force === 'true';

    const ids = new Set();
    const add = (v) => {
      if (!v) return;
      if (Array.isArray(v)) v.forEach((x) => ids.add(String(x)));
      else ids.add(String(v));
    };
    add(req.body['tomo_ids']);
    add(req.body['tomo_ids[]']);
    if (req.body.tomo_ids_csv) {
      String(req.body.tomo_ids_csv)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((x) => ids.add(x));
    }
    if (req.body.tomo_ids_json) {
      try {
        const arr = JSON.parse(req.body.tomo_ids_json);
        if (Array.isArray(arr)) arr.forEach((x) => ids.add(String(x)));
      } catch { }
    }
    const tomoIds = Array.from(ids).filter(Boolean);

    if (!proyecto_id || !tdr_id || tomoIds.length === 0) {
      logger.warn(
        `Validación fallida: proyecto_id=${proyecto_id} tdr_id=${tdr_id} tomoIds=${JSON.stringify(tomoIds)}`,
        'ContenidoMinimo'
      );
      return res.status(400).json({ success: false, message: 'proyecto_id, tdr_id y tomo_ids son requeridos' });
    }

    const proyecto = await db('proyectos').where('id', proyecto_id).first();
    const tdr = await db('documentos').where({ id: tdr_id, proyecto_id }).first();
    const tomos = await db('documentos').whereIn('id', tomoIds).andWhere('proyecto_id', proyecto_id);

    if (!proyecto || !tdr || tomos.length === 0) {
      return res.status(404).json({ success: false, message: 'Proyecto/TDR/Tomos no encontrados' });
    }

    const tdrPath = path.join(uploadsDir, tdr.ruta_archivo || tdr.path || '');
    const tdrText = await extractTdrText(tdrPath);

    const baseOut = path.join(uploadsDir, 'derivados', 'contenido_minimo', proyecto_id);
    ensureDir(baseOut);

    const allTomosPngs = [];
    const tomosStorage = [];
    for (const doc of tomos) {
      const pdfPath = path.join(uploadsDir, doc.ruta_archivo || doc.path || '');
      const outDir = path.join(baseOut, `tomo-${doc.id}`);
      try {
        const pngs = await pdfToPngs(pdfPath, outDir, 150, force);
        if (pngs.length > 0) {
          allTomosPngs.push({ id: doc.id, nombre: doc.nombre_archivo || doc.nombre, files: pngs });
          tomosStorage.push({ id: doc.id, nombre: doc.nombre_archivo || doc.nombre, dir: outDir, paginas: pngs.length });
        }
      } catch (e) {
        logger.warn(`Error generando imágenes para ${doc.nombre_archivo || doc.nombre}: ${e.message}`, 'ContenidoMinimo');
      }
    }

    const totalImages = allTomosPngs.reduce((acc, t) => acc + t.files.length, 0);
    if (totalImages === 0) {
      return res.status(500).json({ success: false, message: 'No se generaron imágenes de los tomos' });
    }

    // 6) Selección de imágenes para IA
    const MAX_TOTAL_IMAGES = 40;
    const MAX_PER_TOMO = 10;
    const imagesForAI = [];
    for (const pack of allTomosPngs) {
      if (imagesForAI.length >= MAX_TOTAL_IMAGES) break;
      const remaining = MAX_TOTAL_IMAGES - imagesForAI.length;
      imagesForAI.push(...encodeImagesBase64(pack.files, Math.min(MAX_PER_TOMO, remaining)));
    }

    // 7) Prompt para IA
    const prompt = `
Eres REVISOR TÉCNICO de expedientes. Evalúa el **CONTENIDO MÍNIMO** del Expediente Técnico (ET) comparando el **TDR** con los **TOMOS** (páginas en imagen/OCR).
No inventes contenido: si algo **no aparece claramente** en las páginas analizadas, marca **FALTA** y explica. Si el texto es ilegible por OCR, marca **OCR_DEFICIENTE**.

## OBJETIVO
Determinar si el ET cumple el contenido mínimo exigido por el TDR. Prioriza **Memoria Descriptiva** y luego las demás secciones.

## ENTRADAS
- TDR (texto): <<INICIO_TDR>>
${tdrText.substring(0, 14000)}
<<FIN_TDR>>
- Proyecto: ${proyecto?.nombre || proyecto?.codigo_proyecto || proyecto?.id}
- Entidad: ${proyecto?.entidad_ejecutora || 'N/A'}
- Páginas analizadas (imágenes): ${imagesForAI.length}

## TOMOS DISPONIBLES
${tomosStorage.map((t, i) => `- TOMO ${i + 1}: ${t.nombre} (${t.paginas} páginas)`).join('\n')}

⚠️ IMPORTANTE:
- Usa únicamente los TOMOS listados arriba en tus evidencias (ejemplo: TOMO I, TOMO II).
- No inventes TOMOS que no están en la lista.
- Si no encuentras evidencia en los tomos cargados, deja el arreglo "evidencias" vacío.

## SECCIONES A EVALUAR (palabras clave orientativas)
1) memoria_descriptiva
  Debe incluir: objetivos, antecedentes, alcance, localización, beneficiarios, **marco normativo**, criterios de diseño.
2) especificaciones_tecnicas
  Deben existir por partida (materiales, ejecución, controles, medición y forma de pago).
3) planos
  Listado y presencia de planos por especialidad (carátula, escala, versión/fecha/firma).
4) presupuesto_y_metrados
  Metrados por partida; presupuesto con GG/Utilidad/IGV; consistencia básica con metrados.
5) apu
  Análisis de precios unitarios completos (insumos, rendimientos, costos parciales/totales).
6) cronograma
  Cronograma (Gantt/CPM) y Curva S (si lo exige el TDR).
7) estudios_basicos
  Topografía (cuadro de coordenadas/planos/secciones), mecánica de suelos, canteras/agua, ambiental/GRD/SSOMA según TDR.
8) documentacion_legal
  Permisos/constancias (CIRA/ambiental/factibilidades), habilitaciones profesionales, índices, carátulas firmadas.

## PONDERACIONES (para puntaje_total)
- Memoria descriptiva 20%
- Estudios básicos 20%
- Presupuesto y metrados 20%
- APU 10%
- Planos 10%
- Especificaciones técnicas 10%
- Cronograma 5%
- Documentación legal 5%

Cada sección recibe **puntaje 0–100** según **cobertura** de los ítems exigidos por el TDR que estén presentes en las páginas analizadas.
Calcula **puntaje_total** como promedio ponderado anterior (redondea al entero más cercano).

## ESTADO GLOBAL (cumplimiento_general)
- "CUMPLE": puntaje_total >= 85 y **sin ítems obligatorios faltantes** críticos.
- "INCOMPLETO": 60–84 o si faltan ítems obligatorios **parciales**.
- "NO CUMPLE": < 60 o faltan **varios** ítems obligatorios.

## EVIDENCIAS
Para cada hallazgo positivo, agrega entradas cortas tipo:
- "TOMO I p.12: 'Memoria Descriptiva' (encabezado visible)"
Si no conoces el tomo/página exactos, usa el índice de análisis: "IMG#23".

## REGLAS ANTI-ALUCINACIÓN
- Usa únicamente los TOMOS listados en la sección TOMOS DISPONIBLES.
- Si un ítem no se ve, escribe en "faltantes" y **no lo supongas**.
- Si el texto es ilegible o la imagen muy borrosa, anótalo en "observaciones" como **OCR_DEFICIENTE**.
- No incluyas texto fuera del JSON final.

## SALIDA (SOLO JSON VÁLIDO)
{
  "cumplimiento_general": "CUMPLE|INCOMPLETO|NO CUMPLE",
  "puntaje_total": 0-100,
  "paginas_analizadas": ${imagesForAI.length},
  "items_obligatorios_faltantes": ["..."],

  "secciones": {
    "memoria_descriptiva": {
      "cumple": true|false,
      "puntaje": 0-100,
      "observaciones": "…",
      "faltantes": ["objetivos","marco normativo", "..."],
      "evidencias": ["TOMO I p.2: 'Memoria Descriptiva'"]
    },
    "especificaciones_tecnicas": {
      "cumple": true|false,
      "puntaje": 0-100,
      "observaciones": "…",
      "faltantes": ["especificaciones por partida"],
      "evidencias": []
    },
    "planos": {
      "cumple": true|false,
      "puntaje": 0-100,
      "observaciones": "…",
      "faltantes": ["listado de planos","carátulas firmadas"],
      "evidencias": []
    },
    "presupuesto_y_metrados": {
      "cumple": true|false,
      "puntaje": 0-100,
      "observaciones": "…",
      "faltantes": ["resumen presupuesto","metrado por partida","GG/Utilidad/IGV"],
      "evidencias": []
    },
    "apu": {
      "cumple": true|false,
      "puntaje": 0-100,
      "observaciones": "…",
      "faltantes": ["rendimientos","insumos"],
      "evidencias": []
    },
    "cronograma": {
      "cumple": true|false,
      "puntaje": 0-100,
      "observaciones": "…",
      "faltantes": ["Curva S","CPM"],
      "evidencias": []
    },
    "estudios_basicos": {
      "cumple": true|false,
      "puntaje": 0-100,
      "observaciones": "…",
      "faltantes": ["topografía","mecánica de suelos","ambiental/GRD/SSOMA"],
      "evidencias": []
    },
    "documentacion_legal": {
      "cumple": true|false,
      "puntaje": 0-100,
      "observaciones": "…",
      "faltantes": ["CIRA/FTA","factibilidades","habilitaciones"],
      "evidencias": []
    }
  },

  "recomendaciones": [
    "Enumerar normas citadas en Memoria y referenciarlas en planos",
    "Agregar cuadro de varillas en metrados y vincular a presupuesto",
    "Subir versión con OCR legible para APU y Presupuesto"
  ]
}
`;


    const messages = [
      { role: 'system', content: 'Eres un ingeniero revisor de expedientes técnicos. Responde solo JSON válido.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imagesForAI.map((b64) => ({
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${b64}`, detail: 'high' },
          })),
        ],
      },
    ];

    const completion = await openai.chat.completions.create({
      model: VISION_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 4000,
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let evaluacion;
    try {
      // 🔹 Solución A: rescatar solo el bloque JSON válido
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      evaluacion = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      evaluacion = {
        cumplimiento_general: 'ERROR',
        puntaje_total: 0,
        paginas_analizadas: imagesForAI.length,
        items_obligatorios_faltantes: [],
        secciones: {},
        error_detalle: raw.slice(0, 800),
      };
    }

    return res.json({
      success: true,
      message: 'Evaluación de contenido mínimo completada',
      evaluacion,
      storage: {
        base: path.join('public', 'uploads', 'derivados', 'contenido_minimo', proyecto_id),
        tomos: tomosStorage,
      },
    });
  } catch (e) {
    logger.error(`Error en evaluar-contenido-minimo: ${e.message}`, 'ContenidoMinimo');
    return res.status(500).json({ success: false, message: 'Error interno', error: e.message });
  }
});

module.exports = router;
