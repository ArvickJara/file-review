// routes/expedientes-tecnicos.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const db = require('../db/knex');
const multer = require('multer');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

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

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        // Solo permitir PDFs para expedientes técnicos
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF para expedientes técnicos'));
        }
    }
});

// === Cliente de OpenAI ===
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL_NAME = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// === Funciones OCR ===
async function processPDFWithOCR(inputPath, outputPath) {
    try {
        const language = process.env.OCR_LANGUAGE || 'spa';
        const command = `ocrmypdf --language ${language} --deskew --clean --optimize 1 "${inputPath}" "${outputPath}"`;

        logger.info(`Ejecutando OCR: ${command}`, 'OCR');
        const { stdout, stderr } = await execAsync(command);

        if (stderr) {
            logger.warn(`OCR warnings: ${stderr}`, 'OCR');
        }

        logger.info(`OCR completado exitosamente para: ${path.basename(inputPath)}`, 'OCR');
        return true;
    } catch (error) {
        logger.error(`Error en OCR: ${error.message}`, 'OCR');
        throw new Error(`Fallo en procesamiento OCR: ${error.message}`);
    }
}

async function extractTextFromPDF(pdfPath) {
    try {
        const command = `pdftotext "${pdfPath}" -`;
        const { stdout } = await execAsync(command);
        return stdout;
    } catch (error) {
        logger.error(`Error extrayendo texto: ${error.message}`, 'ExtractText');
        throw new Error(`Fallo extrayendo texto: ${error.message}`);
    }
}

// === RUTA: Subir TDR (Términos de Referencia) ===
router.post('/subir-tdr', upload.single('tdr'), async (req, res) => {
    try {

        const { proyecto_id } = req.body;

        if (!req.file || !proyecto_id) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere archivo TDR y ID del proyecto'
            });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No se ha subido el archivo TDR' });
        }

        const originalPath = path.join(uploadsDir, req.file.filename);
        const ocrPath = path.join(uploadsDir, `ocr_${req.file.filename}`);

        logger.info(`Procesando TDR: ${req.file.filename}`, 'SubirTDR');

        // Procesar con OCR
        try {
            await processPDFWithOCR(originalPath, ocrPath);
        } catch (ocrError) {
            logger.warn(`OCR falló para TDR, usando archivo original: ${ocrError.message}`, 'SubirTDR');
            fs.copyFileSync(originalPath, ocrPath);
        }

        // Extraer texto
        const extractedText = await extractTextFromPDF(ocrPath);

        if (!extractedText || extractedText.trim().length < 100) {
            return res.status(400).json({
                success: false,
                message: 'No se pudo extraer suficiente texto del TDR'
            });
        }

        const tdrId = Date.now().toString();

        // Guardar TDR
        await db('tdr_documentos').insert({
            id: tdrId,
            proyecto_id,
            nombre: req.file.originalname,
            ruta_archivo: req.file.filename,
            contenido_texto: extractedText,
            fecha_creacion: new Date(),
            estado: 'activo'
        });

        // Limpiar archivo temporal
        try {
            if (fs.existsSync(ocrPath) && ocrPath !== originalPath) {
                fs.unlinkSync(ocrPath);
            }
        } catch (e) {
            logger.warn(`No se pudo eliminar archivo temporal OCR: ${e.message}`, 'Cleanup');
        }

        return res.status(200).json({
            success: true,
            tdrId,
            file: { name: req.file.originalname, path: `/uploads/${req.file.filename}` },
            extractedTextLength: extractedText.length,
            message: 'TDR subido y procesado exitosamente'
        });

    } catch (error) {
        logger.error(`Error al procesar TDR: ${error.message}`, 'SubirTDR');
        return res.status(500).json({
            success: false,
            message: 'Error al procesar el TDR',
            error: error.message
        });
    }
});

