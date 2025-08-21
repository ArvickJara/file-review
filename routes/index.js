const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();
logger.info('Iniciando registro de rutas API', 'Routes');

// Rutas de usuarios
const usuariosRoutes = require('./usuarios');
router.use('/usuarios', usuariosRoutes);
logger.info('Rutas de usuarios registradas', 'Routes');

// Rutas de municipalidad
const municipalidadRoutes = require('./municipalidad');
router.use('/municipalidad', municipalidadRoutes);
logger.info('Rutas de municipalidad registradas', 'Routes');

// Rutas de noticias
const noticiasRoutes = require('./noticias');
router.use('/noticias', noticiasRoutes);
logger.info('Rutas de noticias registradas', 'Routes');

// Rutas de redes sociales
const redesSocialesRoutes = require('./redes-sociales');
router.use('/redes-sociales', redesSocialesRoutes);
logger.info('Rutas de redes sociales registradas', 'Routes');

// Rutas de servicios
const serviciosRoutes = require('./servicios');
router.use('/servicios', serviciosRoutes);
logger.info('Rutas de servicios registradas', 'Routes');

// Rutas de miembros
const miembrosRoutes = require('./miembros');
router.use('/miembros', miembrosRoutes);
logger.info('Rutas de miembros registradas', 'Routes');

// Rutas de proyectos
const proyectosRoutes = require('./proyectos');
router.use('/proyectos', proyectosRoutes);
logger.info('Rutas de proyectos registradas', 'Routes');

// Rutas de tipos de convocatorias
const convocatoriaTiposRoutes = require('./convocatoria-tipos');
router.use('/convocatoria-tipos', convocatoriaTiposRoutes);
logger.info('Rutas de tipos de convocatorias registradas', 'Routes');

// Rutas de convocatorias
const convocatoriasRoutes = require('./convocatorias');
router.use('/convocatorias', convocatoriasRoutes);
logger.info('Rutas de convocatorias registradas', 'Routes');

logger.info('Todas las rutas API registradas correctamente', 'Routes');
module.exports = router;