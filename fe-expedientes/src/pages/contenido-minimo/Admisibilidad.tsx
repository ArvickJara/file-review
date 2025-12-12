import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ClipboardList,
    FileText,
    Loader2,
    Save,
    ShieldCheck,
    Sparkles
} from 'lucide-react';
import { useProyectoIdFromRoute } from '@/hooks/useProyectoId';
import {
    processPdfFoliacion,
    extractFoliacionInfo,
    generateObservations,
    checkFoliacionApiHealth,
    type FoliacionProcessResult
} from '@/services/foliacionService';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const STORAGE_PREFIX = 'admisibilidad_eval';

type Documento = {
    id: string;
    nombre?: string;
    nombre_archivo?: string;
    proyecto_id: string;
    orden?: number;
    paginas?: number;
};

type Proyecto = {
    id: string;
    nombre?: string;
    codigo_proyecto?: string;
};

type EstadoBinario = 'sin-revision' | 'cumple' | 'no-cumple';
type EstadoLegibilidad = 'sin-revision' | 'legible' | 'ilegible';

type EvaluacionEntrega = {
    sinHojasBlanco: EstadoBinario;
    foliacion: {
        totalPaginas: string;
        folioFinal: string;
    };
    legibilidad: {
        texto: EstadoLegibilidad;
        foliado: EstadoLegibilidad;
        imagen: EstadoLegibilidad;
    };
    observaciones: string;
};

const defaultEvaluacion: EvaluacionEntrega = {
    sinHojasBlanco: 'sin-revision',
    foliacion: { totalPaginas: '', folioFinal: '' },
    legibilidad: { texto: 'sin-revision', foliado: 'sin-revision', imagen: 'sin-revision' },
    observaciones: ''
};

const getStorageKey = (proyectoId: string) => `${STORAGE_PREFIX}:${proyectoId}`;