// === RUTA: Subir múltiples tomos del expediente técnico ===
router.post('/evaluar-expediente', upload.array('tomos', 10), async (req, res) => {
    try {
        const { tdrId } = req.body;

        if (!tdrId) {
            return res.status(400).json({ success: false, message: 'Se requiere el ID del TDR' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No se han subido tomos del expediente' });
        }

        // Obtener el TDR de referencia
        const tdr = await db('tdr_documentos').where('id', tdrId).first();
        if (!tdr) {
            return res.status(404).json({ success: false, message: 'TDR no encontrado' });
        }

        const expedienteId = Date.now().toString();
        const resultados = [];

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const tomoNumero = i + 1;

            logger.info(`Procesando tomo ${tomoNumero}: ${file.filename}`, 'EvaluarExpediente');

            try {
                const originalPath = path.join(uploadsDir, file.filename);
                const ocrPath = path.join(uploadsDir, `ocr_${file.filename}`);

                // Procesar con OCR
                try {
                    await processPDFWithOCR(originalPath, ocrPath);
                } catch (ocrError) {
                    logger.warn(`OCR falló para tomo ${tomoNumero}, usando archivo original`, 'EvaluarExpediente');
                    fs.copyFileSync(originalPath, ocrPath);
                }

                // Extraer texto
                const extractedText = await extractTextFromPDF(ocrPath);

                if (!extractedText || extractedText.trim().length < 100) {
                    resultados.push({
                        tomo: tomoNumero,
                        archivo: file.originalname,
                        error: 'No se pudo extraer suficiente texto del documento'
                    });
                    continue;
                }

                // Construir prompt para evaluación contra TDR
                const prompt = `
Evalúa este TOMO ${tomoNumero} del expediente técnico contra los TÉRMINOS DE REFERENCIA (TDR) proporcionados.

Analiza específicamente:
1) CUMPLIMIENTO DE ESPECIFICACIONES TÉCNICAS del TDR
2) DOCUMENTACIÓN REQUERIDA según el TDR
3) ASPECTOS FALTANTES o INCONSISTENCIAS con el TDR
4) CALIDAD Y COMPLETITUD de la información presentada

Para cada observación indica:
- Sección/capítulo del TDR que aplica
- Descripción del hallazgo
- Nivel de conformidad (CONFORME/NO CONFORME/OBSERVACIÓN)
- Recomendación específica

CONTENIDO DEL TOMO ${tomoNumero}:
${extractedText.substring(0, 6000)} ${extractedText.length > 6000 ? '...(texto truncado)' : ''}
                `;

                // Enviar a OpenAI
                const response = await openai.chat.completions.create({
                    model: MODEL_NAME,
                    messages: [
                        {
                            role: "system",
                            content: "Eres un auditor especializado en expedientes técnicos de obras públicas. Evalúa cada tomo contra los TDR de referencia."
                        },
                        {
                            role: "user",
                            content: `${prompt}\n\nTÉRMINOS DE REFERENCIA (TDR):\n${tdr.contenido_texto.substring(0, 4000)}`
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 3000
                });

                const analysis = response.choices[0].message.content;

                // Guardar análisis del tomo
                const tomoId = `${expedienteId}_tomo_${tomoNumero}`;
                await db('analisis_tomos').insert({
                    id: tomoId,
                    expediente_id: expedienteId,
                    tdr_id: tdrId,
                    tomo_numero: tomoNumero,
                    nombre_archivo: file.originalname,
                    ruta_archivo: file.filename,
                    contenido_analisis: analysis,
                    fecha_analisis: new Date(),
                    modelo_ia: MODEL_NAME
                });

                resultados.push({
                    tomo: tomoNumero,
                    archivo: file.originalname,
                    analisis: analysis,
                    extractedTextLength: extractedText.length
                });

                // Limpiar archivo temporal
                try {
                    if (fs.existsSync(ocrPath) && ocrPath !== originalPath) {
                        fs.unlinkSync(ocrPath);
                    }
                } catch (e) {
                    logger.warn(`No se pudo eliminar archivo temporal OCR para tomo ${tomoNumero}`, 'Cleanup');
                }

            } catch (tomoError) {
                logger.error(`Error procesando tomo ${tomoNumero}: ${tomoError.message}`, 'EvaluarExpediente');
                resultados.push({
                    tomo: tomoNumero,
                    archivo: file.originalname,
                    error: tomoError.message
                });
            }
        }

        // Guardar expediente principal
        await db('expedientes_tecnicos').insert({
            id: expedienteId,
            tdr_id: tdrId,
            total_tomos: req.files.length,
            fecha_creacion: new Date(),
            estado: 'evaluado'
        });

        // Generar resumen consolidado
        const tomosExitosos = resultados.filter(r => !r.error);
        const tomosConError = resultados.filter(r => r.error);

        return res.status(200).json({
            success: true,
            expedienteId,
            tdr: { id: tdrId, nombre: tdr.nombre },
            resumen: {
                total_tomos: req.files.length,
                tomos_procesados_exitosamente: tomosExitosos.length,
                tomos_con_errores: tomosConError.length
            },
            resultados,
            message: 'Expediente técnico evaluado exitosamente'
        });

    } catch (error) {
        logger.error(`Error al evaluar expediente técnico: ${error.message}`, 'EvaluarExpediente');
        return res.status(500).json({
            success: false,
            message: 'Error al evaluar el expediente técnico',
            error: error.message
        });
    }
});

// === RUTA: Listar TDRs disponibles ===
router.get('/tdrs', async (req, res) => {
    try {
        const tdrs = await db('tdr_documentos')
            .select('id', 'nombre', 'fecha_creacion', 'estado')
            .where('estado', 'activo')
            .orderBy('fecha_creacion', 'desc');

        return res.status(200).json({ success: true, tdrs });
    } catch (error) {
        logger.error(`Error al listar TDRs: ${error.message}`, 'ListarTDRs');
        return res.status(500).json({
            success: false,
            message: 'Error al listar TDRs',
            error: error.message
        });
    }
});

// === RUTA: Obtener expediente técnico por ID ===
router.get('/:id', async (req, res) => {
    try {
        const expediente = await db('expedientes_tecnicos')
            .join('tdr_documentos', 'expedientes_tecnicos.tdr_id', 'tdr_documentos.id')
            .select(
                'expedientes_tecnicos.*',
                'tdr_documentos.nombre as tdr_nombre'
            )
            .where('expedientes_tecnicos.id', req.params.id)
            .first();

        if (!expediente) {
            return res.status(404).json({ success: false, message: 'Expediente técnico no encontrado' });
        }

        const analisisTomos = await db('analisis_tomos')
            .where('expediente_id', req.params.id)
            .orderBy('tomo_numero');

        return res.status(200).json({
            success: true,
            expediente,
            analisisTomos
        });
    } catch (error) {
        logger.error(`Error al obtener expediente técnico: ${error.message}`, 'GetExpedienteTecnico');
        return res.status(500).json({
            success: false,
            message: 'Error al obtener el expediente técnico',
            error: error.message
        });
    }
});

module.exports = router;