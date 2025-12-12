const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const db = require('../db/knex');
const logger = require('../utils/logger');
const openaiService = require('../services/openai-service');

// Configuración de multer para archivos TDR
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../public/uploads');
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${originalName}-${timestamp}-${Math.floor(Math.random() * 1000000000)}.${file.originalname.split('.').pop()}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB límite
    },
    fileFilter: function (req, file, cb) {
        // Aceptar archivos Word y PDF
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/msword', // .doc
            'application/pdf'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Word (.doc, .docx) y PDF'));
        }
    }
});

/**
 * POST /api/tdr/upload-and-analyze
 * Sube un archivo TDR y lo analiza con OpenAI
 */
router.post('/upload-and-analyze', upload.single('tdr'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionó archivo TDR'
            });
        }

        const { proyecto_id, crear_proyecto } = req.body;
        const crearProyecto = String(crear_proyecto) === 'true' || crear_proyecto === true;

        // Si no hay proyecto_id y no se va a crear uno nuevo, error
        if (!proyecto_id && !crear_proyecto) {
            return res.status(400).json({
                success: false,
                message: 'Debe proporcionar proyecto_id o indicar crear_proyecto=true'
            });
        }

        const filePath = req.file.path;
        const fileName = req.file.originalname;

        logger.info(`Iniciando análisis de TDR: ${fileName}`, 'TDR-Upload');

        // Analizar archivo con OpenAI
        let analisisResult;
        try {
            analisisResult = await openaiService.analizarTDR(filePath, fileName);
        } catch (openaiError) {
            logger.error(`Error en análisis OpenAI: ${openaiError.message}`, 'TDR-Upload');

            // Eliminar archivo subido si falla el análisis
            try {
                await fs.unlink(filePath);
            } catch (unlinkError) {
                logger.error(`Error eliminando archivo: ${unlinkError.message}`, 'TDR-Upload');
            }

            return res.status(500).json({
                success: false,
                message: 'Error analizando TDR con OpenAI',
                error: openaiError.message
            });
        }

        let proyectoId = proyecto_id;
        let proyectoCreado = false;
        let entregablesInsertados = 0;

        // Depuración: vista previa cruda
        if (analisisResult.raw) {
            logger.info(`Preview OpenAI raw (500 chars): ${analisisResult.raw.slice(0, 500)}`, 'TDR-Upload');
        }

        // Nueva estructura devuelta por OpenAI (con fallbacks de nombres)
        const campos = analisisResult.campos || {};
        const proyectoExtraido = campos.proyecto || {};
        const entregablesRaw = campos.entregables || campos.tdr_entregable || campos.productos || [];
        const entregablesExtraidos = Array.isArray(entregablesRaw) ? entregablesRaw.map((e, i) => ({
            nombre_entregable: e?.nombre_entregable ?? e?.nombre ?? `Entregable ${i + 1}`,
            porcentaje_pago: e?.porcentaje_pago ?? null,
            secciones_estudio: Array.isArray(e?.secciones_estudio ?? e?.tdr_seccion_estudio ?? e?.secciones)
                ? (e.secciones_estudio || e.tdr_seccion_estudio || e.secciones).map((s, j) => ({
                    nombre: s?.nombre ?? `Sección ${j + 1}`,
                    tipos_documento: Array.isArray(s?.tipos_documento ?? s?.tdr_tipo_documento ?? s?.tipos)
                        ? (s.tipos_documento || s.tdr_tipo_documento || s.tipos).map((t, k) => ({
                            nombre_tipo_documento: t?.nombre_tipo_documento ?? t?.nombre ?? `Tipo ${k + 1}`,
                            contenido_minimo: Array.isArray(t?.contenido_minimo ?? t?.tdr_contenido_minimo ?? t?.requisitos)
                                ? (t.contenido_minimo || t.tdr_contenido_minimo || t.requisitos).map((c, m) => ({
                                    nombre_requisito: c?.nombre_requisito ?? c?.nombre ?? `Requisito ${m + 1}`,
                                    descripcion_completa: c?.descripcion_completa ?? c?.descripcion ?? ''
                                }))
                                : []
                        }))
                        : []
                }))
                : []
        })) : [];

        logger.info(`crear_proyecto: ${crear_proyecto}, tiene campos: ${!!campos}`, 'TDR-Upload');
        logger.info(`Proyecto extraído: ${JSON.stringify(proyectoExtraido)}`, 'TDR-Upload');
        logger.info(`Entregables extraídos: ${entregablesExtraidos.length}`, 'TDR-Upload');
        try {
            const rootKeys = Object.keys(campos || {});
            logger.info(`Claves raíz devueltas por OpenAI: ${rootKeys.join(', ')}`, 'TDR-Upload');
        } catch (_) { }

        // Si se debe crear un nuevo proyecto, usar datos extraídos (4 campos base) y guardar jerarquía + JSON
        if (crearProyecto && campos) {
            const timestamp = Date.now().toString();
            const estructuraMinimos = {
                entregables: entregablesExtraidos,
                texto_entregables_completo: analisisResult?.campos?.texto_entregables_completo || null
            };
            const datosProyecto = {
                id: timestamp,
                nombre: proyectoExtraido.nombre_proyecto || `Proyecto ${timestamp}`,
                cui: proyectoExtraido.cui || null,
                numero_entregables: (Number.isFinite(parseInt(proyectoExtraido.numero_entregables))
                    ? parseInt(proyectoExtraido.numero_entregables)
                    : Math.max(1, entregablesExtraidos.length || 1)),
                descripcion: proyectoExtraido.descripcion || null,
                estructura_minimos_json: JSON.stringify(estructuraMinimos),
                datos_extraidos: true
            };

            logger.info(`Intentando crear proyecto con datos: ${JSON.stringify(datosProyecto)}`, 'TDR-Upload');

            try {
                // Crear proyecto y jerarquía en una transacción
                await db.transaction(async (trx) => {
                    await trx('proyecto').insert(datosProyecto);
                    proyectoId = timestamp;
                    proyectoCreado = true;

                    for (let i = 0; i < entregablesExtraidos.length; i++) {
                        const ent = entregablesExtraidos[i] || {};
                        const nombreEnt = ent.nombre_entregable || `Entregable ${i + 1}`;
                        const porcentajePago = Number.isFinite(parseFloat(ent.porcentaje_pago)) ? parseFloat(String(ent.porcentaje_pago).toString().replace(/,/g, '.')) : null;

                        const [entregableId] = await trx('tdr_entregable').insert({
                            proyecto_id: proyectoId,
                            nombre_entregable: nombreEnt,
                            porcentaje_pago: porcentajePago
                        });

                        entregablesInsertados++;

                        // Insertar productos si existen
                        const productos = Array.isArray(ent.productos) ? ent.productos : [];
                        for (let p = 0; p < productos.length; p++) {
                            const prod = productos[p] || {};
                            await trx('tdr_producto').insert({
                                entregable_id: entregableId,
                                nombre_producto: prod.nombre_producto || `Producto ${p + 1}`,
                                descripcion: prod.descripcion || null,
                                orden: prod.orden || (p + 1)
                            });
                        }

                        const secciones = Array.isArray(ent.secciones_estudio) ? ent.secciones_estudio : [];
                        for (let j = 0; j < secciones.length; j++) {
                            const sec = secciones[j] || {};
                            const [seccionId] = await trx('tdr_seccion_estudio').insert({
                                entregable_id: entregableId,
                                nombre: sec.nombre || `Sección ${j + 1}`
                            });

                            const tipos = Array.isArray(sec.tipos_documento) ? sec.tipos_documento : [];
                            for (let k = 0; k < tipos.length; k++) {
                                const t = tipos[k] || {};
                                const [tipoId] = await trx('tdr_tipo_documento').insert({
                                    seccion_estudio_id: seccionId,
                                    nombre_tipo_documento: t.nombre_tipo_documento || `Tipo ${k + 1}`
                                });

                                const contenidos = Array.isArray(t.contenido_minimo) ? t.contenido_minimo : [];
                                for (let m = 0; m < contenidos.length; m++) {
                                    const c = contenidos[m] || {};
                                    const descripcion = [
                                        (c.nombre_requisito ? `${c.nombre_requisito}: ` : ''),
                                        (c.descripcion_completa || c.descripcion || '')
                                    ].join('');
                                    await trx('tdr_contenido_minimo').insert({
                                        tipo_documento_id: tipoId,
                                        descripcion_completa: descripcion
                                    });
                                }
                            }
                        }
                    }
                });

                logger.info(`Proyecto y jerarquía creados: ${proyectoId}`, 'TDR-Upload');
            } catch (dbError) {
                logger.error(`Error creando proyecto/jerarquía: ${dbError.message}`, 'TDR-Upload');

                // Eliminar archivo si falla la creación del proyecto
                try {
                    await fs.unlink(filePath);
                } catch (unlinkError) {
                    logger.error(`Error eliminando archivo: ${unlinkError.message}`, 'TDR-Upload');
                }

                return res.status(500).json({
                    success: false,
                    message: 'Error creando proyecto y jerarquía del TDR',
                    error: dbError.message
                });
            }
        }
        // Si NO se crea proyecto nuevo y hay proyecto_id, insertar/actualizar jerarquía del TDR
        if (!proyectoCreado && proyecto_id && entregablesExtraidos.length > 0) {
            try {
                await db.transaction(async (trx) => {
                    // Limpiar jerarquía previa si existe
                    await trx('tdr_entregable').where({ proyecto_id }).del();

                    for (let i = 0; i < entregablesExtraidos.length; i++) {
                        const ent = entregablesExtraidos[i] || {};
                        const nombreEnt = ent.nombre_entregable || `Entregable ${i + 1}`;
                        const porcentajePago = Number.isFinite(parseFloat(ent.porcentaje_pago)) ? parseFloat(String(ent.porcentaje_pago).toString().replace(/,/g, '.')) : null;

                        const [entregableId] = await trx('tdr_entregable').insert({
                            proyecto_id,
                            nombre_entregable: nombreEnt,
                            porcentaje_pago: porcentajePago
                        });
                        entregablesInsertados++;

                        // Insertar productos si existen
                        const productos = Array.isArray(ent.productos) ? ent.productos : [];
                        for (let p = 0; p < productos.length; p++) {
                            const prod = productos[p] || {};
                            await trx('tdr_producto').insert({
                                entregable_id: entregableId,
                                nombre_producto: prod.nombre_producto || `Producto ${p + 1}`,
                                descripcion: prod.descripcion || null,
                                orden: prod.orden || (p + 1)
                            });
                        }

                        const secciones = Array.isArray(ent.secciones_estudio) ? ent.secciones_estudio : [];
                        for (let j = 0; j < secciones.length; j++) {
                            const sec = secciones[j] || {};
                            const [seccionId] = await trx('tdr_seccion_estudio').insert({
                                entregable_id: entregableId,
                                nombre: sec.nombre || `Sección ${j + 1}`
                            });

                            const tipos = Array.isArray(sec.tipos_documento) ? sec.tipos_documento : [];
                            for (let k = 0; k < tipos.length; k++) {
                                const t = tipos[k] || {};
                                const [tipoId] = await trx('tdr_tipo_documento').insert({
                                    seccion_estudio_id: seccionId,
                                    nombre_tipo_documento: t.nombre_tipo_documento || `Tipo ${k + 1}`
                                });

                                const contenidos = Array.isArray(t.contenido_minimo) ? t.contenido_minimo : [];
                                for (let m = 0; m < contenidos.length; m++) {
                                    const c = contenidos[m] || {};
                                    const descripcion = [
                                        (c.nombre_requisito ? `${c.nombre_requisito}: ` : ''),
                                        (c.descripcion_completa || c.descripcion || '')
                                    ].join('');
                                    await trx('tdr_contenido_minimo').insert({
                                        tipo_documento_id: tipoId,
                                        descripcion_completa: descripcion
                                    });
                                }
                            }
                        }
                    }
                });
                logger.info(`Jerarquía TDR insertada/actualizada para proyecto: ${proyecto_id}`, 'TDR-Upload');
            } catch (e) {
                logger.error(`Error insertando jerarquía en proyecto existente: ${e.message}`, 'TDR-Upload');
                return res.status(500).json({ success: false, message: 'Error insertando estructura TDR en proyecto existente', error: e.message });
            }
        }

        // Verificar que el proyecto existe
        if (!proyectoCreado) {
            const proyectoExiste = await db('proyecto').where('id', proyectoId).first();
            if (!proyectoExiste) {
                try {
                    await fs.unlink(filePath);
                } catch (unlinkError) {
                    logger.error(`Error eliminando archivo: ${unlinkError.message}`, 'TDR-Upload');
                }

                return res.status(404).json({
                    success: false,
                    message: 'Proyecto no encontrado'
                });
            }
        }

        // Guardar/actualizar JSON estructura_minimos_json en proyecto
        if (proyectoId) {
            try {
                const estructuraMinimos = {
                    entregables: entregablesExtraidos,
                    texto_entregables_completo: analisisResult?.campos?.texto_entregables_completo || null
                };
                await db('proyecto').where('id', proyectoId).update({
                    estructura_minimos_json: JSON.stringify(estructuraMinimos)
                });
            } catch (e) {
                logger.error(`No se pudo actualizar estructura_minimos_json: ${e.message}`, 'TDR-Upload');
            }
        }

        // Crear registro del documento TDR
        const documentoId = Date.now().toString();
        const documentoData = {
            id: documentoId,
            proyecto_id: proyectoId,
            nombre_archivo: fileName,
            ruta_archivo: req.file.filename,
            estado: 'procesado',
            tipo_documento: 'tdr',
            orden: 0
        };

        await db('documentos').insert(documentoData);

        // Guardar análisis de OpenAI
        const analisisData = {
            documento_id: documentoId,
            contenido: JSON.stringify(analisisResult.campos),
            modelo_ia: analisisResult.modelo_usado || 'gpt-4-1106-preview',
            tipo_analisis: 'extraccion_campos_tdr'
        };

        await db('analisis').insert(analisisData);

        // Nota: Proyecto y estructura creada cuando crear_proyecto=true.

        logger.info(`TDR procesado exitosamente: ${fileName} para proyecto ${proyectoId}`, 'TDR-Upload');

        return res.status(200).json({
            success: true,
            message: 'TDR subido y analizado exitosamente',
            data: {
                proyecto_id: proyectoId,
                documento_id: documentoId,
                proyecto_creado: proyectoCreado,
                entregables_insertados: entregablesInsertados,
                nota_entregables: entregablesExtraidos.length === 0 ? 'OpenAI no devolvió entregables. Revisa el raw_preview o la clave de salida.' : undefined,
                archivo: {
                    nombre: fileName,
                    ruta: req.file.filename,
                    tamaño: req.file.size
                },
                analisis: {
                    modelo_usado: analisisResult.modelo_usado,
                    raw_preview: analisisResult.raw ? analisisResult.raw.slice(0, 4000) : undefined,
                    campos_extraidos: analisisResult.campos
                }
            }
        });

    } catch (error) {
        logger.error(`Error en upload y análisis TDR: ${error.message}`, 'TDR-Upload');

        // Limpiar archivo en caso de error
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                logger.error(`Error eliminando archivo: ${unlinkError.message}`, 'TDR-Upload');
            }
        }

        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

