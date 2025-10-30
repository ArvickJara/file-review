const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const logger = require('../utils/logger');

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
            entregables: entregablesConJerarquia
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
            .orderBy('fecha_subida', 'desc')
            .select('*');

        // Enriquecer con URL pública si existe ruta_archivo
        const docsConUrl = documentos.map(d => ({
            ...d,
            url_publica: d.ruta_archivo ? `/public/uploads/${d.ruta_archivo}` : null
        }));

        return res.status(200).json({ success: true, documentos: docsConUrl });
    } catch (error) {
        logger.error(`Error listando documentos del proyecto: ${error.message}`, 'ExpedientesDocs');
        return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
});

module.exports = router;
