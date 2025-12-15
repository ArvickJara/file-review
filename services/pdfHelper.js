/**
 * Helper para parsear PDFs usando pdf2json
 * pdf2json funciona nativamente en Node.js sin requerir polyfills del navegador
 */

const PDFParser = require('pdf2json');
const logger = require('../utils/logger');

/**
 * Parsea un buffer de PDF y retorna el texto completo
 * @param {Buffer} pdfBuffer - Buffer del archivo PDF
 * @returns {Promise<{text: string, numpages: number, info: object}>}
 */
async function parsePDF(pdfBuffer) {
    return new Promise((resolve, reject) => {
        try {
            const pdfParser = new PDFParser();

            pdfParser.on('pdfParser_dataError', (errData) => {
                logger.error(`Error parseando PDF: ${errData.parserError}`, 'PDFHelper');
                reject(new Error(`Error al parsear PDF: ${errData.parserError}`));
            });

            pdfParser.on('pdfParser_dataReady', (pdfData) => {
                try {
                    // Extraer texto de todas las páginas
                    let fullText = '';
                    let pageCount = 0;

                    if (pdfData.Pages) {
                        pageCount = pdfData.Pages.length;

                        for (const page of pdfData.Pages) {
                            if (page.Texts) {
                                for (const text of page.Texts) {
                                    if (text.R) {
                                        for (const run of text.R) {
                                            if (run.T) {
                                                try {
                                                    // Decodificar texto URI-encoded de forma segura
                                                    fullText += decodeURIComponent(run.T) + ' ';
                                                } catch (decodeError) {
                                                    // Si falla la decodificación, usar el texto raw
                                                    fullText += run.T + ' ';
                                                }
                                            }
                                        }
                                    }
                                }
                                fullText += '\n'; // Nueva línea al final de cada página
                            }
                        }
                    }

                    logger.info(`PDF parseado exitosamente: ${fullText.length} caracteres, ${pageCount} páginas`, 'PDFHelper');

                    resolve({
                        text: fullText,
                        numpages: pageCount,
                        info: pdfData.Meta || {}
                    });
                } catch (error) {
                    logger.error(`Error procesando datos del PDF: ${error.message}`, 'PDFHelper');
                    reject(new Error(`Error procesando datos del PDF: ${error.message}`));
                }
            });

            // Parsear el buffer
            pdfParser.parseBuffer(pdfBuffer);

        } catch (error) {
            logger.error(`Error inicializando parser: ${error.message}`, 'PDFHelper');
            reject(new Error(`Error inicializando parser: ${error.message}`));
        }
    });
}

module.exports = {
    parsePDF
};
