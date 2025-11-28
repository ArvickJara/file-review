const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('./logger');

/**
 * Convierte un PDF a imágenes PNG usando pdf-poppler
 * Requiere tener instalado poppler-utils:
 * - Windows: Descargar desde https://github.com/oschwartz10612/poppler-windows/releases
 * - Linux: sudo apt-get install poppler-utils
 * - Mac: brew install poppler
 * 
 * @param {string} pdfPath - Ruta absoluta al archivo PDF
 * @returns {Promise<string[]>} Array con las rutas de las imágenes generadas
 */
async function convertPdfToImages(pdfPath) {
    try {
        // Crear directorio temporal para las imágenes
        const tempDir = path.join(__dirname, '..', 'temp', 'pdf-images');
        await fs.mkdir(tempDir, { recursive: true });

        // Generar nombre único para las imágenes
        const timestamp = Date.now();
        const basename = path.basename(pdfPath, '.pdf');
        const outputPrefix = path.join(tempDir, `${basename}-${timestamp}`);

        // Comando para convertir PDF a imágenes PNG
        // -png: formato de salida PNG
        // -r 300: resolución de 300 DPI (alta calidad para OCR)
        // -singlefile: si solo hay una página, no agregar número
        const command = `pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`;

        logger.info(`Ejecutando conversión PDF->Imágenes: ${command}`, 'PDFConverter');

        try {
            await execAsync(command);
        } catch (execError) {
            // Si pdftoppm no está disponible, intentar con método alternativo usando pdf-lib
            logger.warn('pdftoppm no disponible, intentando método alternativo', 'PDFConverter');
            return await convertPdfToImagesAlternative(pdfPath, outputPrefix);
        }

        // Buscar todas las imágenes generadas
        const files = await fs.readdir(tempDir);
        const imageFiles = files
            .filter(f => f.startsWith(path.basename(outputPrefix)) && f.endsWith('.png'))
            .sort() // Ordenar por nombre para mantener orden de páginas
            .map(f => path.join(tempDir, f));

        if (imageFiles.length === 0) {
            throw new Error('No se generaron imágenes del PDF');
        }

        logger.info(`PDF convertido exitosamente a ${imageFiles.length} imagen(es)`, 'PDFConverter');
        return imageFiles;

    } catch (error) {
        logger.error(`Error convirtiendo PDF a imágenes: ${error.message}`, 'PDFConverter');
        throw new Error(`Error en conversión PDF: ${error.message}`);
    }
}

/**
 * Método alternativo de conversión usando sharp y pdf-lib
 * Usado como fallback si poppler no está disponible
 */
async function convertPdfToImagesAlternative(pdfPath, outputPrefix) {
    try {
        // Intentar usar pdf-lib y canvas (requiere instalación: npm install pdf-lib canvas)
        const { PDFDocument } = require('pdf-lib');
        const { createCanvas } = require('canvas');

        const pdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pageCount = pdfDoc.getPageCount();

        const imagePaths = [];

        for (let i = 0; i < pageCount; i++) {
            // Este es un enfoque simplificado
            // En producción podrías usar pdf2pic o similar
            const outputPath = `${outputPrefix}-${i + 1}.png`;

            // Aquí necesitarías implementar la lógica de renderizado
            // Por ahora, lanzamos un error indicando que se necesita poppler
            throw new Error('Método alternativo no implementado. Instala poppler-utils para convertir PDFs.');
        }

        return imagePaths;

    } catch (error) {
        throw new Error(`Conversión alternativa falló: ${error.message}. Por favor instala poppler-utils.`);
    }
}

/**
 * Limpia el directorio temporal de imágenes
 */
async function cleanTempImages() {
    try {
        const tempDir = path.join(__dirname, '..', 'temp', 'pdf-images');
        const files = await fs.readdir(tempDir);

        await Promise.all(files.map(async (file) => {
            const filePath = path.join(tempDir, file);
            try {
                await fs.unlink(filePath);
            } catch (err) {
                logger.warn(`No se pudo eliminar ${filePath}`, 'PDFConverter');
            }
        }));

        logger.info('Directorio temporal limpiado', 'PDFConverter');
    } catch (error) {
        logger.error(`Error limpiando directorio temporal: ${error.message}`, 'PDFConverter');
    }
}

module.exports = {
    convertPdfToImages,
    cleanTempImages
};
