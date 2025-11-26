const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const db = require('../db/knex');
const logger = require('../utils/logger');
const { upload } = require('../middleware/parseBody');

const MAX_TOMOS_PER_BATCH = 20;
const PUBLIC_UPLOAD_PREFIX = '/public/uploads';

const mapDocumento = (documento) => {
    const tipo = documento.tipo_documento || (documento.orden === 0 ? 'tdr' : 'tomo');
    const orden = documento.orden ?? (tipo === 'tdr' ? 0 : null);

    return {
        ...documento,
        tipo_documento: tipo,
        orden,
        nombre: documento.nombre_archivo,
        url_publica: documento.ruta_archivo ? `${PUBLIC_UPLOAD_PREFIX}/${documento.ruta_archivo}` : null
    };
};

const deleteUploadedFiles = async (files = []) => {
    await Promise.all(files.map(async (file) => {
        if (!file?.path) return;
        try {
            await fs.unlink(file.path);
        } catch (err) {
            logger.warn(`No se pudo eliminar archivo cargado ${file.path}: ${err.message}`, 'ExpedientesDocs');
        }
    }));
};

// GET /api/expedientes_tecnicos/tdrs/:proyectoId
// Devuelve la estructura completa del TDR (entregables -> secciones -> tipos -> contenido mínimo)
router.get('/tdrs/:proyectoId', async (req, res) => {
    try {
        const { proyectoId } = req.params;

        // 1) Proyecto
        const proyecto = await db('proyecto').where('id', proyectoId).first();
        if (!proyecto) {
            return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
        }

        // 2) Entregables
        const entregables = await db('tdr_entregable')
            .where({ proyecto_id: proyectoId })
            .select('*');

        if (entregables.length === 0) {
            return res.status(200).json({
                success: true,
                proyecto: {
                    id: proyecto.id,
                    nombre: proyecto.nombre,
                    cui: proyecto.cui,
                    numero_entregables: proyecto.numero_entregables,
                    descripcion: proyecto.descripcion,
                    fecha_creacion: proyecto.fecha_creacion,
                },
                entregables: []
            });
        }

        const entregableIds = entregables.map(e => e.id);

        // 3) Secciones
        const secciones = await db('tdr_seccion_estudio')
            .whereIn('entregable_id', entregableIds)
            .select('*');

        const seccionIds = secciones.map(s => s.id);

        // 4) Tipos de documento
        const tipos = seccionIds.length > 0
            ? await db('tdr_tipo_documento').whereIn('seccion_estudio_id', seccionIds).select('*')
            : [];

        const tipoIds = tipos.map(t => t.id);

        // 5) Contenido mínimo
        const contenidos = tipoIds.length > 0
            ? await db('tdr_contenido_minimo').whereIn('tipo_documento_id', tipoIds).select('*')
            : [];

        // Armado jerárquico
        const contenidosPorTipo = contenidos.reduce((acc, c) => {
            (acc[c.tipo_documento_id] = acc[c.tipo_documento_id] || []).push({
                id: c.id,
                nombre_requisito: c.nombre_requisito,
                descripcion_completa: c.descripcion_completa,
                es_obligatorio: !!c.es_obligatorio,
                orden: c.orden,
                created_at: c.created_at
            });
            return acc;
        }, {});

        const tiposPorSeccion = tipos.reduce((acc, t) => {
            (acc[t.seccion_estudio_id] = acc[t.seccion_estudio_id] || []).push({
                id: t.id,
                nombre_tipo_documento: t.nombre_tipo_documento,
                orden: t.orden,
                created_at: t.created_at,
                contenido_minimo: contenidosPorTipo[t.id] || []
            });
            return acc;
        }, {});

        const seccionesPorEntregable = secciones.reduce((acc, s) => {
            (acc[s.entregable_id] = acc[s.entregable_id] || []).push({
                id: s.id,
                nombre: s.nombre,
                orden: s.orden,
                es_estudio_completo: !!s.es_estudio_completo,
                created_at: s.created_at,
                tipos_documento: tiposPorSeccion[s.id] || []
            });
            return acc;
        }, {});

        const entregablesConJerarquia = entregables.map(e => ({
            id: e.id,
            nombre_entregable: e.nombre_entregable,
            plazo_dias: e.plazo_dias,
            porcentaje_pago: e.porcentaje_pago,
            created_at: e.created_at,
            secciones_estudio: seccionesPorEntregable[e.id] || []
        }));

        return res.status(200).json({
            success: true,
            proyecto: {
                id: proyecto.id,
                nombre: proyecto.nombre,
                cui: proyecto.cui,
                numero_entregables: proyecto.numero_entregables,
                descripcion: proyecto.descripcion,
                fecha_creacion: proyecto.fecha_creacion,
            },
            entregables: entregablesConJerarquia,
            tdrs: entregablesConJerarquia
        });

    } catch (error) {
        logger.error(`Error obteniendo TDRs del proyecto: ${error.message}`, 'ExpedientesTDR');
        return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
});

// GET /api/expedientes_tecnicos/documentos/:proyectoId
// Lista los documentos asociados a un proyecto
router.get('/documentos/:proyectoId', async (req, res) => {
    try {
        const { proyectoId } = req.params;

        const proyecto = await db('proyecto').where('id', proyectoId).first();
        if (!proyecto) {
            return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
        }

        const documentos = await db('documentos')
            .where({ proyecto_id: proyectoId })
            .orderBy('orden', 'asc')
            .orderBy('fecha_subida', 'desc')
            .select('*');

        return res.status(200).json({ success: true, documentos: documentos.map(mapDocumento) });
    } catch (error) {
        logger.error(`Error listando documentos del proyecto: ${error.message}`, 'ExpedientesDocs');
        return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
});

// DELETE /api/expedientes_tecnicos/documentos/:documentoId
// Permite eliminar un entregable/TDR específico
router.delete('/documentos/:documentoId', async (req, res) => {
    try {
        const { documentoId } = req.params;

        const documento = await db('documentos').where({ id: documentoId }).first();
        if (!documento) {
            return res.status(404).json({ success: false, message: 'Documento no encontrado' });
        }

        await db('documentos').where({ id: documentoId }).del();

        if (documento.ruta_archivo) {
            const absolutePath = path.join(__dirname, '..', 'public', 'uploads', documento.ruta_archivo);
            try {
                await fs.unlink(absolutePath);
            } catch (err) {
                logger.warn(`No se pudo eliminar archivo físico ${absolutePath}: ${err.message}`, 'ExpedientesDocs');
            }
        }

        return res.status(200).json({ success: true, message: 'Documento eliminado correctamente' });
    } catch (error) {
        logger.error(`Error eliminando documento: ${error.message}`, 'ExpedientesDocs');
        return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
});

// POST /api/expedientes_tecnicos/evaluar-expediente
// Por ahora almacena los tomos y aplica validaciones de límite por entregables
router.post('/evaluar-expediente', (req, res) => {
    const tomoUpload = upload.array('tomos', MAX_TOMOS_PER_BATCH);
    tomoUpload(req, res, async (err) => {
        if (err) {
            logger.error(`Error subiendo tomos: ${err.message}`, 'ExpedientesDocs');
            return res.status(400).json({ success: false, message: err.message || 'Error subiendo tomos' });
        }

        const { proyecto_id, tdrId } = req.body;
        const files = req.files || [];

        if (!proyecto_id) {
            await deleteUploadedFiles(files);
            return res.status(400).json({ success: false, message: 'proyecto_id es requerido' });
        }

        if (!files.length) {
            return res.status(400).json({ success: false, message: 'Debes adjuntar al menos un tomo en PDF' });
        }

        const nonPdfFiles = files.filter((file) => file.mimetype !== 'application/pdf');
        if (nonPdfFiles.length > 0) {
            await deleteUploadedFiles(files);
            return res.status(400).json({ success: false, message: 'Los tomos deben ser archivos PDF escaneados' });
        }

        try {
            const proyecto = await db('proyecto').where('id', proyecto_id).first();
            if (!proyecto) {
                await deleteUploadedFiles(files);
                return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
            }

            const numeroEntregables = Number(proyecto.numero_entregables) || 0;
            if (numeroEntregables <= 0) {
                await deleteUploadedFiles(files);
                return res.status(400).json({ success: false, message: 'El proyecto no tiene número de entregables definido' });
            }

            if (tdrId) {
                const tdrDocumento = await db('documentos').where({ id: tdrId, proyecto_id, tipo_documento: 'tdr' }).first();
                if (!tdrDocumento) {
                    await deleteUploadedFiles(files);
                    return res.status(400).json({ success: false, message: 'El TDR seleccionado no pertenece al proyecto' });
                }
            }

            const existingCountResult = await db('documentos')
                .where({ proyecto_id, tipo_documento: 'tomo' })
                .count({ total: 'id' })
                .first();
            const existingTomos = Number(existingCountResult?.total) || 0;

            if (existingTomos >= numeroEntregables) {
                await deleteUploadedFiles(files);
                return res.status(400).json({
                    success: false,
                    message: 'Ya registraste el número máximo de tomos permitido por el TDR'
                });
            }

            const remainingSlots = numeroEntregables - existingTomos;
            if (files.length > remainingSlots) {
                await deleteUploadedFiles(files);
                return res.status(400).json({
                    success: false,
                    message: `Solo puedes subir ${remainingSlots} tomo(s) adicionales. El TDR exige ${numeroEntregables} entregables.`
                });
            }

            const now = Date.now();
            const documentosToInsert = files.map((file, index) => ({
                id: `${now}-${index}-${Math.floor(Math.random() * 1e6)}`,
                proyecto_id,
                nombre_archivo: file.originalname,
                ruta_archivo: file.filename,
                estado: 'registrado',
                tipo_documento: 'tomo',
                orden: existingTomos + index + 1
            }));

            await db('documentos').insert(documentosToInsert);

            const resumen = {
                total_tomos: numeroEntregables,
                tomos_procesados_exitosamente: documentosToInsert.length,
                tomos_con_errores: 0
            };

            return res.status(200).json({
                success: true,
                message: `Se registraron ${documentosToInsert.length} tomo(s). Restan ${numeroEntregables - (existingTomos + documentosToInsert.length)} por cargar.`,
                resumen,
                documentos: documentosToInsert.map(mapDocumento)
            });
        } catch (error) {
            logger.error(`Error guardando tomos: ${error.message}`, 'ExpedientesDocs');
            await deleteUploadedFiles(files);
            return res.status(500).json({ success: false, message: 'Error interno al registrar tomos', error: error.message });
        }
    });
});

module.exports = router;
