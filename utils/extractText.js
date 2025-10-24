const db = require('../db/knex');
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// *** Schema de salida que el modelo tiene que respetar
const schema = {
    type: 'object',
    required: ['entregables'],
    properties: {
        entregables: {
            type: 'array',
            items: {
                type: 'object',
                required: ['nombre_entregable', 'secciones'],
                properties: {
                    nombre_entregable: { type: 'string' },
                    plazo_dias: { type: ['integer', 'null'] },
                    secciones: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['nombre', 'orden', 'tipos_documento'],
                            properties: {
                                nombre: { type: 'string' },
                                orden: { type: 'integer' },
                                es_estudio_completo: { type: ['boolean', 'null'] },
                                tipos_documento: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        required: ['nombre_tipo_documento', 'orden', 'contenidos_minimos'],
                                        properties: {
                                            nombre_tipo_documento: { type: 'string' },
                                            orden: { type: 'integer' },
                                            contenidos_minimos: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    required: ['nombre_requisito', 'descripcion_completa', 'es_obligatorio', 'orden'],
                                                    properties: {
                                                        nombre_requisito: { type: 'string' },
                                                        descripcion_completa: { type: 'string' },
                                                        es_obligatorio: { type: 'boolean' },
                                                        orden: { type: 'integer' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

// Helper upsert genérico
function upsert(knex, table, insertData, conflictCols, mergeCols = undefined) {
    const q = knex(table).insert(insertData);
    return conflictCols?.length
        ? q.onConflict(conflictCols).merge(mergeCols || insertData)
        : q;
}

async function llamarOpenAI(textoPlanoDelTDR) {
    const resp = await client.responses.create({
        model: 'gpt-4.1-mini',             // el que uses
        input: [{
            role: 'user', content: [{
                type: 'text', text: `
Eres un extractor técnico. Devuelve SOLO JSON conforme al schema.
Tarea: Identifica ENTREGABLES -> SECCIONES -> TIPOS DE DOCUMENTO -> CONTENIDOS MÍNIMOS con sus ÓRDENES.
Texto:
${textoPlanoDelTDR}
` }]
        }],
        response_format: { type: 'json_schema', json_schema: { name: 'TDRSchema', schema } }
    });

    // adapta según tu SDK: toma el JSON resultante
    const json = JSON.parse(resp.output[0].content[0].text);
    return json;
}

async function persistirArbol({ proyectoId, arbol, trx }) {
    for (const ent of arbol.entregables) {
        const [entId] = await upsert(trx, 'tdr_entregable', {
            proyecto_id: proyectoId,
            nombre_entregable: ent.nombre_entregable,
            plazo_dias: ent.plazo_dias ?? null
        }, ['proyecto_id', 'nombre_entregable']).returning('id');

        const entregableId = typeof entId === 'object' ? entId.id : entId;

        for (const sec of ent.secciones) {
            const [secId] = await upsert(trx, 'tdr_seccion_estudio', {
                entregable_id: entregableId,
                nombre: sec.nombre,
                orden: sec.orden,
                es_estudio_completo: !!sec.es_estudio_completo
            }, ['entregable_id', 'orden']).returning('id');

            const seccionId = typeof secId === 'object' ? secId.id : secId;

            for (const td of (sec.tipos_documento || [])) {
                const [tdId] = await upsert(trx, 'tdr_tipo_documento', {
                    seccion_estudio_id: seccionId,
                    nombre_tipo_documento: td.nombre_tipo_documento,
                    orden: td.orden
                }, ['seccion_estudio_id', 'orden']).returning('id');

                const tipoDocId = typeof tdId === 'object' ? tdId.id : tdId;

                for (const cm of (td.contenidos_minimos || [])) {
                    await upsert(trx, 'tdr_contenido_minimo', {
                        tipo_documento_id: tipoDocId,
                        nombre_requisito: cm.nombre_requisito,
                        descripcion_completa: cm.descripcion_completa,
                        es_obligatorio: !!cm.es_obligatorio,
                        orden: cm.orden
                    }, ['tipo_documento_id', 'orden']);
                }
            }
        }
    }
}

async function extraerYGuardarTdr({ proyectoId, documentoId }) {
    // 1) obtener el texto del TDR (haz tu extractor PDF/DOCX; aquí se asume que ya lo tienes)
    const doc = await db('documentos').where({ id: documentoId, proyecto_id: proyectoId }).first();
    if (!doc) throw new Error('Documento no encontrado');

    const textoPlano = await require('../utils/extractText')(doc.ruta_archivo); // implementa tu extractor

    // 2) llamar a OpenAI para obtener el árbol
    const arbol = await llamarOpenAI(textoPlano);

    // 3) guardar todo en una transacción
    return await db.transaction(async trx => {
        await persistirArbol({ proyectoId, arbol, trx });
        await trx('proyecto').where({ id: proyectoId }).update({ datos_extraidos: true });
        return { ok: true, entregables: arbol.entregables.length };
    });
}

module.exports = { extraerYGuardarTdr };
