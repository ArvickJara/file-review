const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { parsePDF } = require('./pdfHelper');

/**
 * Extrae el índice explícito de un PDF
 * Busca patrones como "ÍNDICE", "CONTENIDO", seguido de una lista numerada o con puntos
 */
async function extractExplicitIndex(pdfBuffer) {
    try {
        const data = await parsePDF(pdfBuffer);
        const text = data.text;

        // Buscar sección de índice
        const indexPatterns = [
            /ÍNDICE\s*\n([\s\S]*?)(?=\n\s*\n[A-Z]{3,}|\n\s*CAPÍTULO|$)/i,
            /CONTENIDO\s*\n([\s\S]*?)(?=\n\s*\n[A-Z]{3,}|\n\s*CAPÍTULO|$)/i,
            /TABLA DE CONTENIDO\s*\n([\s\S]*?)(?=\n\s*\n[A-Z]{3,}|\n\s*CAPÍTULO|$)/i
        ];

        let indexContent = null;
        for (const pattern of indexPatterns) {
            const match = text.match(pattern);
            if (match) {
                indexContent = match[1];
                break;
            }
        }

        if (!indexContent) {
            return {
                found: false,
                items: [],
                rawText: ''
            };
        }

        // Extraer items del índice
        const lines = indexContent.split('\n').filter(line => line.trim());
        const items = [];

        for (const line of lines) {
            // Patrones comunes de índice:
            // 1. Título ............. Página
            // 1.1 Subtítulo ......... Página
            // CAPÍTULO 1: Título .... Página
            const itemPattern = /^(\d+\.?\d*\.?\d*\.?)\s+(.+?)[\s\.]+(\d+)$/;
            const chapterPattern = /^(CAPÍTULO\s+\d+|SECCIÓN\s+\d+)[\s:]+(.+?)[\s\.]+(\d+)$/i;

            let match = line.match(itemPattern) || line.match(chapterPattern);
            if (match) {
                items.push({
                    number: match[1].trim(),
                    title: match[2].trim(),
                    page: parseInt(match[3])
                });
            }
        }

        return {
            found: true,
            items,
            rawText: indexContent
        };

    } catch (error) {
        logger.error(`Error extrayendo índice explícito: ${error.message}`, 'IndiceAnalyzer');
        throw error;
    }
}

/**
 * Genera un índice automático analizando títulos en el documento
 * Detecta patrones de títulos basándose en formato, mayúsculas, números, etc.
 */
async function generateAutomaticIndex(pdfBuffer) {
    try {
        const data = await parsePDF(pdfBuffer);
        const text = data.text;

        const lines = text.split('\n');
        const items = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) continue;

            // Patrones de títulos:
            // - Líneas completamente en MAYÚSCULAS (mínimo 3 palabras)
            // - Líneas que empiezan con número seguido de punto y título
            // - CAPÍTULO N: Título

            const isAllCaps = line === line.toUpperCase() && line.length > 10;
            const hasNumberPrefix = /^(\d+\.?\d*\.?\d*\.?)\s+([A-ZÁÉÍÓÚÑ].+)$/.test(line);
            const isChapter = /^(CAPÍTULO\s+\d+|SECCIÓN\s+\d+)[\s:]+(.+)$/i.test(line);

            if (isAllCaps || hasNumberPrefix || isChapter) {
                let number = '';
                let title = line;

                if (hasNumberPrefix) {
                    const match = line.match(/^(\d+\.?\d*\.?\d*\.?)\s+(.+)$/);
                    if (match) {
                        number = match[1];
                        title = match[2];
                    }
                } else if (isChapter) {
                    const match = line.match(/^(CAPÍTULO\s+\d+|SECCIÓN\s+\d+)[\s:]+(.+)$/i);
                    if (match) {
                        number = match[1];
                        title = match[2];
                    }
                }

                // Estimar nivel basado en el número
                let level = 1;
                if (number) {
                    const dots = (number.match(/\./g) || []).length;
                    level = dots + 1;
                }

                items.push({
                    number,
                    title: title.trim(),
                    level,
                    lineNumber: i + 1
                });
            }
        }

        return {
            items,
            totalItems: items.length
        };

    } catch (error) {
        logger.error(`Error generando índice automático: ${error.message}`, 'IndiceAnalyzer');
        throw error;
    }
}

/**
 * Compara el índice explícito con el índice generado
 * Retorna coincidencias y diferencias
 */
function compareIndexes(explicitIndex, automaticIndex) {
    const matches = [];
    const mismatches = [];
    const missing = [];

    // Normalizar títulos para comparación
    const normalize = (str) => str.toLowerCase()
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();

    for (const explicitItem of explicitIndex.items) {
        const normalizedExplicit = normalize(explicitItem.title);

        // Buscar coincidencia en índice automático
        const found = automaticIndex.items.find(autoItem => {
            const normalizedAuto = normalize(autoItem.title);
            return normalizedAuto.includes(normalizedExplicit) ||
                normalizedExplicit.includes(normalizedAuto);
        });

        if (found) {
            matches.push({
                explicit: explicitItem,
                automatic: found,
                similarity: calculateSimilarity(normalizedExplicit, normalize(found.title))
            });
        } else {
            missing.push(explicitItem);
        }
    }

    // Buscar items en automático que no están en explícito
    for (const autoItem of automaticIndex.items) {
        const normalizedAuto = normalize(autoItem.title);
        const found = explicitIndex.items.find(explicitItem => {
            const normalizedExplicit = normalize(explicitItem.title);
            return normalizedAuto.includes(normalizedExplicit) ||
                normalizedExplicit.includes(normalizedAuto);
        });

        if (!found) {
            mismatches.push(autoItem);
        }
    }

    return {
        matches,
        missing,
        mismatches,
        consistency: matches.length / Math.max(explicitIndex.items.length, 1)
    };
}

/**
 * Calcula similitud entre dos strings (0 a 1)
 */
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Distancia de Levenshtein (edición)
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * Compara índice del producto con índice del TDR
 */
function compareWithTdrIndex(productIndex, tdrRequirements) {
    const compliance = [];
    const missing = [];

    for (const requirement of tdrRequirements) {
        const normalizedReq = requirement.nombre_requisito.toLowerCase();

        // Buscar en índice del producto
        const found = productIndex.items.find(item => {
            const normalizedItem = item.title.toLowerCase();
            return normalizedItem.includes(normalizedReq) ||
                normalizedReq.includes(normalizedItem);
        });

        if (found) {
            compliance.push({
                requirement: requirement.nombre_requisito,
                found: true,
                matchedItem: found,
                isObligatory: requirement.es_obligatorio
            });
        } else {
            if (requirement.es_obligatorio) {
                missing.push({
                    requirement: requirement.nombre_requisito,
                    description: requirement.descripcion_completa,
                    isObligatory: true
                });
            }
        }
    }

    return {
        compliance,
        missing,
        complianceRate: compliance.length / Math.max(tdrRequirements.length, 1),
        obligatoryMissing: missing.filter(m => m.isObligatory).length
    };
}

module.exports = {
    extractExplicitIndex,
    generateAutomaticIndex,
    compareIndexes,
    compareWithTdrIndex
};
