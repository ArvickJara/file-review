// routes/expedientes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const db = require('../db/knex');
const multer = require('multer');

// === Config subida de archivos (multer) ===
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '');
        const base = path.basename(file.originalname || 'archivo', ext).slice(0, 100);
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${base}-${unique}${ext || ''}`);
    }
});
const upload = multer({ storage });

// Acepta cualquier nombre de campo y lo mapea a req.file para mantener compatibilidad
const acceptAnyFile = [
    upload.any(),
    (req, _res, next) => {
        if (!req.file && Array.isArray(req.files) && req.files.length > 0) {
            req.file = req.files[0];
        }
        next();
    }
];

// === Cliente de OpenAI (Responses API) ===
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL_NAME = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// === Rulebook (OBLIGATORIO) ===
function loadRulebookCostosOrFail() {
    const p = process.env.RULEBOOK_PATH
        ? path.resolve(process.env.RULEBOOK_PATH)
        : path.resolve(__dirname, '..', 'rules', 'rulebook_costos_v2.json');

    if (!fs.existsSync(p)) {
        const msg = `Rulebook de costos/presupuestos no encontrado en: ${p}. ` +
            `Configura RULEBOOK_PATH o coloca el archivo en /rules.`;
        const err = new Error(msg);
        err.statusCode = 422;
        throw err;
    }
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    const version =
        json.version ||
        crypto.createHash('sha1').update(JSON.stringify(json)).digest('hex').slice(0, 8);

    return { json, version, path: p };
}

// === Utilidad: conteo simple de observaciones numeradas ===
function countNumberedObservations(text) {
    return (
        (text.match(/^\s*\d+\./gm) || []).length ||
        (text.match(/\d\./g) || []).length ||
        0
    );
}

// Subir y evaluar expediente de costos/presupuestos (USA SIEMPRE RULEBOOK)
router.post('/evaluar-costos-presupuestos', acceptAnyFile, async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ success: false, message: 'Falta OPENAI_API_KEY' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo' });
        }

        // 1) Cargar rulebook (OBLIGATORIO)
        let rule;
        try {
            rule = loadRulebookCostosOrFail(); // { json, version, path }
        } catch (e) {
            const code = e.statusCode || 500;
            return res.status(code).json({ success: false, message: e.message });
        }

        const filePath = path.join(uploadsDir, req.file.filename);
        logger.info(`Archivo recibido: ${req.file.filename}`, 'EvaluarCostos');

        // 2) Subir el archivo TAL CUAL a OpenAI Files y referenciar por file_id
        const uploaded = await openai.files.create({
            file: fs.createReadStream(filePath),
            purpose: 'assistants'
        });

        // 3) Prompt mínimo (el rulebook dicta el QUÉ; el prompt dicta el CÓMO)
        const prompt =
            `Audita este expediente de COSTOS Y PRESUPUESTOS usando ESTRICTAMENTE el RULEBOOK_JSON.
            Responde en texto con:
            1) Observaciones numeradas, cada una indicando (id de regla y título) que sustenta el hallazgo.
            2) Inconsistencias de cálculo (ACU, IGV, GG, Utilidad, fórmulas polinómicas).
            3) Riesgos y partidas sobredimensionadas/subdimensionadas (si aplica).
            4) Recomendaciones accionables indicando dónde corregir (página/tabla si es posible).`;

        // 4) Llamada al modelo (Responses API + file input)
        const resp = await openai.responses.create({
            model: MODEL_NAME,
            input: [
                { role: 'system', content: 'Eres un auditor de costos/presupuestos para obras públicas. Sé riguroso y referencia la regla aplicada.' },
                {
                    role: 'user',
                    content: [
                        { type: 'input_text', text: prompt },
                        { type: 'input_text', text: `RULEBOOK_JSON:\n${JSON.stringify(rule.json)}` },
                        { type: 'input_file', file_id: uploaded.id }
                    ]
                }
            ]
        });

        const analysis = resp.output_text || 'Sin análisis devuelto por el modelo.';
        const expedienteId = Date.now().toString();

        // 5) Guardar en BD
        await db('expedientes').insert({
            id: expedienteId,
            nombre: req.file.originalname,
            ruta_archivo: req.file.filename,
            tipo: 'costos_presupuestos',
            fecha_creacion: new Date(),
            estado: 'evaluado',
            usuario_id: req.user?.id || 1
        });

        await db('analisis_expedientes').insert({
            expediente_id: expedienteId,
            contenido: analysis,
            fecha_analisis: new Date(),
            modelo_ia: MODEL_NAME
            // Si añadiste columnas para JSON/score/riesgo, complétalas aquí.
        });

        // 6) Guardar respaldo del análisis en disco (incluye metadatos del rulebook)
        const resultsDir = path.join(__dirname, '..', 'public', 'resultados');
        fs.mkdirSync(resultsDir, { recursive: true });
        fs.writeFileSync(
            path.join(resultsDir, `${expedienteId}.json`),
            JSON.stringify(
                {
                    analysis,
                    metadata: {
                        filename: req.file.originalname,
                        processedAt: new Date(),
                        model: MODEL_NAME,
                        rulebook: { version: rule.version, path: rule.path }
                    }
                },
                null,
                2
            )
        );

        // 7) Resumen rápido
        const observationCount = countNumberedObservations(analysis);

        return res.status(200).json({
            success: true,
            expedienteId,
            file: { name: req.file.originalname, path: `/uploads/${req.file.filename}` },
            analysis,
            summary: { total_observations: observationCount },
            rulebook: { version: rule.version }
        });
    } catch (error) {
        logger.error(`Error al procesar archivo: ${error.message}`, 'EvaluarCostos');
        return res
            .status(500)
            .json({ success: false, message: 'Error al procesar el archivo', error: error.message });
    }
});

// Obtener un expediente por ID
router.get('/:id', async (req, res) => {
    try {
        const expediente = await db('expedientes').where('id', req.params.id).first();
        if (!expediente)
            return res.status(404).json({ success: false, message: 'Expediente no encontrado' });

        const analisis = await db('analisis_expedientes')
            .where('expediente_id', req.params.id)
            .first();

        return res
            .status(200)
            .json({ success: true, expediente, analisis: analisis ? analisis.contenido : null });
    } catch (error) {
        logger.error(`Error al obtener expediente: ${error.message}`, 'GetExpediente');
        return res
            .status(500)
            .json({ success: false, message: 'Error al obtener el expediente', error: error.message });
    }
});

// Listar expedientes
router.get('/', async (_req, res) => {
    try {
        const expedientes = await db('expedientes').select('*').orderBy('fecha_creacion', 'desc');
        return res.status(200).json({ success: true, expedientes });
    } catch (error) {
        logger.error(`Error al listar expedientes: ${error.message}`, 'ListExpedientes');
        return res
            .status(500)
            .json({ success: false, message: 'Error al listar expedientes', error: error.message });
    }
});

module.exports = router;