export default function Admisibilidad() {
    const proyectoId = useProyectoIdFromRoute();
    const [proyecto, setProyecto] = useState<Proyecto | null>(null);
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);
    const [evaluaciones, setEvaluaciones] = useState<Record<string, EvaluacionEntrega>>({});
    const [revisandoAuto, setRevisandoAuto] = useState(false);
    const [progresoRevision, setProgresoRevision] = useState<Record<string, 'pendiente' | 'procesando' | 'completado' | 'error'>>({});
    const [foliacionApiDisponible, setFoliacionApiDisponible] = useState<boolean>(false);
    const [resultadosFoliacion, setResultadosFoliacion] = useState<Record<string, FoliacionProcessResult>>({});
    const [resultadosRPA, setResultadosRPA] = useState<Record<string, any>>({});
    const [verificandoRPA, setVerificandoRPA] = useState(false);

    const tdr = useMemo(
        () =>
            documentos.find((d) => (d.orden ?? 0) === 0) ||
            documentos.find((d) => (d.nombre || d.nombre_archivo || '').toLowerCase().includes('tdr')),
        [documentos]
    );

    const tomos = useMemo(() => {
        const items = documentos.filter((d) => {
            const ord = d.orden ?? 0;
            const isTdrName = (d.nombre || d.nombre_archivo || '').toLowerCase().includes('tdr');
            return ord > 0 || !isTdrName;
        });
        return items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    }, [documentos]);

    useEffect(() => {
        if (!proyectoId) return;
        const controller = new AbortController();
        (async () => {
            setLoading(true);
            try {
                const [pResp, docsResp] = await Promise.all([
                    fetch(`${API_BASE}/api/proyectos/${proyectoId}`, { signal: controller.signal }),
                    fetch(`${API_BASE}/api/expedientes_tecnicos/documentos/${proyectoId}`, { signal: controller.signal })
                ]);

                if (pResp.ok) {
                    const pj = await pResp.json();
                    setProyecto(pj.proyecto || null);
                }

                if (docsResp.ok) {
                    const dj = await docsResp.json();
                    setDocumentos(Array.isArray(dj.documentos) ? dj.documentos : []);
                }
            } catch (error: any) {
                if (error?.name !== 'AbortError') {
                    console.error(error);
                }
            } finally {
                setLoading(false);
            }
        })();
        return () => controller.abort();
    }, [proyectoId]);

    // Verificar disponibilidad de API de foliación
    useEffect(() => {
        checkFoliacionApiHealth().then(setFoliacionApiDisponible);
    }, []);

    // Inicializa evaluaciones para cada tomo
    useEffect(() => {
        if (!tomos.length) return;
        setEvaluaciones((prev) => {
            const next = { ...prev };
            tomos.forEach((t) => {
                if (!next[t.id]) {
                    next[t.id] = { ...defaultEvaluacion };
                    if (typeof t.paginas === 'number' && Number.isFinite(t.paginas)) {
                        next[t.id].foliacion.totalPaginas = String(t.paginas);
                    }
                }
            });
            return next;
        });
    }, [tomos]);

    // Recupera evaluación guardada
    useEffect(() => {
        if (!proyectoId) return;
        try {
            if (typeof window === 'undefined') return;
            const stored = localStorage.getItem(getStorageKey(proyectoId));
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, EvaluacionEntrega>;
                setEvaluaciones(parsed);
            }
        } catch (error) {
            console.warn('No se pudo restaurar la evaluación de Admisibilidad', error);
        }
    }, [proyectoId]);

    const handleEvaluacionChange = (docId: string, updater: (prev: EvaluacionEntrega) => EvaluacionEntrega) => {
        setEvaluaciones((prev) => ({
            ...prev,
            [docId]: updater(prev[docId] || { ...defaultEvaluacion })
        }));
    };

    const guardarEnLocal = async () => {
        if (!proyectoId) return;
        setSaving(true);
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(getStorageKey(proyectoId), JSON.stringify(evaluaciones));
                setMensajeGuardado('Evaluación guardada localmente');
                setTimeout(() => setMensajeGuardado(null), 4000);
            }
        } catch (error) {
            alert('No se pudo guardar en localStorage');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const limpiarEvaluacion = () => {
        if (!proyectoId) return;
        if (typeof window !== 'undefined') {
            localStorage.removeItem(getStorageKey(proyectoId));
        }
        setEvaluaciones({});
    };

    const revisarAutomaticamente = async () => {
        if (!tomos.length || !proyectoId) {
            alert('Necesitas tener al menos un entregable cargado para revisar automáticamente.');
            return;
        }

        if (!foliacionApiDisponible) {
            alert('La API de detección de foliación no está disponible. Verifica que el servidor esté corriendo en http://127.0.0.1:8000');
            return;
        }

        setRevisandoAuto(true);
        setVerificandoRPA(true);

        // Inicializar estados
        const progreso: Record<string, 'pendiente' | 'procesando' | 'completado' | 'error'> = {};
        tomos.forEach(t => progreso[t.id] = 'pendiente');
        setProgresoRevision(progreso);

        // Procesar cada tomo INDIVIDUALMENTE (uno a la vez)
        for (const tomo of tomos) {
            try {
                console.log(`\n=== Procesando entregable: ${tomo.nombre || tomo.nombre_archivo} ===`);
                setProgresoRevision(prev => ({ ...prev, [tomo.id]: 'procesando' }));

                // Descargar el archivo PDF del documento
                const pdfResponse = await fetch(`${API_BASE}/api/expedientes_tecnicos/documento/${tomo.id}/download`);

                if (!pdfResponse.ok) {
                    throw new Error(`No se pudo descargar el PDF: ${pdfResponse.status}`);
                }

                const pdfBlob = await pdfResponse.blob();
                const pdfFile = new File([pdfBlob], tomo.nombre_archivo || `documento_${tomo.id}.pdf`, { type: 'application/pdf' });

                // ===== PASO 1: Verificación de FOLIACIÓN con IA =====
                console.log(`[${tomo.id}] Paso 1: Verificando foliación con IA...`);
                const resultadoFoliacion = await processPdfFoliacion(pdfFile, {
                    dpi: 300,
                    min_confidence: 0.5,
                    ocr: true,
                    digits_only: true,
                    digits_engine: 'auto'
                });

                if (!resultadoFoliacion || !resultadoFoliacion.pages) {
                    throw new Error('La API de foliación devolvió una respuesta inválida');
                }

                setResultadosFoliacion(prev => ({ ...prev, [tomo.id]: resultadoFoliacion }));
                console.log(`[${tomo.id}] ✓ Foliación completada`);

                // ===== PASO 2: Verificación de HOJAS EN BLANCO y LEGIBILIDAD con RPA =====
                console.log(`[${tomo.id}] Paso 2: Verificando hojas en blanco y legibilidad con RPA...`);
                const rpaResponse = await fetch(`${API_BASE}/api/expedientes_tecnicos/documento/${tomo.id}/verificar-rpa`, {
                    method: 'POST'
                });

                if (!rpaResponse.ok) {
                    throw new Error(`Error en RPA: ${rpaResponse.status}`);
                }

                const resultadoRPA = await rpaResponse.json();
                console.log(`[${tomo.id}] Resultado RPA:`, resultadoRPA);

                if (!resultadoRPA.success || !resultadoRPA.resultado) {
                    throw new Error('El RPA devolvió una respuesta inválida');
                }

                setResultadosRPA(prev => ({ ...prev, [tomo.id]: resultadoRPA.resultado }));
                console.log(`[${tomo.id}] ✓ RPA completado`);

                // ===== PASO 3: Consolidar resultados y actualizar evaluación =====
                console.log(`[${tomo.id}] Paso 3: Consolidando resultados...`);

                const infoFoliacion = extractFoliacionInfo(resultadoFoliacion);
                const observationsFoliacion = generateObservations(resultadoFoliacion);

                // Extraer resultados del RPA
                const hojasBlancoResult = resultadoRPA.resultado.resultados?.find((r: any) =>
                    r.tipo_verificacion.includes('Hojas en Blanco')
                );
                const ilegibilidadResult = resultadoRPA.resultado.resultados?.find((r: any) =>
                    r.tipo_verificacion.includes('Ilegibilidad')
                );

                // Actualizar evaluación con información combinada
                handleEvaluacionChange(tomo.id, (prev) => ({
                    ...prev,
                    sinHojasBlanco: hojasBlancoResult?.estado === 'APROBADO' ? 'cumple' : 'no-cumple',
                    foliacion: {
                        totalPaginas: infoFoliacion.totalPages.toString(),
                        folioFinal: infoFoliacion.lastFolioString || ''
                    },
                    legibilidad: {
                        texto: ilegibilidadResult?.estado === 'APROBADO' || ilegibilidadResult?.estado === 'OBSERVADO' ? 'legible' : 'ilegible',
                        foliado: infoFoliacion.averageConfidence >= 0.5 ? 'legible' : 'ilegible',
                        imagen: ilegibilidadResult?.estado === 'APROBADO' ? 'legible' : 'ilegible'
                    },
                    observaciones: [
                        ...observationsFoliacion,
                        ...(hojasBlancoResult?.detalles || []),
                        ...(ilegibilidadResult?.detalles || [])
                    ].filter(Boolean).join(' | ')
                }));

                setProgresoRevision(prev => ({ ...prev, [tomo.id]: 'completado' }));
                console.log(`[${tomo.id}] ✓ Entregable completado\n`);

            } catch (error) {
                console.error(`[${tomo.id}] Error:`, error);
                setProgresoRevision(prev => ({ ...prev, [tomo.id]: 'error' }));

                handleEvaluacionChange(tomo.id, (prev) => ({
                    ...prev,
                    observaciones: `Error en revisión: ${error instanceof Error ? error.message : 'Error desconocido'}`
                }));
            }
        }

        setRevisandoAuto(false);
        setVerificandoRPA(false);
        setMensajeGuardado('Revisión completada: Foliación (IA) + Hojas en blanco y Legibilidad (RPA)');
        setTimeout(() => setMensajeGuardado(null), 5000);
    };

    const verificarConRPA = async () => {
        if (!tomos.length || !proyectoId) {
            alert('Necesitas tener al menos un entregable cargado para verificar con RPA.');
            return;
        }

        setVerificandoRPA(true);

        // Inicializar estados
        const progreso: Record<string, 'pendiente' | 'procesando' | 'completado' | 'error'> = {};
        tomos.forEach(t => progreso[t.id] = 'pendiente');
        setProgresoRevision(progreso);

        // Procesar cada tomo con el RPA
        for (const tomo of tomos) {
            try {
                setProgresoRevision(prev => ({ ...prev, [tomo.id]: 'procesando' }));

                const response = await fetch(`${API_BASE}/api/expedientes_tecnicos/documento/${tomo.id}/verificar-rpa`, {
                    method: 'POST'
                });

                if (!response.ok) {
                    throw new Error(`Error HTTP ${response.status}`);
                }

                const resultado = await response.json();
                console.log('Resultado RPA:', resultado);

                // Guardar resultados del RPA
                setResultadosRPA(prev => ({ ...prev, [tomo.id]: resultado.resultado }));

                // Actualizar evaluaciones basadas en el RPA
                if (resultado.resultado && resultado.resultado.resultados) {
                    const hojasBlancoResult = resultado.resultado.resultados.find((r: any) => r.tipo_verificacion.includes('Hojas en Blanco'));
                    const ilegibilidadResult = resultado.resultado.resultados.find((r: any) => r.tipo_verificacion.includes('Ilegibilidad'));
                    const foliacionResult = resultado.resultado.resultados.find((r: any) => r.tipo_verificacion.includes('Foliación'));

                    handleEvaluacionChange(tomo.id, (prev) => ({
                        ...prev,
                        sinHojasBlanco: hojasBlancoResult?.estado === 'APROBADO' ? 'cumple' : 'no-cumple',
                        legibilidad: {
                            texto: ilegibilidadResult?.estado === 'APROBADO' || ilegibilidadResult?.estado === 'OBSERVADO' ? 'legible' : 'ilegible',
                            foliado: foliacionResult?.estado === 'APROBADO' ? 'legible' : 'ilegible',
                            imagen: ilegibilidadResult?.estado === 'APROBADO' ? 'legible' : 'ilegible'
                        },
                        observaciones: [
                            hojasBlancoResult?.detalles?.join('. '),
                            ilegibilidadResult?.detalles?.join('. '),
                            foliacionResult?.detalles?.join('. ')
                        ].filter(Boolean).join(' | ')
                    }));
                }

                setProgresoRevision(prev => ({ ...prev, [tomo.id]: 'completado' }));

            } catch (error) {
                console.error(`Error verificando RPA ${tomo.id}:`, error);
                setProgresoRevision(prev => ({ ...prev, [tomo.id]: 'error' }));

                handleEvaluacionChange(tomo.id, (prev) => ({
                    ...prev,
                    observaciones: `Error en verificación RPA: ${error instanceof Error ? error.message : 'Error desconocido'}`
                }));
            }
        }

        setVerificandoRPA(false);
        setMensajeGuardado('Verificación RPA completada (Hojas en blanco + Legibilidad).');
        setTimeout(() => setMensajeGuardado(null), 5000);
    };

    const evaluarCoincidenciaFoliacion = (docId: string) => {
        const actual = evaluaciones[docId];
        if (!actual) return null;
        const total = parseInt(actual.foliacion.totalPaginas, 10);
        const folio = parseInt(actual.foliacion.folioFinal, 10);
        if (!Number.isFinite(total) || !Number.isFinite(folio) || total <= 0 || folio <= 0) return null;
        return total === folio;
    };

    const isRevisionCompleta = (docId: string) => {
        const evalDoc = evaluaciones[docId];
        if (!evalDoc) return false;
        const foliacionLista = evaluarCoincidenciaFoliacion(docId) !== null;
        const legible = Object.values(evalDoc.legibilidad).every((estado) => estado !== 'sin-revision');
        return evalDoc.sinHojasBlanco !== 'sin-revision' && foliacionLista && legible;
    };

    const hallazgos = useMemo(() => {
        return tomos.map((doc) => {
            const evalDoc = evaluaciones[doc.id];
            const issues: string[] = [];
            if (!evalDoc) return { doc, issues };
            if (evalDoc.sinHojasBlanco === 'no-cumple') issues.push('Hojas en blanco detectadas');
            const foliacionCoincide = evaluarCoincidenciaFoliacion(doc.id);
            if (foliacionCoincide === false) issues.push('Foliación no coincide con páginas contadas');
            ['texto', 'foliado', 'imagen'].forEach((key) => {
                const estado = evalDoc.legibilidad[key as keyof typeof evalDoc.legibilidad];
                if (estado === 'ilegible') {
                    issues.push(`Legibilidad deficiente en ${key}`);
                }
            });
            return { doc, issues };
        }).filter((item) => item.issues.length > 0);
    }, [tomos, evaluaciones]);

    const resumen = useMemo(() => {
        const total = tomos.length;
        const revisados = tomos.filter((t) => isRevisionCompleta(t.id)).length;
        const pendientes = total - revisados;
        return { total, revisados, pendientes };
    }, [tomos, evaluaciones]);

    if (!proyectoId) {
        return (
            <div className="max-w-5xl mx-auto p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-700" />
                    <div>
                        <p className="text-sm text-yellow-800">Necesitas seleccionar un proyecto para evaluar Admisibilidad.</p>
                        <Link className="text-sm text-blue-700 underline" to="/proyectos">
                            Ir a gestión de expedientes
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Contenidos mínimos</p>
                        <h1 className="text-2xl font-bold text-gray-900">Admisibilidad de entregables</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Proyecto: <strong>{proyecto?.nombre || proyecto?.codigo_proyecto || proyectoId}</strong>
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {foliacionApiDisponible ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Sparkles className="h-3 w-3" />
                                API IA activa
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertCircle className="h-3 w-3" />
                                API IA no disponible
                            </span>
                        )}
                        <button
                            onClick={revisarAutomaticamente}
                            disabled={!tomos.length || revisandoAuto || !foliacionApiDisponible}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${tomos.length && !revisandoAuto && foliacionApiDisponible ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                            title={!foliacionApiDisponible ? 'API de foliación no disponible. Verifica que esté corriendo en http://127.0.0.1:8000' : 'Verifica foliación (IA), hojas en blanco y legibilidad (RPA) por cada entregable'}
                        >
                            {revisandoAuto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            {revisandoAuto ? 'Revisando con IA...' : 'Revisar con IA'}
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                    Esta vista verifica tres aspectos exigidos en la etapa de admisibilidad: (1) ausencia de hojas en blanco, (2) foliación completa y consecutiva, y (3) legibilidad del texto.
                </p>
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    El botón "Revisar con IA" procesa cada entregable individualmente: foliación (IA en nube) + hojas en blanco y legibilidad (RPA local)
                </p>
                {mensajeGuardado && (
                    <div className="mt-3 p-2 rounded bg-emerald-50 text-emerald-700 text-xs inline-flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {mensajeGuardado}
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-600">Entregables detectados</p>
                    <p className="text-3xl font-bold text-gray-900">{resumen.total}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-600">Revisiones completas</p>
                    <p className="text-3xl font-bold text-emerald-600">{resumen.revisados}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-600">Pendientes</p>
                    <p className="text-3xl font-bold text-amber-600">{resumen.pendientes}</p>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Documentos detectados</h2>
                {loading ? (
                    <div className="flex items-center gap-2 text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-start gap-3">
                                <FileText className="h-5 w-5 text-gray-700 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">TDR del proyecto</p>
                                    {tdr ? (
                                        <div className="mt-1 flex items-center gap-2 text-sm text-gray-800">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            {tdr.nombre || tdr.nombre_archivo || tdr.id}
                                        </div>
                                    ) : (
                                        <div className="mt-1 flex items-center gap-2 text-sm text-yellow-700">
                                            <AlertCircle className="h-4 w-4" />
                                            Sin TDR cargado. <Link className="underline" to="/proyectos">Adjuntar</Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-start gap-3">
                                <ClipboardList className="h-5 w-5 text-gray-700 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Entregables analizados</p>
                                    {tomos.length ? (
                                        <ul className="mt-2 text-xs text-gray-600 space-y-1 list-disc pl-4">
                                            {tomos.map((t) => (
                                                <li key={t.id}>
                                                    {t.orden ? `Entregable ${t.orden}: ` : ''}
                                                    {t.nombre || t.nombre_archivo || t.id}
                                                    {typeof t.paginas === 'number' && (
                                                        <span className="text-gray-500"> — {t.paginas} pág.</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="mt-1 flex items-center gap-2 text-sm text-yellow-700">
                                            <AlertCircle className="h-4 w-4" />
                                            No hay entregables listados. <Link className="underline" to="/proyectos">Cargar</Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Checklist de admisibilidad</h2>
                        <p className="text-sm text-gray-600">Evalúa cada entregable antes de remitirlo a la mesa de partes.</p>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> El resultado queda guardado solo en tu navegador.
                    </div>
                </div>

                {tomos.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Sube los tomos del expediente técnico para habilitar la evaluación.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-600">Entregable</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-600">Hojas en blanco</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-600">Foliación</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-600">Legibilidad</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-600">Observaciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {tomos.map((doc) => {
                                    const evalDoc = evaluaciones[doc.id] || defaultEvaluacion;
                                    const foliacionCoincide = evaluarCoincidenciaFoliacion(doc.id);
                                    return (
                                        <tr key={doc.id} className="align-top">
                                            <td className="px-4 py-4 w-64">
                                                <p className="font-medium text-gray-900">{doc.nombre || doc.nombre_archivo || doc.id}</p>
                                                {doc.orden && (
                                                    <p className="text-xs text-gray-500 mt-1">Orden #{doc.orden}</p>
                                                )}
                                                {progresoRevision[doc.id] && (
                                                    <div className="mt-2">
                                                        {progresoRevision[doc.id] === 'procesando' && (
                                                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                Revisando...
                                                            </span>
                                                        )}
                                                        {progresoRevision[doc.id] === 'completado' && (
                                                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Revisado
                                                            </span>
                                                        )}
                                                        {progresoRevision[doc.id] === 'error' && (
                                                            <span className="inline-flex items-center gap-1 text-xs text-red-600">
                                                                <AlertCircle className="h-3 w-3" />
                                                                Error
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="space-y-2">
                                                    {['cumple', 'no-cumple', 'sin-revision'].map((estado) => (
                                                        <label key={estado} className="flex items-center gap-2 text-xs text-gray-600">
                                                            <input
                                                                type="radio"
                                                                name={`blanco-${doc.id}`}
                                                                value={estado}
                                                                checked={evalDoc.sinHojasBlanco === estado}
                                                                onChange={(e) =>
                                                                    handleEvaluacionChange(doc.id, (prev) => ({
                                                                        ...prev,
                                                                        sinHojasBlanco: e.target.value as EstadoBinario
                                                                    }))
                                                                }
                                                            />
                                                            {estado === 'cumple'
                                                                ? 'Sin hojas en blanco'
                                                                : estado === 'no-cumple'
                                                                    ? 'Presenta hojas en blanco'
                                                                    : 'Sin revisar'}
                                                        </label>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="space-y-2">
                                                    <label className="block text-xs text-gray-500">Páginas detectadas</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={evalDoc.foliacion.totalPaginas}
                                                        onChange={(e) =>
                                                            handleEvaluacionChange(doc.id, (prev) => ({
                                                                ...prev,
                                                                foliacion: {
                                                                    ...prev.foliacion,
                                                                    totalPaginas: e.target.value
                                                                }
                                                            }))
                                                        }
                                                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                                    />
                                                    <label className="block text-xs text-gray-500">Folio final consignado</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={evalDoc.foliacion.folioFinal}
                                                        onChange={(e) =>
                                                            handleEvaluacionChange(doc.id, (prev) => ({
                                                                ...prev,
                                                                foliacion: {
                                                                    ...prev.foliacion,
                                                                    folioFinal: e.target.value
                                                                }
                                                            }))
                                                        }
                                                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                                    />
                                                    {foliacionCoincide === null ? (
                                                        <p className="text-xs text-gray-500">Completa ambos campos para validar.</p>
                                                    ) : foliacionCoincide ? (
                                                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                                                            <CheckCircle2 className="h-4 w-4" /> Coincide
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-red-600 flex items-center gap-1">
                                                            <AlertTriangle className="h-4 w-4" /> No coincide
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="space-y-3">
                                                    {(['texto', 'foliado', 'imagen'] as const).map((dimension) => (
                                                        <div key={dimension}>
                                                            <label className="text-xs text-gray-500 capitalize block">{dimension}</label>
                                                            <select
                                                                value={evalDoc.legibilidad[dimension]}
                                                                onChange={(e) =>
                                                                    handleEvaluacionChange(doc.id, (prev) => ({
                                                                        ...prev,
                                                                        legibilidad: {
                                                                            ...prev.legibilidad,
                                                                            [dimension]: e.target.value as EstadoLegibilidad
                                                                        }
                                                                    }))
                                                                }
                                                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                                            >
                                                                <option value="sin-revision">Sin revisar</option>
                                                                <option value="legible">Legible</option>
                                                                <option value="ilegible">Ilegible</option>
                                                            </select>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <textarea
                                                    value={evalDoc.observaciones}
                                                    onChange={(e) =>
                                                        handleEvaluacionChange(doc.id, (prev) => ({
                                                            ...prev,
                                                            observaciones: e.target.value
                                                        }))
                                                    }
                                                    rows={4}
                                                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                                    placeholder="Hallazgos relevantes, correcciones sugeridas…"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {hallazgos.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" /> Hallazgos de admisibilidad
                    </h2>
                    <ul className="space-y-3">
                        {hallazgos.map(({ doc, issues }) => (
                            <li key={doc.id} className="border rounded-lg p-3">
                                <p className="font-medium text-gray-900">{doc.nombre || doc.nombre_archivo || doc.id}</p>
                                <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                                    {issues.map((issue, idx) => (
                                        <li key={`${doc.id}-issue-${idx}`}>{issue}</li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {Object.keys(resultadosFoliacion).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" /> Resultados de Verificación Completa
                    </h2>
                    <div className="space-y-4">
                        {tomos.map((doc) => {
                            const resultado = resultadosFoliacion[doc.id];
                            const resultadoRPA = resultadosRPA[doc.id];
                            if (!resultado) return null;

                            const info = extractFoliacionInfo(resultado);

                            // Extraer info del RPA si existe
                            const estadoRPA = resultadoRPA?.resumen?.estado_global;
                            const hojasBlancoOK = resultadoRPA?.resultados?.find((r: any) =>
                                r.tipo_verificacion.includes('Hojas en Blanco')
                            )?.estado === 'APROBADO';
                            const legibilidadOK = resultadoRPA?.resultados?.find((r: any) =>
                                r.tipo_verificacion.includes('Ilegibilidad')
                            )?.estado === 'APROBADO';

                            // Determinar estado general combinado
                            const todoOK = info.isContinuous && hojasBlancoOK && legibilidadOK;

                            return (
                                <details key={doc.id} className="border rounded-lg">
                                    <summary className="cursor-pointer p-3 hover:bg-gray-50 font-medium text-gray-900 flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            {doc.nombre || doc.nombre_archivo || doc.id}
                                            {todoOK ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                                                    ✓ Admisible
                                                </span>
                                            ) : estadoRPA === 'ADMISIBLE CON OBSERVACIONES' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
                                                    ⚠ Con Observaciones
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                                                    ✕ No Admisible
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            Foliación: {info.exactMatchPercentage}%
                                        </span>
                                    </summary>
                                    <div className="p-4 bg-gray-50 space-y-4 text-sm">

                                        {/* ===== SECCIÓN 1: RESUMEN DE VERIFICACIONES ===== */}
                                        {resultadoRPA && (
                                            <div className="bg-white rounded-lg p-3 border">
                                                <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                                    <ShieldCheck className="h-4 w-4" /> Resumen de Verificaciones
                                                </p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className={`p-2 rounded text-center ${hojasBlancoOK ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                                        <p className="text-xs text-gray-600">Hojas en Blanco</p>
                                                        <p className={`text-sm font-semibold ${hojasBlancoOK ? 'text-green-700' : 'text-red-700'}`}>
                                                            {hojasBlancoOK ? '✓ OK' : '✕ Detectadas'}
                                                        </p>
                                                    </div>
                                                    <div className={`p-2 rounded text-center ${info.isContinuous ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                                        <p className="text-xs text-gray-600">Foliación</p>
                                                        <p className={`text-sm font-semibold ${info.isContinuous ? 'text-green-700' : 'text-red-700'}`}>
                                                            {info.isContinuous ? '✓ Continua' : '✕ Errores'}
                                                        </p>
                                                    </div>
                                                    <div className={`p-2 rounded text-center ${legibilidadOK ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                                        <p className="text-xs text-gray-600">Legibilidad</p>
                                                        <p className={`text-sm font-semibold ${legibilidadOK ? 'text-green-700' : 'text-red-700'}`}>
                                                            {legibilidadOK ? '✓ OK' : '⚠ Baja'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ===== SECCIÓN 2: DETALLES DE VERIFICACIÓN RPA ===== */}
                                        {resultadoRPA && (
                                            <div className="space-y-2">
                                                {resultadoRPA.resultados?.map((verificacion: any, idx: number) => {
                                                    const estadoColor =
                                                        verificacion.estado === 'APROBADO' ? 'bg-green-50 border-green-200 text-green-900' :
                                                            verificacion.estado === 'OBSERVADO' ? 'bg-yellow-50 border-yellow-200 text-yellow-900' :
                                                                'bg-red-50 border-red-200 text-red-900';

                                                    const estadoIcon =
                                                        verificacion.estado === 'APROBADO' ? '✓' :
                                                            verificacion.estado === 'OBSERVADO' ? '⚠' : '✕';

                                                    return (
                                                        <div key={idx} className={`p-2 rounded border text-xs ${estadoColor}`}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-medium flex items-center gap-1">
                                                                    <span>{estadoIcon}</span>
                                                                    {verificacion.tipo_verificacion}
                                                                </span>
                                                                <span className="text-xs opacity-75">{verificacion.porcentaje_cumplimiento?.toFixed(0)}%</span>
                                                            </div>
                                                            {verificacion.detalles && verificacion.detalles.length > 0 && (
                                                                <ul className="text-xs space-y-0.5 opacity-90 pl-4 list-disc">
                                                                    {verificacion.detalles.slice(0, 2).map((detalle: string, dIdx: number) => (
                                                                        <li key={dIdx}>{detalle}</li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* ===== SECCIÓN 3: ESTADÍSTICAS DE FOLIACIÓN ===== */}
                                        <div className="pt-2 border-t">
                                            {/* Resumen de problemas */}
                                            {!info.isContinuous && (
                                                <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3">
                                                    <p className="text-sm font-medium text-amber-900 mb-2">⚠️ Problemas detectados:</p>
                                                    <ul className="text-xs text-amber-800 space-y-1 list-disc pl-4">
                                                        {info.pagesWithoutDetections > 0 && (
                                                            <li>{info.pagesWithoutDetections} página(s) sin folio detectado</li>
                                                        )}
                                                        {(info.totalPages - info.pagesWithExactMatch) > 0 && (
                                                            <li>{info.totalPages - info.pagesWithExactMatch} página(s) con folio que no coincide</li>
                                                        )}
                                                        {info.lowConfidenceCount > 0 && (
                                                            <li>{info.lowConfidenceCount} detección(es) con baja confianza</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="bg-white rounded p-2 border">
                                                    <p className="text-xs text-gray-500">Total páginas</p>
                                                    <p className="text-lg font-semibold text-gray-900">{info.totalPages}</p>
                                                </div>
                                                <div className="bg-white rounded p-2 border">
                                                    <p className="text-xs text-gray-500">Último folio</p>
                                                    <p className="text-lg font-semibold text-gray-900">{info.lastFolio || 'N/A'}</p>
                                                </div>
                                                <div className="bg-white rounded p-2 border">
                                                    <p className="text-xs text-gray-500">Detecciones</p>
                                                    <p className="text-lg font-semibold text-gray-900">{info.detectionsCount}</p>
                                                </div>
                                                <div className="bg-white rounded p-2 border">
                                                    <p className="text-xs text-gray-500">Confianza promedio</p>
                                                    <p className="text-lg font-semibold text-gray-900">
                                                        {Math.round(info.averageConfidence * 100)}%
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-600">Páginas con detección:</span>
                                                    <span className="font-medium">{info.pagesWithDetections}/{info.totalPages}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-600">Páginas con coincidencia exacta:</span>
                                                    <span className="font-medium">{info.pagesWithExactMatch}/{info.totalPages}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-600">Foliación continua:</span>
                                                    <span className={`font-medium ${info.isContinuous ? 'text-green-600' : 'text-red-600'}`}>
                                                        {info.isContinuous ? 'Sí' : 'No'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-600">Legibilidad:</span>
                                                    <span className={`font-medium ${info.legibilityScore === 'alta' ? 'text-green-600' :
                                                        info.legibilityScore === 'media' ? 'text-yellow-600' : 'text-red-600'
                                                        }`}>
                                                        {info.legibilityScore.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t">
                                                <p className="text-xs text-gray-500 mb-1">Arquitectura:</p>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                                        ☁️ Detección: Roboflow Cloud
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700">
                                                        💻 OCR: Local
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Detalle de páginas con problemas */}
                                            <div className="pt-3 border-t">
                                                <p className="text-xs font-medium text-gray-700 mb-2">Detalle por página:</p>
                                                <div className="max-h-64 overflow-y-auto space-y-1">
                                                    {resultado.pages && resultado.pages.map((page: any) => {
                                                        const hasDetections = page.predictions && page.predictions.length > 0;
                                                        const detectedDigits = hasDetections
                                                            ? page.predictions.find((p: any) => p.ocr_digits)?.ocr_digits
                                                            : null;
                                                        const foliationCheck = hasDetections
                                                            ? page.predictions.find((p: any) => p.foliation_check)?.foliation_check
                                                            : null;
                                                        const isMatch = foliationCheck?.match === true;
                                                        const hasError = !!page.error;

                                                        // Determinar el estado de la página
                                                        let statusColor = 'bg-gray-100 text-gray-700';
                                                        let statusText = 'Sin revisar';
                                                        let statusIcon = '○';

                                                        if (hasError) {
                                                            statusColor = 'bg-red-50 text-red-700 border-red-200';
                                                            statusText = 'Error al procesar';
                                                            statusIcon = '✕';
                                                        } else if (!hasDetections) {
                                                            statusColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
                                                            statusText = 'Sin folio detectado';
                                                            statusIcon = '⚠';
                                                        } else if (!detectedDigits) {
                                                            statusColor = 'bg-orange-50 text-orange-700 border-orange-200';
                                                            statusText = 'Sin número legible';
                                                            statusIcon = '⚠';
                                                        } else if (isMatch) {
                                                            statusColor = 'bg-green-50 text-green-700 border-green-200';
                                                            statusText = `Folio ${detectedDigits} ✓`;
                                                            statusIcon = '✓';
                                                        } else {
                                                            statusColor = 'bg-red-50 text-red-700 border-red-200';
                                                            statusText = `Folio ${detectedDigits} (esperado: ${page.page_number})`;
                                                            statusIcon = '✕';
                                                        }

                                                        return (
                                                            <div
                                                                key={page.page_number}
                                                                className={`flex items-center justify-between px-2 py-1 rounded border text-xs ${statusColor}`}
                                                            >
                                                                <span className="font-mono">
                                                                    <span className="font-semibold">{statusIcon}</span> Página {page.page_number}
                                                                </span>
                                                                <span className="text-right">
                                                                    {statusText}
                                                                    {foliationCheck && !isMatch && foliationCheck.diff !== null && (
                                                                        <span className="ml-1 text-xs opacity-75">
                                                                            (Δ{foliationCheck.diff})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
    );
}
