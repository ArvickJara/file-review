const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');

// Crear directorio de logs si no existe
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, 'app.log');

/**
 * Función base para registrar mensajes.
 * @param {string} level - Nivel del log (info, warn, error, debug).
 * @param {string} message - El mensaje a registrar.
 * @param {string} [context='General'] - El contexto o módulo donde ocurre el evento.
 */
const log = (level, message, context = 'General') => {
    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${context}] ${message}\n`;

    // Escribir en la consola con colores
    if (level === 'error') {
        console.error(formattedMessage.trim());
    } else if (level === 'warn') {
        console.warn(formattedMessage.trim());
    } else {
        console.log(formattedMessage.trim());
    }

    // Escribir en el archivo de log
    fs.appendFile(logFile, formattedMessage, (err) => {
        if (err) {
            console.error('Fallo al escribir en el archivo de log:', err);
        }
    });
};

/**
 * Registra el inicio de una operación.
 * @param {string} operationName - Nombre de la operación.
 * @param {object} metadata - Datos adicionales (no se usa actualmente pero es buena práctica).
 * @param {string} context - Contexto de la operación.
 */
const startOperation = (operationName, metadata = {}, context = 'Operation') => {
    log('info', `Iniciando operación: '${operationName}'`, context);
};

/**
 * Registra la finalización exitosa de una operación.
 * @param {string} operationName - Nombre de la operación.
 * @param {object} metadata - Datos adicionales, como el estado.
 * @param {string} context - Contexto de la operación.
 */
const endOperation = (operationName, metadata = { status: 'success' }, context = 'Operation') => {
    log('info', `Operación finalizada: '${operationName}' - Estado: ${metadata.status}`, context);
};

/**
 * Registra un error ocurrido durante una operación.
 * @param {string} operationName - Nombre de la operación.
 * @param {Error} error - El objeto de error.
 * @param {string} context - Contexto de la operación.
 */
const operationError = (operationName, error, context = 'Operation') => {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    log('error', `Error en operación '${operationName}': ${errorMessage}`, context);
    if (error instanceof Error && error.stack) {
        // Opcional: registrar el stack trace para más detalles
        log('debug', `Stack trace para '${operationName}': ${error.stack}`, context);
    }
};


const logger = {
    info: (message, context) => log('info', message, context),
    warn: (message, context) => log('warn', message, context),
    error: (message, context) => log('error', message, context),
    debug: (message, context) => log('debug', message, context),
    startOperation,
    endOperation,
    operationError,
};

module.exports = logger;