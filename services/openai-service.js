const OpenAI = require('openai');
const fsPromises = require('fs').promises;
const fs = require('fs');
const { jsonrepair } = require('jsonrepair');
const logger = require('../utils/logger');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // Analiza un TDR subiendo el archivo completo a Assistants API y devuelve JSON estructurado
  async analizarTDR(filePath, fileName) {
    try {
      logger.info(`Iniciando análisis con OpenAI: ${fileName}`, 'OpenAI-Service');

      // 1) Subir archivo a OpenAI (stream para Node)
      const stream = fs.createReadStream(filePath);
      const file = await this.openai.files.create({ file: stream, purpose: 'assistants' });
      logger.info(`Archivo subido a OpenAI con ID: ${file.id}`, 'OpenAI-Service');

      // 2) Crear Assistant con instrucciones (prompt)
      const assistant = await this.openai.beta.assistants.create({
        name: 'Analizador de TDR',
        instructions: this.crearPromptAnalisisTDR(),
        model: 'gpt-4-1106-preview',
        tools: [{ type: 'file_search' }]
      });
      logger.info(`Assistant creado con ID: ${assistant.id}`, 'OpenAI-Service');

      // 3) Crear Thread y adjuntar el archivo
      const thread = await this.openai.beta.threads.create({
        messages: [
          {
            role: 'user',
            content: 'Analiza este documento TDR y devuelve SOLO el JSON con la estructura solicitada.',
            attachments: [
              { file_id: file.id, tools: [{ type: 'file_search' }] }
            ]
          }
        ]
      });
      logger.info(`Thread creado con ID: ${thread.id}`, 'OpenAI-Service');

      // 4) Ejecutar el Run
      const run = await this.openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id
      });
      logger.info(`Run creado con ID: ${run.id}`, 'OpenAI-Service');

      // 5) Polling hasta completar (SDK v6: retrieve(runId, { thread_id }))
      let status = await this.openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
      while (status.status === 'queued' || status.status === 'in_progress') {
        await new Promise(r => setTimeout(r, 1500));
        status = await this.openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
        logger.info(`Estado del análisis: ${status.status}`, 'OpenAI-Service');
      }
      if (status.status !== 'completed') {
        throw new Error(`Análisis falló con estado: ${status.status}`);
      }

      // 6) Obtener la respuesta del assistant
      const messages = await this.openai.beta.threads.messages.list(thread.id);
      const first = messages.data?.[0];
      const respuesta = first?.content?.[0]?.text?.value || '';
      logger.info(`Respuesta recibida de OpenAI (${respuesta.length} chars)`, 'OpenAI-Service');

      // 7) Limpieza best-effort
      try { await (this.openai.beta.assistants.delete?.(assistant.id) || this.openai.beta.assistants.del?.(assistant.id)); } catch { }
      try { await (this.openai.files.delete?.(file.id) || this.openai.files.del?.(file.id)); } catch { }

      // 8) Parseo a objeto tipado
      return {
        success: true,
        raw: respuesta,
        campos: this.parsearRespuestaJSON(respuesta),
        modelo_usado: 'gpt-4-1106-preview-assistants'
      };
    } catch (error) {
      logger.error(`Error en análisis OpenAI: ${error.message}`, 'OpenAI-Service');
      throw new Error(`Error en análisis con OpenAI: ${error.message}`);
    }
  }

  // Prompt: estructura completa (proyecto + entregables + secciones + tipos + contenido mínimo)
  crearPromptAnalisisTDR() {
    return `Eres un analista experto en TDRs de proyectos de infraestructura en Perú.

Analiza el documento completo y devuelve **solo un JSON** con esta estructura exacta, siguiendo las relaciones entre tablas del sistema. **No incluyas comentarios, texto adicional, placeholders ni respuestas fuera del JSON. Si un dato no existe usa null o un arreglo vacío.**

{
  "proyecto": {
    "id": "uuid o generado automáticamente",
    "nombre": "string o null",
    "cui": "string o null",
    "numero_entregables": number o null,
    "descripcion": "string o null",
    "datos_extraidos": true,
    "fecha_creacion": "YYYY-MM-DD HH:mm:ss"
  },
  "tdr_entregable": [
    {
      "id": "uuid o autoincrementable",
      "proyecto_id": "referencia al id del proyecto",
      "nombre_entregable": "string",
      "created_at": "YYYY-MM-DD HH:mm:ss",
      "tdr_seccion_estudio": [
        {
          "id": "uuid o autoincrementable",
          "entregable_id": "referencia al entregable",
          "nombre": "string",
          "created_at": "YYYY-MM-DD HH:mm:ss",
          "tdr_tipo_documento": [
            {
              "id": "uuid o autoincrementable",
              "seccion_estudio_id": "referencia a la sección",
              "nombre_tipo_documento": "string",
              "created_at": "YYYY-MM-DD HH:mm:ss",
              "tdr_contenido_minimo": [
                {
                  "id": "uuid o autoincrementable",
                  "tipo_documento_id": "referencia al tipo de documento",
                  "descripcion_completa": "string o null",
                  "created_at": "YYYY-MM-DD HH:mm:ss"
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "texto_entregables_completo": "string largo con TODO el texto consecutivo desde la sección del Primer Entregable hasta la del Último Entregable, incluyendo títulos y subtítulos"
}

REGLAS DE EXTRACCIÓN:
1. **proyecto**:
   - nombre: este será el nombre del proyecto que se esta evaluando .
   - cui: número que es el Código Único de Inversión.
   - descripcion: un resumen breve del lo que trata el proyecto.
   - numero_entregables: contar la cantidad de entregables que tiene el proyecto, contar todo lo que diga "primer entregable, segundo entregable, etc.".

2. **tdr_entregable**:
   - nombre_entregable: el nombre del entregable será el número de entregables pero escrita.
3. **tdr_seccion_estudio**:
   - nombre: nombre de los estudios o informes que contiene cada entregable.
4. **tdr_tipo_documento**:
   - nombre_tipo_documento: subtítulos o subapartados dentro de cada sección de estudio o informe que contiene cada entregable.

5. **tdr_contenido_minimo**:
   - descripcion_completa: texto descriptivo de los subtitulos o subapartados de cada sección de estudio.

6. **texto_entregables_completo**:
  - Extrae texto literal y continuo que abarque exactamente desde donde inicia la sección titulada como Primer Entregable hasta donde termina la sección del Último Entregable.
  - Incluye encabezados, subtítulos, viñetas y todo el contenido interno.
  - Si el documento usa variaciones (por ejemplo: 1er Entregable, 2do, Segundo, Tercer), detecta inteligentemente los límites.

Responde SOLO el JSON con todos los niveles anidados y coherentes. Si necesitas escribir notas, deséchalas: el resultado final debe ser JSON válido.
`;
  }


  // Tolerante a variaciones: extrae JSON desde texto y normaliza estructura
  parsearRespuestaJSON(respuesta) {
    try {
      if (!respuesta) {
        throw new Error('Respuesta vacía');
      }

      const sinBloques = respuesta.replace(/```json|```/gi, '').trim();
      const sinComentarios = sinBloques
        .split('\n')
        .filter((linea) => !linea.trim().startsWith('//'))
        .join('\n');

      const inicio = sinComentarios.indexOf('{');
      const fin = sinComentarios.lastIndexOf('}');
      if (inicio === -1 || fin === -1 || fin <= inicio) {
        throw new Error('No se encontró JSON en la respuesta');
      }

      const bruto = sinComentarios.slice(inicio, fin + 1);
      const reparado = jsonrepair(bruto);
      const obj = JSON.parse(reparado);

      const proyecto = obj.proyecto || {};
      const entregables = Array.isArray(obj.tdr_entregable)
        ? obj.tdr_entregable
        : (Array.isArray(obj.entregables) ? obj.entregables : []);
      const textoEntregables = obj.texto_entregables_completo || obj.textoEntregables || null;

      const proyectoNormalizado = {
        ...proyecto,
        nombre_proyecto: proyecto.nombre_proyecto ?? proyecto.nombre ?? null,
        cui: proyecto.cui ?? proyecto.codigo ?? null,
        numero_entregables: proyecto.numero_entregables ?? proyecto.total_entregables ?? null,
        descripcion: proyecto.descripcion ?? proyecto.resumen ?? null
      };

      return {
        proyecto: proyectoNormalizado,
        tdr_entregable: entregables,
        entregables,
        texto_entregables_completo: textoEntregables
      };
    } catch (e) {
      logger.error(`Error parseando JSON: ${e.message}`, 'OpenAI-Service');
      logger.error(`Respuesta recibida: ${respuesta}`, 'OpenAI-Service');
      throw new Error('No se pudo parsear la respuesta de OpenAI');
    }
  }
}

module.exports = new OpenAIService();

