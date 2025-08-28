// routes/expedientes_tecnico.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const db = require('../db/knex');
const multer = require('multer');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === Subidas (mismo patrón que en expedientes.js) ===
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

// Acepta cualquier campo -> req.file
const acceptAnyFile = [
    upload.any(),
    (req, _res, next) => {
        if (!req.file && Array.isArray(req.files) && req.files.length > 0) {
            req.file = req.files[0];
        }
        next();
    }
];

// Helper: rulebook TDR si existe
function tryLoadTdrRulebook() {
    try {
        const p = process.env.RULEBOOK_TDR_PATH
            ? path.resolve(process.env.RULEBOOK_TDR_PATH)
            : path.resolve(__dirname, '..', 'rules', 'rulebook_tdr_v1.json');
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch { /* ignore */ }
    return null;
}

// === POST /api/expedientes/evaluar-expediente-tecnico ===
router.post('/evaluar-expediente-tecnico', acceptAnyFile, async (req, res) => {
    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ success: false, message: 'Falta OPENAI_API_KEY' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo' });
    }

    const filePath = path.join(uploadsDir, req.file.filename);
    logger.info(`Archivo recibido (TDR): ${req.file.filename}`, 'EvaluarTDR');

    try {
        // 1) Subir el PDF tal cual a OpenAI
        const uploaded = await openai.files.create({
            file: fs.createReadStream(filePath),
            purpose: 'assistants'
        });

        // 2) Prompt + rulebook TDR (si existe)
        const rulebookTdr = tryLoadTdrRulebook();
        const prompt =
            `Evalúa el EXPEDIENTE TÉCNICO conforme a los TÉRMINOS DE REFERENCIA (TDR).
            Si hay RULEBOOK_TDR_JSON, úsalo estrictamente.

            Devuelve un informe en texto con:
            1) Hallazgos por sección del TDR (Objeto, Alcance, Entregables, Metodología, Cronograma, Equipo, Perfiles/Experiencia, Supervisión/Calidad, Presupuesto, Criterios de Evaluación).
            2) Incumplimientos y omisiones (lista numerada).
            3) Riesgos que afecten tiempo/costo/calidad.
            4) Recomendaciones accionables indicando dónde corregir (página/tabla si es posible).`;

        const resp = await openai.responses.create({
            model: 'gpt-4o-mini',
            input: [
                { role: 'system', content: 'Eres un auditor de expedientes técnicos (TDR) para obras públicas.' },
                {
                    role: 'user', content: [
                        { type: 'input_text', text: prompt },
                        ...(rulebookTdr ? [{ type: 'input_text', text: `RULEBOOK_TDR_JSON:\n${JSON.stringify(rulebookTdr)}` }] : []),
                        { type: 'input_file', file_id: uploaded.id }
                    ]
                }
            ]
        });

        const analysis = resp.output_text || 'Sin análisis devuelto por el modelo.';

        // 3) Guardar en BD con tipo = expediente_tecnico
        const expedienteId = Date.now().toString();
        await db('expedientes').insert({
            id: expedienteId,
            nombre: req.file.originalname,
            ruta_archivo: req.file.filename,
            tipo: 'expediente_tecnico',
            fecha_creacion: new Date(),
            estado: 'evaluado',
            usuario_id: req.user?.id || 1
        });

        await db('analisis_expedientes').insert({
            expediente_id: expedienteId,
            contenido: analysis,
            fecha_analisis: new Date(),
            modelo_ia: 'gpt-4o-mini'
        });

        // 4) Respaldo en disco
        const resultsDir = path.join(__dirname, '..', 'public', 'resultados');
        fs.mkdirSync(resultsDir, { recursive: true });
        fs.writeFileSync(
            path.join(resultsDir, `${expedienteId}_tdr.json`),
            JSON.stringify({
                analysis, metadata: {
                    filename: req.file.originalname,
                    processedAt: new Date(),
                    model: 'gpt-4o-mini',
                    rulebook_tdr: !!rulebookTdr
                }
            }, null, 2)
        );

        // 5) Resumen rápido (# de observaciones numeradas)
        const observationCount =
            (analysis.match(/^\s*\d+\./gm) || []).length ||
            (analysis.match(/\d\./g) || []).length || 5;

        return res.status(200).json({
            success: true,
            expedienteId,
            file: { name: req.file.originalname, path: `/uploads/${req.file.filename}` },
            analysis,
            summary: { total_observations: observationCount }
        });

    } catch (error) {
        logger.error(`Error al procesar TDR: ${error.message}`, 'EvaluarTDR');
        return res.status(500).json({ success: false, message: 'Error al procesar el expediente técnico', error: error.message });
    }
});

module.exports = router;
