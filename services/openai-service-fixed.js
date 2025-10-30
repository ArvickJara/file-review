const OpenAI = require('openai');
const fs = require('fs').promises;
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const logger = require('../utils/logger');

class OpenAIService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    /**
     * Extrae texto de un archivo Word o PDF CONSERVANDO estructura
     * @param {Buffer} fileBuffer - Buffer del archivo
     * @param {string} fileName - Nombre del archivo
     * @returns {Promise<string>} - Texto extraído con formato
     */
    async extractTextFromFile(fileBuffer, fileName) {
        try {
            const extension = fileName.toLowerCase().split('.').pop();

            if (extension === 'docx' || extension === 'doc') {
                // Extraer texto de Word CON formato y estructura (sin imágenes)
                const result = await mammoth.convertToHtml({ buffer: fileBuffer });
                const htmlContent = result.value;

                // Convertir HTML a texto manteniendo estructura
                const textWithStructure = htmlContent
                    .replace(/<h\d[^>]*>/gi, '\n\n**')
                    .replace(/<\/h\d>/gi, '**\n')
                    .replace(/<strong[^>]*>/gi, '**')
                    .replace(/<\/strong>/gi, '**')
                    .replace(/<em[^>]*>/gi, '*')
                    .replace(/<\/em>/gi, '*')
                    .replace(/<li[^>]*>/gi, '\n- ')
                    .replace(/<\/li>/gi, '')
                    .replace(/<p[^>]*>/gi, '\n')
                    .replace(/<\/p>/gi, '\n')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<table[^>]*>/gi, '\n\nTABLA:\n')
                    .replace(/<\/table>/gi, '\n\n')
                    .replace(/<tr[^>]*>/gi, '\n')
                    .replace(/<\/tr>/gi, '')
                    .replace(/<td[^>]*>/gi, ' | ')
                    .replace(/<\/td>/gi, '')
                    .replace(/<th[^>]*>/gi, ' | ')
                    .replace(/<\/th>/gi, '')
                    .replace(/<[^>]+>/g, '') // Eliminar tags HTML restantes
                    .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos de línea consecutivos
                    .trim();

                logger.info(`Texto extraído de Word: ${textWithStructure.length} caracteres`, 'OpenAI-Service');
                return textWithStructure;
            } else if (extension === 'pdf') {
                // Extraer texto de PDF
                const data = await pdfParse(fileBuffer);
                logger.info(`Texto extraído de PDF: ${data.text.length} caracteres`, 'OpenAI-Service');
                return data.text;
            } else {
                throw new Error(`Tipo de archivo no soportado: ${extension}`);
            }
        } catch (error) {
            logger.error(`Error extrayendo texto: ${error.message}`, 'OpenAI-Service');
            throw new Error(`Error extrayendo texto del archivo: ${error.message}`);
        }
    }

    /**
     * Analiza un archivo TDR con OpenAI extrayendo texto CON estructura
     * MÉTODO HÍBRIDO: Extrae texto con formato pero sin imágenes, luego usa GPT-4
     * @param {string} filePath - Ruta del archivo TDR
     * @param {string} fileName - Nombre del archivo
     * @returns {Promise<Object>} - Campos extraídos del TDR
     */
    async analizarTDR(filePath, fileName) {
        try {
            logger.info(`Iniciando análisis híbrido de TDR: ${fileName}`, 'OpenAI-Service');

            // Leer el archivo
            const fileBuffer = await fs.readFile(filePath);

            // Extraer texto CON estructura del archivo
            const textoConFormato = await this.extractTextFromFile(fileBuffer, fileName);

            // Verificar que hay texto
            if (!textoConFormato || textoConFormato.trim().length === 0) {
                throw new Error('No se pudo extraer texto del archivo');
            }

            logger.info(`Texto extraído: ${textoConFormato.length} caracteres`, 'OpenAI-Service');

            // Limitar el texto si es muy largo (OpenAI context limit + TPM limit)
            let textoParaAnalisis = textoConFormato;
            const MAX_CHARS = 50000; // ~50k caracteres ≈ 12,500 tokens (límite de TPM: 30,000)

            if (textoConFormato.length > MAX_CHARS) {
                logger.info(`Texto muy largo (${textoConFormato.length} chars), truncando a ${MAX_CHARS}`, 'OpenAI-Service');
                // Extraer primeras secciones y últimas para capturar introducción y entregables
                const primeraMitad = Math.floor(MAX_CHARS * 0.7);
                const segundaMitad = MAX_CHARS - primeraMitad;

                textoParaAnalisis = textoConFormato.substring(0, primeraMitad) +
                    '\n\n[... CONTENIDO OMITIDO ...]\n\n' +
                    textoConFormato.substring(textoConFormato.length - segundaMitad);
            }

            // Analizar con GPT-4
            const resultado = await this.analizarTextoConGPT4(textoParaAnalisis);

            logger.info('Análisis completado exitosamente', 'OpenAI-Service');
            return resultado;

        } catch (error) {
            logger.error(`Error en análisis OpenAI: ${error.message}`, 'OpenAI-Service');
            throw new Error(`Error en análisis con OpenAI: ${error.message}`);
        }
    }

    /**
     * Analiza texto con GPT-4 usando Chat Completions API
     * @param {string} textoDocumento - Texto del documento a analizar
     * @returns {Promise<Object>} - Resultado del análisis
     */
    async analizarTextoConGPT4(textoDocumento) {
        try {
            logger.info('Enviando documento a GPT-4 para análisis...', 'OpenAI-Service');

            const prompt = this.crearPromptAnalisisTDR();

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4-1106-preview",
                messages: [
                    {
                        role: "system",
                        content: "Eres un experto en analizar documentos TDR (Términos de Referencia) de proyectos de infraestructura en Perú. Extraes información precisa y estructurada."
                    },
                    {
                        role: "user",
                        content: `${prompt}\n\n===== DOCUMENTO TDR =====\n\n${textoDocumento}\n\n===== FIN =====\n\nExtrae los 17 campos en formato JSON:`
                    }
                ],
                temperature: 0.1,
                max_tokens: 2500
            });

            const respuesta = completion.choices[0].message.content;
            logger.info(`Respuesta recibida de GPT-4 (${respuesta.length} chars)`, 'OpenAI-Service');

            // Parsear y retornar
            return {
                success: true,
                campos: this.parsearRespuestaJSON(respuesta),
                modelo_usado: 'gpt-4-1106-preview'
            };

        } catch (error) {
            logger.error(`Error en análisis con GPT-4: ${error.message}`, 'OpenAI-Service');
            throw error;
        }
    }

    /**
     * Crea el prompt optimizado para análisis de TDR (versión compacta para reducir tokens)
     */
    crearPromptAnalisisTDR() {
        return `Extrae estos 17 campos del TDR. Lee TODO el documento. Si no encuentras un campo, usa null.

CAMPOS:
1. nombre_proyecto: Título del proyecto
2. cui: Código Único de Inversión (números)
3. entidad_ejecutora: Municipalidad/entidad
4. numero_entregables: Cuenta TODOS los entregables (número exacto)
5. monto_referencial: Valor del contrato (solo número)
6. descripcion: Resumen del proyecto
7. ubicacion: Departamento, Provincia, Distrito
8. plazo_ejecucion: Tiempo de ejecución
9. modalidad_ejecucion: Tipo de contratación
10. tipo_proceso: Tipo de proceso
11. objetivos_generales: Objetivo principal
12. objetivos_especificos: Objetivos detallados (separar con comas)
13. alcance_servicios: Alcance
14. productos_esperados: Productos (separar con comas)
15. perfil_consultor: Perfil profesional
16. experiencia_requerida: Experiencia
17. requisitos_tecnicos: Requisitos técnicos

Responde SOLO JSON:
{"nombre_proyecto":"string o null","cui":"string o null","entidad_ejecutora":"string o null","numero_entregables":number o null,"monto_referencial":number o null,"descripcion":"string o null","ubicacion":"string o null","plazo_ejecucion":"string o null","modalidad_ejecucion":"string o null","tipo_proceso":"string o null","objetivos_generales":"string o null","objetivos_especificos":"string o null","alcance_servicios":"string o null","productos_esperados":"string o null","perfil_consultor":"string o null","experiencia_requerida":"string o null","requisitos_tecnicos":"string o null"}`;
    }

    /**
     * Parsea la respuesta JSON de OpenAI
     */
    parsearRespuestaJSON(respuesta) {
        try {
            // Buscar el JSON en la respuesta (puede venir con texto adicional)
            const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No se encontró JSON en la respuesta');
            }

            const campos = JSON.parse(jsonMatch[0]);

            // Validar que tenga los campos mínimos
            if (!campos.nombre_proyecto && !campos.cui) {
                logger.warn('Respuesta JSON no contiene campos clave', 'OpenAI-Service');
            }

            return campos;
        } catch (error) {
            logger.error(`Error parseando JSON: ${error.message}`, 'OpenAI-Service');
            logger.error(`Respuesta recibida: ${respuesta}`, 'OpenAI-Service');
            throw new Error('No se pudo parsear la respuesta de OpenAI');
        }
    }
}

module.exports = new OpenAIService();
