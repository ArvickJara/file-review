// routes/index.js
const express = require('express');
const proyectosRoutes = require('./proyectos');
const tdrRoutes = require('./tdr');
const expedientesRoutes = require('./expedientes_tecnicos');
const productosRoutes = require('./productos');

const router = express.Router();

router.use('/proyectos', proyectosRoutes);
router.use('/tdr', tdrRoutes);
router.use('/expedientes_tecnicos', expedientesRoutes);
router.use('/', productosRoutes);

module.exports = router;