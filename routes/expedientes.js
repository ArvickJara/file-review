// routes/expedientes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai'); // <- CommonJS correcto
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

// Acepta cualquier nombre de campo y lo mapea a req.file para tu código actual
const acceptAnyFile = [
    upload.any(),
    (req, _res, next) => {
        if (!req.file && Array.isArray(req.files) && req.files.length > 0) {
            req.file = req.files[0];
        }
        next();
    }
];

// === Cliente de OpenAI ===
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Ruta para subir y evaluar expedientes de costos y presupuestos
router.post('/evaluar-costos-presupuestos', acceptAnyFile, async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Falta OPENAI_API_KEY en variables de entorno'
            });
        }

        // Si no hay archivo subido
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se ha subido ningún archivo'
            });
        }

        logger.info(`Archivo recibido: ${req.file.filename}`, 'EvaluarCostos');

        // Ruta completa del archivo
        const filePath = path.join(uploadsDir, req.file.filename);

        // Convertir archivo a base64 para enviarlo al modelo
        const fileBuffer = fs.readFileSync(filePath);
        const fileBase64 = fileBuffer.toString('base64');
        const mimeType = req.file.mimetype || 'application/octet-stream';

        // Mensajes para el modelo (Vision)
        const messages = [
            {
                role: 'system',
                content:
                    'Eres un experto en evaluación de presupuestos y costos para proyectos de infraestructura. El usuario te enviará un documento de costos y presupuestos para analizar.'
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Este es un documento de costos y presupuestos. Por favor analízalo y evalúa los siguientes aspectos:
1) ¿Los costos unitarios están dentro de rangos razonables para el mercado actual?
2) ¿Existe alguna inconsistencia o error en los cálculos?
3) ¿El presupuesto total es coherente con el tipo de proyecto?
4) ¿Hay partidas sobredimensionadas o subdimensionadas?
5) Recomendaciones para mejorar o corregir el presupuesto.

Responde en formato claro con viñetas y numeración, indicando ejemplos concretos cuando sea posible.`
                    },
                    {
                        type: 'image_url',
                        image_url: { url: `data:${mimeType};base64,${fileBase64}` }
                    }
                ]
            }
        ];

        // Llamada al modelo (usa un modelo vigente con visión)
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            max_tokens: 4000
        });

        const analysis = completion.choices?.[0]?.message?.content || 'Sin análisis devuelto por el modelo.';

        // Crear un ID único para el expediente
        const expedienteId = Date.now().toString();

        // Guardar en la base de datos
        await db('expedientes').insert({
            id: expedienteId,
            nombre: req.file.originalname,
            ruta_archivo: req.file.filename,
            tipo: 'costos_presupuestos',
            fecha_creacion: new Date(),
            estado: 'evaluado',
            usuario_id: req.user?.id || 1
        });

        // Guardar el análisis
        await db('analisis_expedientes').insert({
            expediente_id: expedienteId,
            contenido: analysis,
            fecha_analisis: new Date(),
            modelo_ia: 'gpt-4o-mini'
        });

        // Guardar también como archivo para respaldo
        const resultsDir = path.join(__dirname, '..', 'public', 'resultados');
        fs.mkdirSync(resultsDir, { recursive: true });
        const resultPath = path.join(resultsDir, `${expedienteId}.json`);
        fs.writeFileSync(
            resultPath,
            JSON.stringify(
                {
                    analysis,
                    metadata: {
                        filename: req.file.originalname,
                        processedAt: new Date(),
                        model: 'gpt-4o-mini'
                    }
                },
                null,
                2
            )
        );

        // Aproximar número de observaciones (cuenta líneas numeradas 1. 2. 3. ...)
        const observationCount =
            (analysis.match(/^\s*\d+\./gm) || []).length ||
            (analysis.match(/\d\./g) || []).length ||
            5;

        // Responder al cliente
        res.status(200).json({
            success: true,
            expedienteId,
            file: {
                name: req.file.originalname,
                path: `/uploads/${req.file.filename}`
            },
            analysis,
            summary: {
                total_observations: observationCount
            }
        });
    } catch (error) {
        logger.error(`Error al procesar archivo: ${error.message}`, 'EvaluarCostos');
        res.status(500).json({
            success: false,
            message: 'Error al procesar el archivo',
            error: error.message
        });
    }
});

// Ruta para obtener un expediente por ID
router.get('/:id', async (req, res) => {
    try {
        const expediente = await db('expedientes').where('id', req.params.id).first();

        if (!expediente) {
            return res.status(404).json({ success: false, message: 'Expediente no encontrado' });
        }

        const analisis = await db('analisis_expedientes').where('expediente_id', req.params.id).first();

        res.status(200).json({
            success: true,
            expediente,
            analisis: analisis ? analisis.contenido : null
        });
    } catch (error) {
        logger.error(`Error al obtener expediente: ${error.message}`, 'GetExpediente');
        res.status(500).json({
            success: false,
            message: 'Error al obtener el expediente',
            error: error.message
        });
    }
});

// Listar todos los expedientes
router.get('/', async (_req, res) => {
    try {
        const expedientes = await db('expedientes').select('*').orderBy('fecha_creacion', 'desc');
        res.status(200).json({ success: true, expedientes });
    } catch (error) {
        logger.error(`Error al listar expedientes: ${error.message}`, 'ListExpedientes');
        res.status(500).json({
            success: false,
            message: 'Error al listar expedientes',
            error: error.message
        });
    }
});

module.exports = router;
