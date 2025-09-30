const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const db = require('../db/knex');
const multer = require('multer');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// === Multer ===
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '');
        const base = path.basename(file.originalname || 'archivo', ext).slice(0, 100);
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${base.replace(/[^a-zA-Z0-9]/g, '_')}-${unique}${ext || ''}`);
    },
});

const uploadTdr = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Solo se permiten archivos PDF, DOC y DOCX para TDRs'));
    },
});

const uploadTomos = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Solo se permiten archivos PDF para los tomos del expediente'));
    },
});

// === OpenAI ===
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL_NAME = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// === OCR (solo tomos) ===
async function processPDFWithOCR(inputPath, outputPath) {
    try {
        const language = process.env.OCR_LANGUAGE || 'spa';
        const command = `ocrmypdf --language ${language} --deskew --clean --optimize 1 "${inputPath}" "${outputPath}"`;
        await execAsync(command);
    } catch (error) {
        throw new Error(`Fallo en procesamiento OCR: ${error.message}`);
    }
}
async function extractTextFromPDF(pdfPath) {
    try {
        const command = `pdftotext "${pdfPath}" -`;
        const { stdout } = await execAsync(command);
        return stdout;
    } catch (_e) {
        return '';
    }
}

// === Assistants utils (TDR) ===
let assistantIdCache = process.env.OPENAI_TDR_ASSISTANT_ID || null;

async function getTdrAssistantId() {
    if (assistantIdCache) return assistantIdCache;
    const assistant = await openai.beta.assistants.create({
        name: 'Extractor de TDR',
        model: process.env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini',
        tools: [{ type: 'file_search' }],
        instructions:
            'Eres un asistente experto en extraer datos de TDR/Expedientes. Responde únicamente en JSON con este esquema: { "nombre_proyecto": string|null, "codigo_proyecto": string|null, "entidad_ejecutora": string|null, "monto_referencial": number|null, "descripcion": string|null }. No incluyas texto adicional.',
    });
    assistantIdCache = assistant.id;
    logger.info(`Assistant TDR creado: ${assistantIdCache}`, 'TDRAssistant');
    return assistantIdCache;
}

// === Compat helpers (SDK viejo/nuevo) ===
async function createRunCompat(assistantId, threadId) {
    try {
        return await openai.beta.threads.runs.create({ assistant_id: assistantId, thread_id: threadId });
    } catch (_e) {
        return await openai.beta.threads.runs.create(threadId, { assistant_id: assistantId });
    }
}
async function listRunsCompat(threadId, options = {}) {
    try {
        return await openai.beta.threads.runs.list({ thread_id: threadId, ...options });
    } catch (_e) {
        return await openai.beta.threads.runs.list(threadId, options);
    }
}
async function listMessagesCompat(threadId, options = {}) {
    try {
        return await openai.beta.threads.messages.list({ thread_id: threadId, ...options });
    } catch (_e) {
        return await openai.beta.threads.messages.list(threadId, options);
    }
}
async function createMessageCompat(threadId, payload) {
    try {
        return await openai.beta.threads.messages.create({ thread_id: threadId, ...payload });
    } catch (_e) {
        return await openai.beta.threads.messages.create(threadId, payload);
    }
}

// Espera del run (polling vía list, evita retrieve con path de 2 segmentos)
async function waitForRun(run, fallbackThreadId, timeoutMs = 300000) {
    const threadId = run?.thread_id || fallbackThreadId;
    const runId = run?.id || run?.run_id;
    if (!threadId || !runId) {
        throw new Error(`IDs inválidos para polling. threadId=${threadId} runId=${runId}`);
    }

    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const page = await listRunsCompat(threadId, { order: 'desc', limit: 20 });
        const current = page?.data?.find(r => r.id === runId || r.run_id === runId);
        if (current) {
            if (current.status === 'completed') return current;
            if (['failed', 'cancelled', 'expired'].includes(current.status)) {
                throw new Error(`Run terminó con estado: ${current.status}`);
            }
        }
        await new Promise(r => setTimeout(r, 1500));
    }
    throw new Error('Timeout esperando respuesta del Assistant');
}

async function extractProjectDataFromFile(filePath, originalName) {
    // 1) Subir archivo
    const uploaded = await openai.files.create({
        file: fs.createReadStream(filePath),
        purpose: 'assistants',
    });

    // 2) Assistant y thread
    const assistantId = await getTdrAssistantId();
    const thread = await openai.beta.threads.create();
    if (!thread?.id) throw new Error('No se obtuvo thread.id');

    // 3) Mensaje con adjunto
    await createMessageCompat(thread.id, {
        role: 'user',
        content:
            'Analiza el documento adjunto (TDR) y extrae JSON con el siguiente esquema exacto: ' +
            '{ "nombre_proyecto": string|null, "codigo_proyecto": string|null, "entidad_ejecutora": string|null, "monto_referencial": number|null, "descripcion": string|null }. ' +
            'Devuelve solo JSON válido.',
        attachments: [{ file_id: uploaded.id, tools: [{ type: 'file_search' }] }],
    });

    // 4) Ejecutar run (compat)
    const run = await createRunCompat(assistantId, thread.id);
    logger.info(`Assistant=${assistantId} thread=${thread.id} run=${run?.id}`, 'SubirTDR');

    // 5) Esperar (con respaldo de thread.id)
    await waitForRun(run, thread.id);

    // 6) Leer mensajes (compat)
    const messages = await listMessagesCompat(thread.id, { order: 'desc', limit: 5 });
    const assistantMessage = messages.data.find(m => m.role === 'assistant');
    if (!assistantMessage) throw new Error('No se obtuvo respuesta del Assistant');

    const textParts = assistantMessage.content
        .filter(c => c.type === 'text' && c.text?.value)
        .map(c => c.text.value)
        .join('\n');
    if (!textParts) throw new Error('Respuesta vacía del Assistant');

    let data;
    try { data = JSON.parse(textParts); }
    catch { data = JSON.parse(textParts.replace(/```json|```/g, '').trim()); }

    const monto = data?.monto_referencial;
    const montoNum = typeof monto === 'number' ? monto : parseFloat(String(monto || '').replace(/[^0-9.]/g, ''));
    return {
        nombre_proyecto: data?.nombre_proyecto ?? null,
        codigo_proyecto: data?.codigo_proyecto ?? null,
        entidad_ejecutora: data?.entidad_ejecutora ?? null,
        monto_referencial: isNaN(montoNum) ? null : montoNum,
        descripcion: data?.descripcion ?? null,
        _raw: data,
    };
}

// === RUTA: Subir TDR (Crea o actualiza proyecto) ===
router.post('/subir-tdr', uploadTdr.single('tdr'), async (req, res) => {
    try {
        let { proyecto_id } = req.body;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No se ha subido el archivo TDR' });
        }

        const originalPath = path.join(uploadsDir, req.file.filename);

        // IA: extraer datos del TDR
        let extracted = null;
        try {
            extracted = await extractProjectDataFromFile(originalPath, req.file.originalname);
            logger.info(`Datos extraídos por IA: ${JSON.stringify(extracted?._raw || extracted)}`, 'SubirTDR');
        } catch (iaErr) {
            logger.warn(`Fallo extracción por IA: ${iaErr.message}`, 'SubirTDR');
        }

        // Crear o actualizar proyecto
        if (!proyecto_id) {
            proyecto_id = Date.now().toString();
            await db('proyectos').insert({
                id: proyecto_id,
                nombre: extracted?.nombre_proyecto || `Proyecto - ${req.file.originalname.slice(0, 50)}`,
                tipo: 'expediente_tecnico',
                estado: 'activo',
                codigo_proyecto: extracted?.codigo_proyecto || null,
                entidad_ejecutora: extracted?.entidad_ejecutora || null,
                monto_referencial: extracted?.monto_referencial ?? null,
                descripcion: extracted?.descripcion || null,
                datos_extraidos: !!extracted,
            });
            logger.info(`Nuevo proyecto creado con ID: ${proyecto_id}`, 'SubirTDR');
        } else if (extracted) {
            await db('proyectos').where('id', proyecto_id).update({
                nombre: extracted.nombre_proyecto || undefined,
                codigo_proyecto: extracted.codigo_proyecto || undefined,
                entidad_ejecutora: extracted.entidad_ejecutora || undefined,
                monto_referencial: extracted.monto_referencial ?? undefined,
                descripcion: extracted.descripcion || undefined,
                datos_extraidos: true,
            });
        }

        // Registrar el TDR como documento (orden 0)
        const tdrDocumentId = Date.now().toString();
        await db('documentos').insert({
            id: tdrDocumentId,
            proyecto_id,
            nombre_archivo: req.file.originalname,
            ruta_archivo: req.file.filename,
            estado: 'pendiente',
            orden: 0,
        });

        return res.status(200).json({
            success: true,
            proyectoId: proyecto_id,
            tdrId: tdrDocumentId,
            message: 'TDR enviado a IA y proyecto creado/actualizado exitosamente.',
        });
    } catch (error) {
        logger.error(`Error al procesar TDR: ${error.message}`, 'SubirTDR');
        return res.status(500).json({ success: false, message: 'Error interno al procesar el TDR', error: error.message });
    }
});

// === RUTA: Subir y evaluar tomos (OCR + Chat) ===
router.post('/evaluar-expediente', uploadTomos.array('tomos', 10), async (req, res) => {
    try {
        const { proyecto_id } = req.body;
        if (!proyecto_id) return res.status(400).json({ success: false, message: 'Se requiere el ID del Proyecto' });
        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'No se han subido tomos del expediente' });

        await db('proyectos').where('id', proyecto_id).update({ estado: 'en_progreso' });
        const resultados = [];

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const tomoNumero = i + 1;
            const documentoId = `${Date.now()}-${i}`;

            await db('documentos').insert({
                id: documentoId,
                proyecto_id,
                nombre_archivo: file.originalname,
                ruta_archivo: file.filename,
                orden: tomoNumero,
                estado: 'procesando',
            });

            try {
                const originalPath = path.join(uploadsDir, file.filename);
                const ocrPath = path.join(uploadsDir, `ocr_${file.filename}`);
                await processPDFWithOCR(originalPath, ocrPath);
                const extractedText = await extractTextFromPDF(ocrPath);
                if (fs.existsSync(ocrPath)) fs.unlinkSync(ocrPath);

                if (!extractedText || extractedText.trim().length < 100)
                    throw new Error('No se pudo extraer suficiente texto del documento');

                const prompt = `Evalúa el siguiente tomo de un expediente técnico y resume sus puntos clave.`;
                const response = await openai.chat.completions.create({
                    model: MODEL_NAME,
                    messages: [{ role: 'user', content: `${prompt}\n\nTOMO:\n${extractedText.substring(0, 8000)}` }],
                });
                const analysis = response.choices[0].message.content;

                await db('analisis').insert({
                    documento_id: documentoId,
                    contenido: analysis,
                    modelo_ia: MODEL_NAME,
                });
                await db('documentos').where('id', documentoId).update({ estado: 'analizado' });
                resultados.push({ tomo: tomoNumero, archivo: file.originalname, status: 'exitoso' });
            } catch (tomoError) {
                await db('documentos').where('id', documentoId).update({ estado: 'error' });
                resultados.push({ tomo: tomoNumero, archivo: file.originalname, error: tomoError.message });
            }
        }

        await db('proyectos').where('id', proyecto_id).update({ estado: 'evaluado' });
        return res.status(200).json({ success: true, proyectoId: proyecto_id, resultados });
    } catch (error) {
        logger.error(`Error al evaluar expediente: ${error.message}`, 'EvaluarExpediente');
        return res.status(500).json({ success: false, message: 'Error al evaluar el expediente', error: error.message });
    }
});

// === RUTAS GET ===
router.get('/tdrs/:proyecto_id', async (req, res) => {
    try {
        const { proyecto_id } = req.params;
        const tdrs = await db('documentos')
            .select('id', 'nombre_archivo as nombre', 'fecha_subida as fecha_creacion', 'estado', 'orden', 'proyecto_id')
            .where({ proyecto_id })
            .andWhere('orden', 0);
        return res.status(200).json({ success: true, tdrs });
    } catch (error) {
        logger.error(`Error al listar TDRs: ${error.message}`, 'ListarTDRs');
        return res.status(500).json({ success: false, message: 'Error al listar TDRs', error: error.message });
    }
});

router.get('/documentos/:proyecto_id', async (req, res) => {
    try {
        const { proyecto_id } = req.params;
        const documentos = await db('documentos')
            .select('id', 'nombre_archivo as nombre', 'fecha_subida as fecha_creacion', 'estado', 'orden', 'proyecto_id')
            .where('proyecto_id', proyecto_id)
            .orderBy('orden', 'asc');
        return res.status(200).json({ success: true, documentos });
    } catch (error) {
        logger.error(`Error al listar documentos: ${error.message}`, 'ListarDocumentos');
        return res.status(500).json({ success: false, message: 'Error al listar documentos', error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const proyecto = await db('proyectos').where('id', req.params.id).first();
        if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

        const documentos = await db('documentos')
            .leftJoin('analisis', 'documentos.id', 'analisis.documento_id')
            .select(
                'documentos.id',
                'documentos.nombre_archivo',
                'documentos.estado',
                'documentos.orden',
                'analisis.contenido as analisis_contenido',
                'analisis.fecha_analisis'
            )
            .where('documentos.proyecto_id', req.params.id)
            .orderBy('documentos.orden', 'asc');

        return res.status(200).json({ success: true, proyecto, documentos });
    } catch (error) {
        logger.error(`Error al obtener expediente: ${error.message}`, 'GetExpediente');
        return res.status(500).json({ success: false, message: 'Error al obtener el expediente', error: error.message });
    }
});

module.exports = router;