/**
 * GET /api/tdr/analisis/:documento_id
 * Obtiene el análisis de un TDR específico
 */
router.get('/analisis/:documento_id', async (req, res) => {
    try {
        const { documento_id } = req.params;

        const analisis = await db('analisis')
            .join('documentos', 'analisis.documento_id', 'documentos.id')
            .select(
                'analisis.*',
                'documentos.nombre_archivo',
                'documentos.proyecto_id'
            )
            .where('analisis.documento_id', documento_id)
            .where('analisis.tipo_analisis', 'extraccion_campos_tdr')
            .first();

        if (!analisis) {
            return res.status(404).json({
                success: false,
                message: 'Análisis no encontrado'
            });
        }

        // Parsear contenido JSON
        let campos_extraidos = {};
        try {
            campos_extraidos = JSON.parse(analisis.contenido);
        } catch (parseError) {
            logger.error(`Error parseando análisis: ${parseError.message}`, 'TDR-Analisis');
        }

        return res.status(200).json({
            success: true,
            analisis: {
                id: analisis.id,
                documento_id: analisis.documento_id,
                proyecto_id: analisis.proyecto_id,
                nombre_archivo: analisis.nombre_archivo,
                modelo_ia: analisis.modelo_ia,
                fecha_analisis: analisis.fecha_analisis,
                campos_extraidos: campos_extraidos
            }
        });

    } catch (error) {
        logger.error(`Error obteniendo análisis: ${error.message}`, 'TDR-Analisis');
        return res.status(500).json({
            success: false,
            message: 'Error obteniendo análisis',
            error: error.message
        });
    }
});

module.exports = router;
