const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();
logger.info('Iniciando registro de rutas API', 'Routes');



// Rutas de expedientes
const expedientesRoutes = require('./expedientes');
router.use('/expedientes', expedientesRoutes);
logger.info('Rutas de expedientes registradas', 'Routes');

logger.info('Todas las rutas API registradas correctamente', 'Routes');
module.exports = router;