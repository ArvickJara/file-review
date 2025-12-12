const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const db = require('../db/knex');
const logger = require('../utils/logger');
const { upload } = require('../middleware/parseBody');

const MAX_TOMOS_PER_BATCH = 20;
const PUBLIC_UPLOAD_PREFIX = '/public/uploads';

const mapDocumento = (documento) => {
    const tipo = documento.tipo_documento || (documento.orden === 0 ? 'tdr' : 'tomo');
    const orden = documento.orden ?? (tipo === 'tdr' ? 0 : null);

    return {
        ...documento,
        tipo_documento: tipo,
        orden,
        nombre: documento.nombre_archivo,
        url_publica: documento.ruta_archivo ? `${PUBLIC_UPLOAD_PREFIX}/${documento.ruta_archivo}` : null
    };
};

const deleteUploadedFiles = async (files = []) => {
    await Promise.all(files.map(async (file) => {
        if (!file?.path) return;
        try {
            await fs.unlink(file.path);
        } catch (err) {
            logger.warn(`No se pudo eliminar archivo cargado ${file.path}: ${err.message}`, 'ExpedientesDocs');
        }
    }));
};

// GET /api/expedientes_tecnicos/tdrs/:proyectoId
// Devuelve la estructura completa del TDR (entregables -> secciones -> tipos -> contenido mínimo)
router.get('/tdrs/:proyectoId', async (req, res) => {
    try {
        const { proyectoId } = req.params;

        // 1) Proyecto
        const proyecto = await db('proyecto').where('id', proyectoId).first();
        if (!proyecto) {
            return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
        }

        // 2) Entregables
        const entregables = await db('tdr_entregable')
            .where({ proyecto_id: proyectoId })
            .select('*');

        if (entregables.length === 0) {
            return res.status(200).json({
                success: true,
                proyecto: {
                    id: proyecto.id,
                    nombre: proyecto.nombre,
                    cui: proyecto.cui,
                    numero_entregables: proyecto.numero_entregables,
                    descripcion: proyecto.descripcion,
                    fecha_creacion: proyecto.fecha_creacion,
                },
                entregables: []
            });
        }

        const entregableIds = entregables.map(e => e.id);

        // 3) Secciones
        const secciones = await db('tdr_seccion_estudio')
            .whereIn('entregable_id', entregableIds)
            .select('*');

        const seccionIds = secciones.map(s => s.id);

        // 4) Tipos de documento
        const tipos = seccionIds.length > 0
            ? await db('tdr_tipo_documento').whereIn('seccion_estudio_id', seccionIds).select('*')
            : [];

        const tipoIds = tipos.map(t => t.id);

        // 5) Contenido mínimo
        const contenidos = tipoIds.length > 0
            ? await db('tdr_contenido_minimo').whereIn('tipo_documento_id', tipoIds).select('*')
            : [];

        // Armado jerárquico
        const contenidosPorTipo = contenidos.reduce((acc, c) => {
            (acc[c.tipo_documento_id] = acc[c.tipo_documento_id] || []).push({
                id: c.id,
                nombre_requisito: c.nombre_requisito,
                descripcion_completa: c.descripcion_completa,
                es_obligatorio: !!c.es_obligatorio,
                orden: c.orden,
                created_at: c.created_at
            });
            return acc;
        }, {});

        const tiposPorSeccion = tipos.reduce((acc, t) => {
            (acc[t.seccion_estudio_id] = acc[t.seccion_estudio_id] || []).push({
                id: t.id,
                nombre_tipo_documento: t.nombre_tipo_documento,
                orden: t.orden,
                created_at: t.created_at,
                contenido_minimo: contenidosPorTipo[t.id] || []
            });
            return acc;
        }, {});

        const seccionesPorEntregable = secciones.reduce((acc, s) => {
            (acc[s.entregable_id] = acc[s.entregable_id] || []).push({
                id: s.id,
                nombre: s.nombre,
                orden: s.orden,
                es_estudio_completo: !!s.es_estudio_completo,
                created_at: s.created_at,
                tipos_documento: tiposPorSeccion[s.id] || []
            });
            return acc;
        }, {});

        const entregablesConJerarquia = entregables.map(e => ({
            id: e.id,
            nombre_entregable: e.nombre_entregable,
            plazo_dias: e.plazo_dias,
            porcentaje_pago: e.porcentaje_pago,
            created_at: e.created_at,
            secciones_estudio: seccionesPorEntregable[e.id] || []
        }));

        // Buscar el documento TDR del proyecto
        const tdrDocumento = await db('documentos')
            .where({
                proyecto_id: proyectoId,
                tipo_documento: 'tdr'
            })
            .orWhere(function () {
                this.where('proyecto_id', proyectoId)
                    .andWhere('orden', 0);
            })
            .orderBy('fecha_subida', 'desc')
            .first();

        return res.status(200).json({
            success: true,
            proyecto: {
                id: proyecto.id,
                nombre: proyecto.nombre,
                cui: proyecto.cui,
                numero_entregables: proyecto.numero_entregables,
                descripcion: proyecto.descripcion,
                fecha_creacion: proyecto.fecha_creacion,
            },
            entregables: entregablesConJerarquia,
            tdrs: entregablesConJerarquia,
            tdr_documento: tdrDocumento || null
        });

    } catch (error) {
        logger.error(`Error obteniendo TDRs del proyecto: ${error.message}`, 'ExpedientesTDR');
        return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
});

// GET /api/expedientes_tecnicos/documentos/:proyectoId
// Lista los documentos asociados a un proyecto
router.get('/documentos/:proyectoId', async (req, res) => {
    try {
        const { proyectoId } = req.params;

        const proyecto = await db('proyecto').where('id', proyectoId).first();
        if (!proyecto) {
            return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
        }

        const documentos = await db('documentos')
            .where({ proyecto_id: proyectoId })
            .orderBy('orden', 'asc')
            .orderBy('fecha_subida', 'desc')
            .select('*');

        return res.status(200).json({ success: true, documentos: documentos.map(mapDocumento) });
    } catch (error) {
        logger.error(`Error listando documentos del proyecto: ${error.message}`, 'ExpedientesDocs');
        return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
});

// GET /api/expedientes_tecnicos/documento/:documentoId/download
// Descarga el archivo PDF de un documento específico
router.get('/documento/:documentoId/download', async (req, res) => {
    try {
        const { documentoId } = req.params;

        const documento = await db('documentos').where({ id: documentoId }).first();
        if (!documento) {
            return res.status(404).json({ success: false, message: 'Documento no encontrado' });
        }

        if (!documento.ruta_archivo) {
            return res.status(404).json({ success: false, message: 'El documento no tiene archivo asociado' });
        }

        const absolutePath = path.join(__dirname, '..', 'public', 'uploads', documento.ruta_archivo);

        // Verificar que el archivo existe
        try {
            await fs.access(absolutePath);
        } catch (err) {
            logger.error(`Archivo no encontrado: ${absolutePath}`, 'ExpedientesDocs');
            return res.status(404).json({ success: false, message: 'Archivo no encontrado en el servidor' });
        }

        // Enviar el archivo
        res.download(absolutePath, documento.nombre_archivo || 'documento.pdf', (err) => {
            if (err) {
                logger.error(`Error al descargar archivo: ${err.message}`, 'ExpedientesDocs');
                if (!res.headersSent) {
                    res.status(500).json({ success: false, message: 'Error al descargar archivo' });
                }
            }
        });
    } catch (error) {
        logger.error(`Error descargando documento: ${error.message}`, 'ExpedientesDocs');
        return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
});

// POST /api/expedientes_tecnicos/documento/:documentoId/verificar-rpa
// Verifica hojas en blanco y legibilidad usando el RPA de Python
router.post('/documento/:documentoId/verificar-rpa', async (req, res) => {
    try {
        const { documentoId } = req.params;

        const documento = await db('documentos').where({ id: documentoId }).first();
        if (!documento) {
            return res.status(404).json({ success: false, message: 'Documento no encontrado' });
        }

        if (!documento.ruta_archivo) {
            return res.status(404).json({ success: false, message: 'El documento no tiene archivo asociado' });
        }

        const absolutePath = path.join(__dirname, '..', 'public', 'uploads', documento.ruta_archivo);

        // Verificar que el archivo existe
        try {
            await fs.access(absolutePath);
        } catch (err) {
            logger.error(`Archivo no encontrado: ${absolutePath}`, 'ExpedientesDocs');
            return res.status(404).json({ success: false, message: 'Archivo no encontrado en el servidor' });
        }

        // Llamar al RPA de Python
        const { spawn } = require('child_process');
        const rpaPath = path.join(__dirname, '..', '..', 'Admisibilidad');

        // Usar el Python del entorno virtual si existe
        const pythonExe = path.join(rpaPath, 'env', 'Scripts', 'python.exe');
        const pythonCmd = require('fs').existsSync(pythonExe) ? pythonExe : 'python';

        logger.info(`Ejecutando RPA para documento: ${documento.nombre_archivo}`, 'ExpedientesDocs');
        logger.info(`Python ejecutable: ${pythonCmd}`, 'ExpedientesDocs');
        logger.info(`Archivo PDF: ${absolutePath}`, 'ExpedientesDocs');

        const pythonCode = `
import sys
import os
import json
from dataclasses import asdict
from datetime import datetime
sys.path.insert(0, '${rpaPath.replace(/\\/g, '/')}' + '/src')

try:
    from verificador_admisibilidad import VerificadorAdmisibilidad
    
    # Crear verificador
    verificador = VerificadorAdmisibilidad('${absolutePath.replace(/\\/g, '/')}')
    
    # Cargar documento
    if not verificador._cargar_documento():
        resultado = verificador._generar_resultado_error()
    else:
        # Ejecutar SOLO las verificaciones necesarias:
        # 1. Hojas en blanco
        # 2. Legibilidad
        print("Iniciando verificacion de: ${absolutePath.replace(/\\/g, '/')}")
        print(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        verificador._verificar_hojas_blanco()
        verificador._verificar_ilegibilidad()
        
        # Preparar resultados
        resultado = verificador._preparar_resultados()
    
    # Convertir dataclasses a dict para JSON
    if 'resultados' in resultado:
        resultado['resultados'] = [asdict(r) for r in resultado['resultados']]
    
    print(json.dumps(resultado, ensure_ascii=False))
except Exception as e:
    import traceback
    error_info = {
        'error': str(e),
        'traceback': traceback.format_exc(),
        'tipo': type(e).__name__
    }
    print(json.dumps(error_info, ensure_ascii=False))
    sys.exit(1)
`;

        const python = spawn(pythonCmd, ['-c', pythonCode]);

        let outputData = '';
        let errorData = '';

        python.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        python.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        python.on('close', (code) => {
            logger.info(`Proceso Python finalizado con código: ${code}`, 'ExpedientesDocs');
            logger.info(`Output completo: ${outputData}`, 'ExpedientesDocs');
            logger.info(`Errores: ${errorData}`, 'ExpedientesDocs');

            if (code !== 0) {
                logger.error(`Error en RPA (código ${code}): ${errorData}`, 'ExpedientesDocs');

                // Intentar parsear el error como JSON
                try {
                    const errorJson = JSON.parse(outputData.trim().split('\n').pop());
                    if (errorJson.error) {
                        return res.status(500).json({
                            success: false,
                            message: 'Error al ejecutar verificación RPA',
                            error: errorJson.error,
                            traceback: errorJson.traceback,
                            tipo: errorJson.tipo
                        });
                    }
                } catch (e) {
                    // Si no es JSON, devolver el error tal cual
                }

                return res.status(500).json({
                    success: false,
                    message: 'Error al ejecutar verificación RPA',
                    error: errorData,
                    output: outputData
                });
            }

            try {
                // Extraer solo el JSON del output (última línea)
                const lines = outputData.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                const resultado = JSON.parse(jsonLine);

                // Verificar si hay error en el resultado
                if (resultado.error) {
                    logger.error(`Error en verificación RPA: ${resultado.error}`, 'ExpedientesDocs');
                    return res.status(500).json({
                        success: false,
                        message: 'Error en verificación RPA',
                        error: resultado.error,
                        traceback: resultado.traceback
                    });
                }

                return res.status(200).json({
                    success: true,
                    documento: documento.nombre_archivo,
                    resultado: resultado
                });
            } catch (parseError) {
                logger.error(`Error al parsear resultado RPA: ${parseError.message}`, 'ExpedientesDocs');
                logger.error(`Output recibido: ${outputData}`, 'ExpedientesDocs');
                return res.status(500).json({
                    success: false,
                    message: 'Error al procesar resultado de verificación',
                    parseError: parseError.message,
                    output: outputData
                });
            }
        });

    } catch (error) {
        logger.error(`Error en verificación RPA: ${error.message}`, 'ExpedientesDocs');
        return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
});

// DELETE /api/expedientes_tecnicos/documentos/:documentoId
// Permite eliminar un entregable/TDR específico
router.delete('/documentos/:documentoId', async (req, res) => {
    try {
        const { documentoId } = req.params;

        const documento = await db('documentos').where({ id: documentoId }).first();
        if (!documento) {
            return res.status(404).json({ success: false, message: 'Documento no encontrado' });
        }

        await db('documentos').where({ id: documentoId }).del();

        if (documento.ruta_archivo) {
            const absolutePath = path.join(__dirname, '..', 'public', 'uploads', documento.ruta_archivo);
            try {
                await fs.unlink(absolutePath);
            } catch (err) {
                logger.warn(`No se pudo eliminar archivo físico ${absolutePath}: ${err.message}`, 'ExpedientesDocs');
            }
        }

        return res.status(200).json({ success: true, message: 'Documento eliminado correctamente' });
    } catch (error) {
        logger.error(`Error eliminando documento: ${error.message}`, 'ExpedientesDocs');
        return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
});

// POST /api/expedientes_tecnicos/evaluar-expediente
// Por ahora almacena los tomos y aplica validaciones de límite por entregables
router.post('/evaluar-expediente', (req, res) => {
    const tomoUpload = upload.array('tomos', MAX_TOMOS_PER_BATCH);
    tomoUpload(req, res, async (err) => {
        if (err) {
            logger.error(`Error subiendo tomos: ${err.message}`, 'ExpedientesDocs');
            return res.status(400).json({ success: false, message: err.message || 'Error subiendo tomos' });
        }

        const { proyecto_id, tdrId } = req.body;
        const files = req.files || [];

        if (!proyecto_id) {
            await deleteUploadedFiles(files);
            return res.status(400).json({ success: false, message: 'proyecto_id es requerido' });
        }

        if (!files.length) {
            return res.status(400).json({ success: false, message: 'Debes adjuntar al menos un tomo en PDF' });
        }

        const nonPdfFiles = files.filter((file) => file.mimetype !== 'application/pdf');
        if (nonPdfFiles.length > 0) {
            await deleteUploadedFiles(files);
            return res.status(400).json({ success: false, message: 'Los tomos deben ser archivos PDF escaneados' });
        }

        try {
            const proyecto = await db('proyecto').where('id', proyecto_id).first();
            if (!proyecto) {
                await deleteUploadedFiles(files);
                return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
            }

            const numeroEntregables = Number(proyecto.numero_entregables) || 0;
            if (numeroEntregables <= 0) {
                await deleteUploadedFiles(files);
                return res.status(400).json({ success: false, message: 'El proyecto no tiene número de entregables definido' });
            }

            if (tdrId) {
                const tdrDocumento = await db('documentos').where({ id: tdrId, proyecto_id, tipo_documento: 'tdr' }).first();
                if (!tdrDocumento) {
                    await deleteUploadedFiles(files);
                    return res.status(400).json({ success: false, message: 'El TDR seleccionado no pertenece al proyecto' });
                }
            }

            const existingTomosRows = await db('documentos')
                .where({ proyecto_id, tipo_documento: 'tomo' })
                .select('id', 'orden')
                .orderBy('orden', 'asc');
            const existingTomos = existingTomosRows.length;

            if (existingTomos >= numeroEntregables) {
                await deleteUploadedFiles(files);
                return res.status(400).json({
                    success: false,
                    message: 'Ya registraste el número máximo de tomos permitido por el TDR'
                });
            }

            const remainingSlots = numeroEntregables - existingTomos;
            if (files.length > remainingSlots) {
                await deleteUploadedFiles(files);
                return res.status(400).json({
                    success: false,
                    message: `Solo puedes subir ${remainingSlots} tomo(s) adicionales. El TDR exige ${numeroEntregables} entregables.`
                });
            }

            const now = Date.now();
            const usedOrders = new Set(
                existingTomosRows
                    .map((row) => Number(row.orden))
                    .filter((orden) => Number.isFinite(orden) && orden > 0)
            );

            const availableOrders = [];
            for (let i = 1; i <= numeroEntregables; i += 1) {
                if (!usedOrders.has(i)) {
                    availableOrders.push(i);
                }
            }

            const documentosToInsert = files.map((file, index) => ({
                id: `${now}-${index}-${Math.floor(Math.random() * 1e6)}`,
                proyecto_id,
                nombre_archivo: file.originalname,
                ruta_archivo: file.filename,
                estado: 'registrado',
                tipo_documento: 'tomo',
                orden: availableOrders[index] ?? (existingTomos + index + 1)
            }));

            await db('documentos').insert(documentosToInsert);

            const resumen = {
                total_tomos: numeroEntregables,
                tomos_procesados_exitosamente: documentosToInsert.length,
                tomos_con_errores: 0
            };

            return res.status(200).json({
                success: true,
                message: `Se registraron ${documentosToInsert.length} tomo(s). Restan ${numeroEntregables - (existingTomos + documentosToInsert.length)} por cargar.`,
                resumen,
                documentos: documentosToInsert.map(mapDocumento)
            });
        } catch (error) {
            logger.error(`Error guardando tomos: ${error.message}`, 'ExpedientesDocs');
            await deleteUploadedFiles(files);
            return res.status(500).json({ success: false, message: 'Error interno al registrar tomos', error: error.message });
        }
    });
});

// POST /api/expedientes_tecnicos/revisar-admisibilidad
// Convierte PDF del entregable a imágenes y consulta la API Python para OCR
router.post('/revisar-admisibilidad', async (req, res) => {
    try {
        const { documento_id, proyecto_id, tdr_id, orden } = req.body;

        if (!documento_id) {
            return res.status(400).json({ success: false, message: 'documento_id es requerido' });
        }

        // 1. Obtener documento de la BD
        const documento = await db('documentos').where({ id: documento_id }).first();
        if (!documento) {
            return res.status(404).json({ success: false, message: 'Documento no encontrado' });
        }

        // 2. Construir ruta absoluta del archivo PDF
        const pdfPath = path.join(__dirname, '..', 'public', 'uploads', documento.ruta_archivo);

        // Verificar que el archivo existe
        try {
            await fs.access(pdfPath);
        } catch (err) {
            logger.error(`Archivo no encontrado: ${pdfPath}`, 'RevisionAdmisibilidad');
            return res.status(404).json({ success: false, message: 'Archivo PDF no encontrado en el servidor' });
        }

        // 3. Convertir PDF a imágenes usando pdf-poppler o similar
        const { convertPdfToImages } = require('../utils/pdfConverter');
        let imagePaths = [];

        try {
            imagePaths = await convertPdfToImages(pdfPath);
            logger.info(`PDF convertido a ${imagePaths.length} imagen(es)`, 'RevisionAdmisibilidad');
        } catch (conversionError) {
            logger.error(`Error convirtiendo PDF: ${conversionError.message}`, 'RevisionAdmisibilidad');
            return res.status(500).json({
                success: false,
                message: 'Error convirtiendo PDF a imágenes',
                error: conversionError.message
            });
        }

        // 4. Consultar API Python con las imágenes
        const FormData = require('form-data');
        const fetch = require('node-fetch');

        const pythonApiUrl = process.env.PYTHON_API_BASE_URL || 'http://127.0.0.1:8000';
        let ocrResults = [];

        try {
            // Procesar cada imagen
            for (let i = 0; i < imagePaths.length; i++) {
                const imagePath = imagePaths[i];
                const formData = new FormData();
                formData.append('file', await fs.readFile(imagePath), {
                    filename: `page_${i + 1}.png`,
                    contentType: 'image/png'
                });

                const response = await fetch(`${pythonApiUrl}/predict?ocr=true&digits_only=true&digits_engine=auto`, {
                    method: 'POST',
                    body: formData,
                    headers: formData.getHeaders()
                });

                if (!response.ok) {
                    throw new Error(`API Python respondió con status ${response.status}`);
                }

                const result = await response.json();

                // Extraer solo ocr_digits que es lo que nos interesa
                if (result.ocr_digits) {
                    ocrResults.push({
                        pagina: i + 1,
                        ocr_digits: result.ocr_digits
                    });
                }
            }

            // 5. Limpiar imágenes temporales
            await Promise.all(imagePaths.map(async (imgPath) => {
                try {
                    await fs.unlink(imgPath);
                } catch (err) {
                    logger.warn(`No se pudo eliminar imagen temporal ${imgPath}`, 'RevisionAdmisibilidad');
                }
            }));

            // 6. Analizar resultados y determinar admisibilidad
            const observaciones = [];
            let admisible = true;
            let puntaje = 100;

            // Aquí puedes agregar lógica para analizar los ocr_digits
            // Por ejemplo, verificar si hay números críticos, montos, etc.
            if (ocrResults.length === 0) {
                observaciones.push({
                    tipo: 'advertencia',
                    seccion: 'OCR',
                    mensaje: 'No se pudieron extraer dígitos del documento'
                });
                puntaje = 70;
            }

            // 7. Retornar resultado estructurado
            return res.status(200).json({
                success: true,
                data: {
                    admisible,
                    puntaje,
                    ocr_digits: ocrResults,
                    observaciones,
                    detalles: {
                        total_paginas: imagePaths.length,
                        paginas_procesadas: ocrResults.length,
                        documento_id: documento_id,
                        orden: orden
                    }
                }
            });

        } catch (apiError) {
            logger.error(`Error consultando API Python: ${apiError.message}`, 'RevisionAdmisibilidad');

            // Limpiar imágenes en caso de error
            await Promise.all(imagePaths.map(async (imgPath) => {
                try {
                    await fs.unlink(imgPath);
                } catch (err) {
                    // Ignorar errores al limpiar
                }
            }));

            return res.status(500).json({
                success: false,
                message: 'Error consultando API de OCR',
                error: apiError.message
            });
        }

    } catch (error) {
        logger.error(`Error en revisión de admisibilidad: ${error.message}`, 'RevisionAdmisibilidad');
        return res.status(500).json({
            success: false,
            message: 'Error interno en revisión de admisibilidad',
            error: error.message
        });
    }
});

module.exports = router;
