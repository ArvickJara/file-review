const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const protect = (roles = []) => {
  return (req, res, next) => {
    try {
      logger.debug(`Verificando autenticación para ruta: ${req.method} ${req.originalUrl}`, 'Auth');
      const authHeader = req.header('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn(`Acceso no autorizado a ${req.originalUrl} - Token no encontrado`, 'Auth');
        return res.status(401).json({ message: 'Acceso no autorizado, token no encontrado.' });
      }

      const token = authHeader.replace('Bearer ', '').trim();

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
      
      // Asignar el usuario decodificado a req.user
      req.user = decoded;
      
      logger.debug(`Usuario ID:${req.user.id} autenticado correctamente`, 'Auth');

      if (roles.length && !roles.includes(req.user.role)) {
        logger.warn(`Acceso denegado a ${req.originalUrl} - Usuario ID:${req.user.id} con rol ${req.user.role} intentó acceder a ruta restringida`, 'Auth');
        return res.status(403).json({ message: 'Acceso denegado, no tienes permisos suficientes.' });
      }

      logger.info(`Acceso autorizado a ${req.originalUrl} - Usuario ID:${req.user.id}, Rol:${req.user.role}`, 'Auth');
      next();
    } catch (error) {
      logger.error(`Error al verificar token para ruta ${req.originalUrl}: ${error.message}`, 'Auth');
      console.error('Error al verificar el token:', error.message);
      return res.status(401).json({ message: 'Token inválido o expirado.' });
    }
  };
};

module.exports = protect;