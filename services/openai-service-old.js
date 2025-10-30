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
                    .replace(/<h\d[^>]*>/gi, '\n**')
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
                    .replace(/<table[^>]*>/gi, '\nTABLA:\n')
                    .replace(/<\/table>/gi, '\n')
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
     * MÉTODO DEFINITIVO: Extrae texto con formato pero sin imágenes
     * @param {string} filePath - Ruta del archivo TDR
     * @param {string} fileName - Nombre del archivo
     * @returns {Promise<Object>} - Campos extraídos del TDR
     */
    async analizarTDR(filePath, fileName) {
        try {
            logger.info(`Iniciando análisis de TDR: ${fileName}`, 'OpenAI-Service');

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
     * MÉTODO DEPRECADO - Usa archivo completo (falla con archivos grandes)
     * @deprecated Usar analizarTDR() en su lugar
     */
    async analizarTDRConArchivoCompleto(filePath, fileName) {
        try {
            logger.info(`Iniciando análisis de TDR con archivo completo: ${fileName}`, 'OpenAI-Service');

    /**
     * Analiza un archivo TDR COMPLETO con OpenAI usando file upload
     * Este método sube el archivo completo para que ChatGPT lo vea con formato
     * @param {string} filePath - Ruta del archivo TDR
     * @param {string} fileName - Nombre del archivo
     * @returns {Promise<Object>} - Campos extraídos del TDR
     */
    async analizarTDR(filePath, fileName) {
        try {
            logger.info(`Iniciando análisis de TDR con archivo completo: ${fileName}`, 'OpenAI-Service');

            // Leer el archivo
            const fileBuffer = await fs.readFile(filePath);
            
            // Subir archivo a OpenAI para análisis
            logger.info(`Subiendo archivo ${fileName} a OpenAI...`, 'OpenAI-Service');
            
            const file = await this.openai.files.create({
                file: fileBuffer,
                purpose: "assistants"
            });

            logger.info(`Archivo subido con ID: ${file.id}`, 'OpenAI-Service');

            // Crear thread con el archivo
            const thread = await this.openai.beta.threads.create({
                messages: [
                    {
                        role: "user",
                        content: `Analiza este documento TDR (Términos de Referencia) y extrae TODA la información solicitada. El documento está completo, revísalo cuidadosamente.`,
                        file_ids: [file.id]
                    }
                ]
            });

            // Crear un run con instrucciones específicas
            const run = await this.openai.beta.threads.runs.create(thread.id, {
                assistant_id: await this.getOrCreateAssistant(),
                additional_instructions: this.crearPromptAnalisisTDR()
            });

            // Esperar a que termine el análisis
            let runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
            let attempts = 0;
            const maxAttempts = 60; // 60 segundos máximo

            while ((runStatus.status === 'queued' || runStatus.status === 'in_progress') && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
                runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
                attempts++;
                logger.info(`Estado del análisis: ${runStatus.status} (${attempts}/${maxAttempts})`, 'OpenAI-Service');
            }

            if (runStatus.status === 'completed') {
                // Obtener la respuesta
                const messages = await this.openai.beta.threads.messages.list(thread.id);
                const lastMessage = messages.data.find(msg => msg.role === 'assistant');
                
                if (!lastMessage) {
                    throw new Error('No se recibió respuesta del asistente');
                }

                const responseText = lastMessage.content[0].text.value;
                logger.info(`Respuesta recibida: ${responseText.substring(0, 200)}...`, 'OpenAI-Service');

                // Parsear la respuesta JSON
                const camposExtraidos = this.parsearRespuestaJSON(responseText);

                // Limpiar recursos
                try {
                    await this.openai.files.del(file.id);
                    logger.info(`Archivo ${file.id} eliminado`, 'OpenAI-Service');
                } catch (deleteError) {
                    logger.error(`Error eliminando archivo: ${deleteError.message}`, 'OpenAI-Service');
                }

                logger.info(`Análisis completado exitosamente para: ${fileName}`, 'OpenAI-Service');
                return {
                    success: true,
                    campos: camposExtraidos,
                    modelo_usado: 'gpt-4-1106-preview'
                };

            } else if (runStatus.status === 'failed') {
                throw new Error(`Análisis falló: ${runStatus.last_error?.message || 'Error desconocido'}`);
            } else {
                throw new Error(`Análisis terminó con estado: ${runStatus.status}`);
            }

        } catch (error) {
            logger.error(`Error en análisis OpenAI: ${error.message}`, 'OpenAI-Service');
            throw new Error(`Error en análisis con OpenAI: ${error.message}`);
        }
    }

    /**
     * Obtiene o crea el asistente para análisis de TDR
     * @returns {Promise<string>} - ID del asistente
     */
    async getOrCreateAssistant() {
        try {
            // Si existe un ID en variables de entorno, usarlo
            if (process.env.OPENAI_TDR_ASSISTANT_ID && process.env.OPENAI_TDR_ASSISTANT_ID !== 'abc123') {
                return process.env.OPENAI_TDR_ASSISTANT_ID;
            }

            // Crear nuevo asistente
            logger.info('Creando nuevo asistente de análisis TDR', 'OpenAI-Service');
            const assistant = await this.openai.beta.assistants.create({
                name: "Analizador de TDR v2",
                instructions: "Eres un experto en análisis de Términos de Referencia (TDR) para proyectos de infraestructura en Perú. Tu tarea es extraer información específica de documentos TDR con precisión absoluta.",
                model: "gpt-4-1106-preview",
                tools: [{ type: "retrieval" }]
            });

            logger.info(`Asistente creado con ID: ${assistant.id}`, 'OpenAI-Service');
            return assistant.id;

        } catch (error) {
            logger.error(`Error creando asistente: ${error.message}`, 'OpenAI-Service');
            throw error;
        }
    }

    /**
     * Analiza un archivo TDR extrayendo texto primero (método de respaldo)
     * @param {string} filePath - Ruta del archivo TDR
     * @param {string} fileName - Nombre del archivo
     * @returns {Promise<Object>} - Campos extraídos del TDR
     */
    async analizarTDRConTexto(filePath, fileName) {
        try {
            logger.info(`Iniciando análisis de TDR con extracción de texto: ${fileName}`, 'OpenAI-Service');

            // Leer el archivo
            const fileBuffer = await fs.readFile(filePath);

            // Extraer texto del archivo
            const textoExtraido = await this.extractTextFromFile(fileBuffer, fileName);

            // Verificar que hay texto
            if (!textoExtraido || textoExtraido.trim().length === 0) {
                throw new Error('No se pudo extraer texto del archivo');
            }

            // Limitar el texto si es muy largo (max ~100k caracteres)
            let textoParaAnalisis = textoExtraido;
            if (textoExtraido.length > 100000) {
                logger.info(`Texto muy largo (${textoExtraido.length} chars), truncando a 100k`, 'OpenAI-Service');
                textoParaAnalisis = textoExtraido.substring(0, 100000);
            }

            // Usar el método simple con el texto extraído
            const resultado = await this.analizarTDRSimple(textoParaAnalisis);

            logger.info(`Análisis completado exitosamente para: ${fileName}`, 'OpenAI-Service');
            return resultado;

        } catch (error) {
            logger.error(`Error en análisis OpenAI: ${error.message}`, 'OpenAI-Service');
            throw new Error(`Error en análisis con OpenAI: ${error.message}`);
        }
    }

    /**
     * Analiza un archivo TDR con OpenAI para extraer campos del proyecto
     * MÉTODO ANTIGUO CON ASSISTANTS API (MÁS PESADO - NO USAR)
     * @param {string} filePath - Ruta del archivo TDR
     * @param {string} fileName - Nombre del archivo
     * @returns {Promise<Object>} - Campos extraídos del TDR
     */
    async analizarTDRConAssistants(filePath, fileName) {
        try {
            logger.info(`Iniciando análisis de TDR con Assistants: ${fileName}`, 'OpenAI-Service');

            // Leer el archivo
            const fileBuffer = await fs.readFile(filePath);

            // Crear el archivo en OpenAI
            const file = await this.openai.files.create({
                file: fileBuffer,
                purpose: 'assistants'
            });

            // Crear el prompt para análisis del TDR
            const prompt = this.crearPromptAnalisisTDR();

            // Crear asistente para análisis
            const assistant = await this.openai.beta.assistants.create({
                name: "Analizador de TDR",
                instructions: prompt,
                tools: [{ type: "code_interpreter" }],
                model: "gpt-4-1106-preview",
                file_ids: [file.id]
            });

            // Crear thread
            const thread = await this.openai.beta.threads.create();

            // Crear mensaje con la solicitud de análisis
            await this.openai.beta.threads.messages.create(thread.id, {
                role: "user",
                content: `Por favor analiza el archivo TDR adjunto "${fileName}" y extrae los campos solicitados en formato JSON.`,
                file_ids: [file.id]
            });

            // Ejecutar el análisis
            const run = await this.openai.beta.threads.runs.create(thread.id, {
                assistant_id: assistant.id
            });

            // Esperar a que termine
            let runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);

            while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
                await new Promise(resolve => setTimeout(resolve, 1000));
                runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
            }

            if (runStatus.status === 'completed') {
                // Obtener mensajes
                const messages = await this.openai.beta.threads.messages.list(thread.id);
                const responseMessage = messages.data[0].content[0].text.value;

                // Parsear respuesta JSON
                const camposExtraidos = this.parsearRespuestaJSON(responseMessage);

                // Limpiar recursos
                await this.openai.files.del(file.id);
                await this.openai.beta.assistants.del(assistant.id);

                logger.info(`Análisis completado exitosamente para: ${fileName}`, 'OpenAI-Service');
                return {
                    success: true,
                    campos: camposExtraidos,
                    modelo_usado: 'gpt-4-1106-preview'
                };

            } else {
                throw new Error(`Análisis falló con estado: ${runStatus.status}`);
            }

        } catch (error) {
            logger.error(`Error en análisis OpenAI: ${error.message}`, 'OpenAI-Service');
            throw new Error(`Error en análisis con OpenAI: ${error.message}`);
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
            throw new Error('Error parseando respuesta de OpenAI');
        }
    }

    /**
     * Analiza un documento usando el modelo simple de completions
     * (método alternativo más directo)
     */
    async analizarTDRSimple(contenidoTexto) {
        try {
            const prompt = `${this.crearPromptAnalisisTDR()}

DOCUMENTO A ANALIZAR:
${contenidoTexto}

Responde con el JSON solicitado:`;

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4-1106-preview",
                messages: [
                    {
                        role: "system",
                        content: "Eres un experto analizador de TDR. Responde ÚNICAMENTE con JSON válido."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 2000
            });

            const respuesta = completion.choices[0].message.content;
            return {
                success: true,
                campos: this.parsearRespuestaJSON(respuesta),
                modelo_usado: 'gpt-4-1106-preview'
            };

        } catch (error) {
            logger.error(`Error en análisis simple OpenAI: ${error.message}`, 'OpenAI-Service');
            throw new Error(`Error en análisis con OpenAI: ${error.message}`);
        }
    }
}

module.exports = new OpenAIService();
