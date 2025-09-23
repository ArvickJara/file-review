const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const logger = require('../utils/logger');

// GET /api/proyectos - Listar todos los proyectos
router.get('/', async (req, res) => {
    try {
        const proyectos = await db('proyectos')
            .select('*')
            .orderBy('fecha_creacion', 'desc');

        return res.status(200).json({
            success: true,
            proyectos
        });
    } catch (error) {
        logger.error(`Error listando proyectos: ${error.message}`, 'ListarProyectos');
        return res.status(500).json({
            success: false,
            message: 'Error al listar proyectos',
            error: error.message
        });
    }
});

// POST /api/proyectos - Crear un proyecto (con nombre temporal)
router.post('/', async (req, res) => {
    try {
        const { nombre_temporal } = req.body;

        if (!nombre_temporal) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un nombre temporal para el proyecto'
            });
        }

        const proyectoId = Date.now().toString();

        await db('proyectos').insert({
            id: proyectoId,
            nombre: nombre_temporal,
            estado: 'creado'
        });

        return res.status(201).json({
            success: true,
            proyecto: { id: proyectoId, nombre: nombre_temporal },
            message: 'Proyecto creado. Los datos se completarán al procesar el TDR.'
        });

    } catch (error) {
        logger.error(`Error creando proyecto: ${error.message}`, 'CrearProyecto');
        return res.status(500).json({
            success: false,
            message: 'Error al crear el proyecto',
            error: error.message
        });
    }
});

// GET /api/proyectos/:id - Obtener un proyecto específico
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const proyecto = await db('proyectos').where('id', id).first();

        if (!proyecto) {
            return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
        }

        return res.status(200).json({ success: true, proyecto });
    } catch (error) {
        logger.error(`Error obteniendo proyecto: ${error.message}`, 'GetProyecto');
        return res.status(500).json({
            success: false,
            message: 'Error al obtener el proyecto',
            error: error.message
        });
    }
});


module.exports = router;