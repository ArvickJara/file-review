/**
 * Servicio para interactuar con la API de detección de foliación
 * Arquitectura híbrida: Detección en la nube (Roboflow) + OCR local
 */

const FOLIACION_API_BASE = import.meta.env.VITE_FOLIACION_API_URL || 'http://127.0.0.1:8000';

export type FoliacionPrediction = {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    class: string;
    class_id: number;
    detection_id: string;
    ocr_digits?: string;
    low_confidence?: boolean;
    ocr_skipped?: string;
    foliation_check?: {
        match: boolean;
        diff: number | null;
        confidence: number;
        match_percentage: number;
    };
};

export type FoliacionPageResult = {
    page_number: number;
    predictions: FoliacionPrediction[];
    image_dimensions: {
        width: number;
        height: number;
    };
};

export type FoliacionProcessResult = {
    pages: FoliacionPageResult[];
    summary: {
        total_pages: number;
        total_detections: number;
        pages_with_detections: number;
        exact_matches: number;
        pages_without_match: number;
        average_confidence: number;
    };
};

export type ProcessPdfOptions = {
    dpi?: number;
    imgsz?: number;
    conf?: number;
    min_confidence?: number;
    ocr?: boolean;
    digits_only?: boolean;
    digits_engine?: 'auto' | 'easyocr' | 'trocr' | 'donut';
    digits_preprocess?: 'none' | 'light' | 'strong';
    pad_ratio?: number;
};

/**
 * Procesa un archivo PDF para detectar foliación y extraer números
 */
export async function processPdfFoliacion(
    file: File,
    options: ProcessPdfOptions = {}
): Promise<FoliacionProcessResult> {
    const {
        dpi = 300,
        imgsz = 512,
        conf = 0.25,
        min_confidence = 0.5,
        ocr = true,
        digits_only = true,
        digits_engine = 'auto',
        digits_preprocess = 'strong',
        pad_ratio = 0.15
    } = options;

    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams({
        dpi: dpi.toString(),
        imgsz: imgsz.toString(),
        conf: conf.toString(),
        min_confidence: min_confidence.toString(),
        ocr: ocr.toString(),
        digits_only: digits_only.toString(),
        digits_engine,
        digits_preprocess,
        pad_ratio: pad_ratio.toString()
    });

    const response = await fetch(`${FOLIACION_API_BASE}/process-pdf?${params}`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Error en la API de foliación:', response.status, errorText);
        throw new Error(`Error al procesar PDF: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Respuesta de la API:', result);

    return result;
}

/**
 * Verifica si la API de foliación está disponible
 */
export async function checkFoliacionApiHealth(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${FOLIACION_API_BASE}/`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.error('API de foliación no disponible:', error);
        return false;
    }
}

/**
 * Extrae información útil de los resultados de foliación
 */
export function extractFoliacionInfo(result: FoliacionProcessResult) {
    // Validar que result y result.pages existan
    if (!result || !result.pages || !Array.isArray(result.pages) || result.pages.length === 0) {
        console.error('Resultado de foliación inválido:', result);
        return {
            totalPages: 0,
            lastFolio: null,
            lastFolioString: null,
            detectionsCount: 0,
            pagesWithDetections: 0,
            pagesWithoutDetections: 0,
            pagesWithExactMatch: 0,
            exactMatchPercentage: 0,
            averageConfidence: 0,
            lowConfidenceCount: 0,
            highConfidenceCount: 0,
            hasBlankPages: false,
            isContinuous: false,
            legibilityScore: 'baja' as const
        };
    }

    const lastPage = result.pages[result.pages.length - 1];
    const lastPageWithDetection = [...result.pages]
        .reverse()
        .find(p => p.predictions && p.predictions.length > 0);

    // Obtener el último folio detectado
    let lastFolio: string | null = null;
    if (lastPageWithDetection && lastPageWithDetection.predictions.length > 0) {
        const predictionsWithDigits = lastPageWithDetection.predictions.filter(p => p.ocr_digits);
        if (predictionsWithDigits.length > 0) {
            // Tomar el de mayor confianza
            const bestPrediction = predictionsWithDigits.reduce((best, current) =>
                current.confidence > best.confidence ? current : best
            );
            lastFolio = bestPrediction.ocr_digits || null;
        }
    }

    // Calcular estadísticas de legibilidad
    const allPredictions = result.pages.flatMap(p => p.predictions);
    const lowConfidencePredictions = allPredictions.filter(p => p.low_confidence);
    const highConfidencePredictions = allPredictions.filter(p => !p.low_confidence);

    // Páginas con coincidencia exacta
    const pagesWithExactMatch = result.pages.filter(page =>
        page.predictions.some(pred =>
            pred.foliation_check?.match === true
        )
    ).length;

    return {
        totalPages: result.summary.total_pages,
        lastFolio: lastFolio ? parseInt(lastFolio, 10) : null,
        lastFolioString: lastFolio,
        detectionsCount: result.summary.total_detections,
        pagesWithDetections: result.summary.pages_with_detections,
        pagesWithoutDetections: result.summary.total_pages - result.summary.pages_with_detections,
        pagesWithExactMatch,
        exactMatchPercentage: result.summary.total_pages > 0
            ? Math.round((pagesWithExactMatch / result.summary.total_pages) * 100)
            : 0,
        averageConfidence: result.summary.average_confidence,
        lowConfidenceCount: lowConfidencePredictions.length,
        highConfidenceCount: highConfidencePredictions.length,
        hasBlankPages: result.summary.pages_without_match > 0,
        // Determinar si la foliación es continua
        isContinuous: result.summary.exact_matches === result.summary.total_pages,
        // Determinar legibilidad general
        legibilityScore: result.summary.average_confidence >= 0.8 ? 'alta' :
            result.summary.average_confidence >= 0.5 ? 'media' : 'baja'
    };
}

/**
 * Genera observaciones automáticas basadas en los resultados
 */
export function generateObservations(result: FoliacionProcessResult): string[] {
    const info = extractFoliacionInfo(result);
    const observations: string[] = [];

    if (!info.isContinuous) {
        observations.push(
            `Foliación discontinua: ${info.pagesWithExactMatch} de ${info.totalPages} páginas con coincidencia exacta (${info.exactMatchPercentage}%).`
        );
    } else {
        observations.push('Foliación continua y correcta en todas las páginas.');
    }

    if (info.pagesWithoutDetections > 0) {
        observations.push(
            `Se detectaron ${info.pagesWithoutDetections} página(s) sin foliación visible.`
        );
    }

    if (info.lowConfidenceCount > 0) {
        observations.push(
            `${info.lowConfidenceCount} detección(es) con baja confianza que requieren revisión manual.`
        );
    }

    if (info.legibilityScore === 'baja') {
        observations.push(
            `Legibilidad deficiente (confianza promedio: ${Math.round(info.averageConfidence * 100)}%). Se recomienda mejorar la calidad del escaneo.`
        );
    }

    if (info.totalPages !== info.lastFolio) {
        observations.push(
            `Discrepancia: ${info.totalPages} páginas detectadas pero último folio es ${info.lastFolio || 'N/A'}.`
        );
    }

    return observations;
}
