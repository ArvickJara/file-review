// routes/index.js
const express = require('express');
const proyectosRoutes = require('./proyectos');

const router = express.Router();

router.use('/proyectos', proyectosRoutes);

module.exports = router;