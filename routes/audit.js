// routes/audit.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const multer = require('multer');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Carga de rulebook sin depender de utils/rulebook (fallback)
function loadRulebook() {
    try {
        const p = process.env.RULEBOOK_PATH
            ? path.resolve(process.env.RULEBOOK_PATH)
            : path.resolve(__dirname, '..', 'rules', 'rulebook_costos_v2.json');
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
        return null;
    }
}

// Exponer rulebook (debug)
router.get('/rulebook', (_req, res) => {
    const rb = loadRulebook();
    if (!rb) return res.status(404).json({ error: 'Rulebook no encontrado' });
    return res.json(rb);
});

// Subida simple para auditoría JSON (si quieres structured outputs)
const upload = multer({ dest: path.resolve('.uploads') });

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Falta archivo' });
        const rulebook = loadRulebook();

        // Subir archivo a OpenAI (tal cual)
        const uploaded = await openai.files.create({
            file: fs.createReadStream(req.file.path),
            purpose: 'assistants'
        });

        // Schema mínimo (puedes moverlo a utils/schemas.js)
        const auditSchema = {
            type: 'object',
            additionalProperties: false,
            properties: {
                archivo: { type: 'string' },
                score: { type: 'number' },
                riesgo: { enum: ['bajo', 'medio', 'alto'] },
                resumen: { type: 'string' },
                reglas: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            id: { type: 'string' },
                            titulo: { type: 'string' },
                            cumple: { type: 'boolean' },
                            medicion: { type: 'object', additionalProperties: true },
                            evidencia: {
                                type: 'array',
                                items: { type: 'object', properties: { pagina: { type: 'number' }, tabla: { type: 'string' } }, additionalProperties: false }
                            },
                            observaciones: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['id', 'titulo', 'cumple', 'observaciones']
                    }
                },
                acciones_recomendadas: { type: 'array', items: { type: 'string' } }
            },
            required: ['archivo', 'score', 'riesgo', 'resumen', 'reglas']
        };

        const resp = await openai.responses.create({
            model: 'gpt-4o-mini',
            input: [
                { role: 'system', content: 'Eres un auditor técnico de costos públicos. Devuelve SOLO JSON.' },
                {
                    role: 'user', content: [
                        { type: 'input_text', text: `RULEBOOK_JSON:\n${JSON.stringify(rulebook || {})}` },
                        { type: 'input_text', text: 'Audita el expediente y devuelve JSON.' },
                        { type: 'input_file', file_id: uploaded.id }
                    ]
                }
            ],
            response_format: { type: 'json_schema', json_schema: { name: 'AuditoriaExpediente', schema: auditSchema, strict: true } }
        });

        const out = resp.output_text ? JSON.parse(resp.output_text) : { error: 'Sin salida' };
        return res.json(out);

    } catch (e) {
        return res.status(500).json({ error: e?.message || 'Error en auditoría' });
    }
});

module.exports = router;
