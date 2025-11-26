const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Crear directorio si no existe
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  logger.info(`Creando directorio de uploads en: ${uploadDir}`, 'FileUpload');
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    logger.debug(`Almacenando archivo en: ${uploadDir}`, 'FileUpload');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = 'img-' + uniqueSuffix + path.extname(file.originalname);
    logger.debug(`Generando nombre de archivo: ${fileName} (Original: ${file.originalname})`, 'FileUpload');
    cb(null, fileName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB por archivo para soportar entregables voluminosos
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      logger.debug(`Archivo válido: ${file.originalname} (${file.mimetype})`, 'FileUpload');
      cb(null, true);
    } else {
      logger.warn(`Archivo rechazado: ${file.originalname} (${file.mimetype})`, 'FileUpload');
      cb(new Error('Solo se permiten documentos PDF, DOC y DOCX'));
    }
  }
});

// Middleware para manejar ambos formatos
const parseBody = (fileField = null) => {
  return (req, res, next) => {
    const contentType = req.headers['content-type'];
    logger.debug(`Procesando request body: ${contentType} en ruta ${req.originalUrl}`, 'ParseBody');

    if (contentType && contentType.includes('multipart/form-data')) {
      // Es form-data, usar multer
      logger.debug(`Procesando multipart/form-data con campo de archivo: ${fileField || 'ninguno'}`, 'ParseBody');
      const uploadHandler = fileField ? upload.single(fileField) : upload.none();
      uploadHandler(req, res, (err) => {
        if (err) {
          logger.error(`Error procesando archivo en ${req.originalUrl}: ${err.message}`, 'ParseBody');
          return res.status(400).json({ error: 'Error procesando archivo', details: err.message });
        }
        // Convertir strings a booleans para form-data
        if (req.body.destacada) req.body.destacada = req.body.destacada === 'true';
        if (req.body.activa) req.body.activa = req.body.activa === 'true';
        if (req.body.activo) req.body.activo = req.body.activo === 'true';

        if (req.file) {
          logger.info(`Archivo subido: ${req.file.filename} (${req.file.size} bytes)`, 'FileUpload');
        }

        logger.debug('Body procesado correctamente', 'ParseBody');
        next();
      });
    } else {
      // Es JSON, continuar normal
      logger.debug('Procesando JSON body', 'ParseBody');
      next();
    }
  };
};

module.exports = { parseBody, upload };
