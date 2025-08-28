// routes/index.js
const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();
logger.info('Iniciando registro de rutas API', 'Routes');

// costos/presupuestos
const expedientesRoutes = require('./expedientes');
router.use('/expedientes', expedientesRoutes);

// TDR (archivo aparte)
const expedientesTecnicoRoutes = require('./expedientes_tecnico');
router.use('/expedientes', expedientesTecnicoRoutes);

logger.info('Todas las rutas API registradas correctamente', 'Routes');
module.exports = router;