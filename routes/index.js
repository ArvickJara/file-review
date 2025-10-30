// routes/index.js
const express = require('express');
const proyectosRoutes = require('./proyectos');
const tdrRoutes = require('./tdr');
const expedientesRoutes = require('./expedientes_tecnicos');

const router = express.Router();

router.use('/proyectos', proyectosRoutes);
router.use('/tdr', tdrRoutes);
router.use('/expedientes_tecnicos', expedientesRoutes);

module.exports = router;