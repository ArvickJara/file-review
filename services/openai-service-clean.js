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

            // Limitar el texto si es muy largo (OpenAI context limit)
            let textoParaAnalisis = textoConFormato;
            const MAX_CHARS = 120000; // ~120k caracteres para dejar margen

            if (textoConFormato.length > MAX_CHARS) {
                logger.info(`Texto muy largo (${textoConFormato.length} chars), truncando a ${MAX_CHARS}`, 'OpenAI-Service');
                textoParaAnalisis = textoConFormato.substring(0, MAX_CHARS);
            }

            // Usar chat completions con el texto estructurado
            const resultado = await this.analizarTextoConGPT4(textoParaAnalisis);

            logger.info(`Análisis completado exitosamente para: ${fileName}`, 'OpenAI-Service');
            return resultado;

        } catch (error) {
            logger.error(`Error en análisis OpenAI: ${error.message}`, 'OpenAI-Service');
            throw new Error(`Error en análisis con OpenAI: ${error.message}`);
        }
    }

    /**
     * Analiza texto con GPT-4 usando chat completions
     * @param {string} textoDocumento - Texto del documento a analizar
     * @returns {Promise<Object>} - Resultado del análisis
     */
    async analizarTextoConGPT4(textoDocumento) {
        try {
            const prompt = this.crearPromptAnalisisTDR();

            logger.info('Enviando documento a GPT-4 para análisis...', 'OpenAI-Service');

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4-1106-preview",
                messages: [
                    {
                        role: "system",
                        content: "Eres un experto analizador de TDR. Lee el documento COMPLETO y extrae TODA la información solicitada. Responde ÚNICAMENTE con JSON válido, sin texto adicional."
                    },
                    {
                        role: "user",
                        content: `${prompt}\n\n===== DOCUMENTO TDR A ANALIZAR =====\n\n${textoDocumento}\n\n===== FIN DEL DOCUMENTO =====\n\nAhora extrae los campos en formato JSON:`
                    }
                ],
                temperature: 0.1, // Baja temperatura para mayor precisión
                max_tokens: 2500  // Suficiente para el JSON de respuesta
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
     * Crea el prompt optimizado para análisis de TDR
     */
    crearPromptAnalisisTDR() {
        return `
INSTRUCCIONES CRÍTICAS: Lee TODO el documento TDR completo antes de responder. No te detengas en las primeras páginas.

Eres un experto analizador de Términos de Referencia (TDR) para proyectos de infraestructura en Perú.

CAMPOS OBLIGATORIOS A EXTRAER (busca exhaustivamente en TODO el documento):

1. **nombre_proyecto**: Busca el nombre completo del proyecto. Puede estar en:
   - Título del documento
   - Sección "NOMBRE DEL PROYECTO" 
   - Encabezado
   - Primera página
   
2. **cui**: Código Único de Inversión. Busca:
   - Formato: números con o sin guiones (ej: 2435979, 243-5979)
   - Puede aparecer como "CUI:", "Código:", "Código SNIP:"
   - Suele estar cerca del nombre del proyecto
   
3. **entidad_ejecutora**: Nombre de la entidad/municipalidad. Busca:
   - "Entidad ejecutora:"
   - Nombres de municipalidades, gobiernos regionales
   - Al inicio del documento o en datos generales
   
4. **numero_entregables**: Cuenta TODOS los entregables mencionados. Busca en:
   - Sección "PRODUCTOS" o "ENTREGABLES"
   - Tabla de entregables
   - Lista numerada de productos
   - Cronograma de entregables
   
5. **monto_referencial**: Valor del contrato en soles. Busca:
   - "Valor referencial:", "Monto:", "Presupuesto:"
   - Puede incluir decimales
   - Solo el número, sin "S/", sin comas
   
6. **descripcion**: Resumen del proyecto. Busca en:
   - Sección "ANTECEDENTES"
   - "DESCRIPCIÓN DEL PROYECTO"
   - Primeras páginas del documento
   
7. **ubicacion**: Ubicación geográfica completa:
   - Departamento, Provincia, Distrito
   - Dirección específica si está disponible
   
8. **plazo_ejecucion**: Tiempo de ejecución:
   - "Plazo:", "Duración:", "Tiempo de ejecución:"
   - En días, meses o fecha específica
   
9. **modalidad_ejecucion**: Tipo de contratación:
   - Suma alzada, tarifas, precios unitarios
   - Contratación directa, licitación, etc.
   
10. **tipo_proceso**: Tipo de proceso:
    - Adjudicación simplificada, licitación pública, etc.

CAMPOS ADICIONALES DEL TDR:
11. **objetivos_generales**: Objetivo principal del TDR
12. **objetivos_especificos**: Objetivos detallados (separados por comas)
13. **alcance_servicios**: Descripción del alcance
14. **productos_esperados**: Lista de productos (separados por comas)
15. **perfil_consultor**: Perfil profesional requerido
16. **experiencia_requerida**: Años y tipo de experiencia
17. **requisitos_tecnicos**: Requisitos técnicos específicos

INSTRUCCIONES CRÍTICAS:
- Lee el documento COMPLETO, no solo las primeras páginas
- Busca sinónimos y variaciones de los campos
- Si encuentras información parcial, inclúyela
- NO inventes información que no esté en el documento
- Si un campo NO está en el documento, usa null
- Para números: solo el valor numérico (sin símbolos, sin texto)
- Para listas: separa con comas

FORMATO DE RESPUESTA - SOLO JSON (sin texto adicional):

{
    "nombre_proyecto": "string o null",
    "cui": "string o null",
    "entidad_ejecutora": "string o null",
    "numero_entregables": number o null,
    "monto_referencial": number o null,
    "descripcion": "string o null",
    "ubicacion": "string o null",
    "plazo_ejecucion": "string o null",
    "modalidad_ejecucion": "string o null",
    "tipo_proceso": "string o null",
    "objetivos_generales": "string o null",
    "objetivos_especificos": "string o null",
    "alcance_servicios": "string o null",
    "productos_esperados": "string o null",
    "perfil_consultor": "string o null",
    "experiencia_requerida": "string o null",
    "requisitos_tecnicos": "string o null"
}

RESPONDE SOLO CON EL JSON. NO agregues explicaciones, comentarios ni texto adicional.
        `.trim();
    }

    /**
     * Parsea la respuesta de OpenAI para extraer el JSON
     */
    parsearRespuestaJSON(respuesta) {
        try {
            // Buscar JSON en la respuesta
            const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No se encontró JSON válido en la respuesta');
            }
        } catch (error) {
            logger.error(`Error parseando respuesta JSON: ${error.message}`, 'OpenAI-Service');
            logger.error(`Respuesta recibida: ${respuesta}`, 'OpenAI-Service');
            throw new Error('Error parseando respuesta de OpenAI');
        }
    }
}

module.exports = new OpenAIService();
