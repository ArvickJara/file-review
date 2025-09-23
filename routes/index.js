// routes/index.js
const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

logger.startOperation('Registro de rutas API');

try {
    // Rutas para costos y presupuestos
    const costosPresupuestosRoutes = require('./costos-presupuestos');
    router.use('/costos-presupuestos', costosPresupuestosRoutes);
    logger.info('Rutas de costos y presupuestos registradas', 'Routes');

    // Rutas para expedientes técnicos
    const expedientesTecnicosRoutes = require('./expedientes_tecnicos');
    router.use('/expedientes_tecnicos', expedientesTecnicosRoutes);
    logger.info('Rutas de expedientes técnicos registradas', 'Routes');

    const proyectosRoutes = require('./proyectos');
    router.use('/proyectos', proyectosRoutes);
    logger.info('Rutas de proyectos registradas', 'Routes');

    // Rutas de auditoría (si existe)
    try {
        const auditRoutes = require('./audit');
        router.use('/audit', auditRoutes);
        logger.info('Rutas de auditoría registradas', 'Routes');
    } catch (auditError) {
        logger.warn('Archivo de rutas de auditoría no encontrado, omitiendo', 'Routes');
    }

    logger.endOperation('Registro de rutas API', { status: 'success' });
} catch (error) {
    logger.operationError('Registro de rutas API', error);
    throw error;
}

module.exports = router;