const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
    try {
        const proyectos = await db('proyecto').select('*').orderBy('fecha_creacion', 'desc');
        return res.status(200).json({
            success: true, proyectos
        });
    } catch (error) {
        logger.error(`Error listando proyectos: ${error.message}`, 'ListarProyectos');
        return res.status(500).json({
            success: false,
            message: 'Error al listar los proyectos',
            error: error.message
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nombre, cui, numero_entregables, descripcion } = req.body;
        if (!nombre || !numero_entregables) {
            return res.status(400).json({
                success: false,
                message: 'Nombre y número de entregables son obligatorios'
            });
        }

        const proyectoId = Date.now().toString();

        await db('proyecto').insert({
            id: proyectoId,
            nombre,
            cui: cui || null,
            numero_entregables: parseInt(numero_entregables),
            descripcion: descripcion || null,
            datos_extraidos: false

        });

        return res.status(201).json({
            success: true,
            proyecto: {
                id: proyectoId,
                nombre,
                cui,
                numero_entregables,
                descripcion
            },
            message: 'proyecto creado exitosamente'
        });
    } catch (error) {
        // Manejar error específico de nombre duplicado (constraint UNIQUE)
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('nombre')) {
            return res.status(409).json({  // 409 = Conflict
                success: false,
                message: 'Ya existe un proyecto con ese nombre'
            });
        }

        // Manejar error específico de CUI duplicado
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('cui')) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un proyecto con ese CUI'
            });
        }

        // Error genérico
        logger.error(`Error creando proyecto: ${error.message}`, 'CrearProyecto');
        return res.status(500).json({
            success: false,
            message: 'Error al crear el proyecto',
            error: error.message
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const proyecto = await db('proyecto').where('id', id).first();

        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado',
            });
        }

        return res.status(200).json({
            success: true,
            proyecto
        });
    } catch (error) {
        logger.error(`Error obteniendo proyecto: ${error.message}`, 'GetProyecto');
        return res.status(500).json({
            success: false,
            message: 'Error al obtener el proyecto',
            error: error.message
        });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, cui, numero_entregables, descripcion, datos_extraidos } = req.body;

        // Verificar que el proyecto existe antes de actualizar
        const proyectoExistente = await db('proyecto').where('id', id).first();
        if (!proyectoExistente) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        // Preparar objeto con solo los campos que se van a actualizar
        // (evita sobrescribir con undefined)
        const datosActualizar = {};
        if (nombre !== undefined) datosActualizar.nombre = nombre;
        if (cui !== undefined) datosActualizar.cui = cui;

        // Validar numero_entregables si se proporciona
        if (numero_entregables !== undefined) {
            if (isNaN(numero_entregables) || numero_entregables <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El número de entregables debe ser un número positivo'
                });
            }
            datosActualizar.numero_entregables = parseInt(numero_entregables);
        }

        if (descripcion !== undefined) datosActualizar.descripcion = descripcion;
        if (datos_extraidos !== undefined) datosActualizar.datos_extraidos = Boolean(datos_extraidos);

        // Ejecutar la actualización en la base de datos
        await db('proyecto').where('id', id).update(datosActualizar);

        // Obtener el proyecto actualizado para devolverlo
        const proyectoActualizado = await db('proyecto').where('id', id).first();

        return res.status(200).json({
            success: true,
            proyecto: proyectoActualizado,
            message: 'Proyecto actualizado exitosamente'
        });

    } catch (error) {
        // Manejar errores de constraints (duplicados)
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('nombre')) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un proyecto con ese nombre'
            });
        }

        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('cui')) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un proyecto con ese CUI'
            });
        }

        logger.error(`Error actualizando proyecto: ${error.message}`, 'ActualizarProyecto');
        return res.status(500).json({
            success: false,
            message: 'Error al actualizar el proyecto',
            error: error.message
        });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que el proyecto existe antes de eliminar
        const proyecto = await db('proyecto').where('id', id).first();
        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        // Eliminar el proyecto (CASCADE eliminará automáticamente registros relacionados)
        await db('proyecto').where('id', id).del();

        return res.status(200).json({
            success: true,
            message: 'Proyecto eliminado exitosamente'
        });

    } catch (error) {
        logger.error(`Error eliminando proyecto: ${error.message}`, 'EliminarProyecto');
        return res.status(500).json({
            success: false,
            message: 'Error al eliminar el proyecto',
            error: error.message
        });
    }
});

module.exports = router;