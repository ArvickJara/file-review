import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
    AlertCircle,
    CheckCircle2,
    FileText,
    Loader2,
    Brain,
    Images,
    ClipboardList,
    Download,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const SELECTED_PROYECTO_KEY = 'selectedProyectoId';

type Documento = {
    id: string;
    nombre?: string;
    nombre_archivo?: string;
    fecha_creacion?: string;
    estado?: string;
    proyecto_id: string;
    orden?: number; // 0 = TDR, 1..n = tomos
};

type Proyecto = {
    id: string;
    nombre?: string;
    codigo_proyecto?: string;
    entidad_ejecutora?: string;
};

type ResultadoContenidoMinimo = {
    cumplimiento_general: 'CUMPLE' | 'INCOMPLETO' | 'NO CUMPLE' | 'ERROR';
    puntaje_total: number; // 0..100
    paginas_analizadas: number;
    items_obligatorios_faltantes: string[];
    items_recomendados_faltantes?: string[];
    secciones: {
        [nombre: string]: {
            cumple: boolean;
            puntaje: number; // 0..100
            observaciones?: string;
            faltantes?: string[];
            evidencias?: string[];
        };
    };
    recomendaciones?: string[];
    // cuando el backend no pudo parsear JSON del modelo
    error_detalle?: string;
};

type StorageInfo = {
    base: string;
    tomos: Array<{ id: string; nombre?: string; dir: string; paginas: number }>;
};

function useProyectoIdFromRoute() {
    const params = useParams<{ proyectoId?: string }>();
    const [search] = useSearchParams();
    const fromRoute = params.proyectoId || search.get('proyectoId') || '';
    if (fromRoute) return fromRoute;
    try {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(SELECTED_PROYECTO_KEY) || '';
        }
    } catch {
        // Intentionally ignored
    }
    return '';
}

export default function ContenidoMinimo() {
    const proyectoId = useProyectoIdFromRoute();

    const [loading, setLoading] = useState(false);
    const [evaluating, setEvaluating] = useState(false);
    const [force, setForce] = useState(false);
    const [proyecto, setProyecto] = useState<Proyecto | null>(null);
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [resultado, setResultado] = useState<ResultadoContenidoMinimo | null>(null);
    const [storage, setStorage] = useState<StorageInfo | null>(null);

    // TDR: por orden=0, y fallback por nombre que contenga "tdr"
    const tdr = useMemo(
        () =>
            documentos.find((d) => (d.orden ?? 0) === 0) ||
            documentos.find((d) => (d.nombre || d.nombre_archivo || '').toLowerCase().includes('tdr')),
        [documentos]
    );

    // Tomos: orden>0; si no hay orden, toma los que no parecen TDR
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
        const ac = new AbortController();
        (async () => {
            setLoading(true);
            try {
                const p = await fetch(`${API_BASE}/api/proyectos/${proyectoId}`, { signal: ac.signal });
                if (p.ok) {
                    const pj = await p.json();
                    setProyecto(pj.proyecto || null);
                }
                const d = await fetch(`${API_BASE}/api/expedientes_tecnicos/documentos/${proyectoId}`, {
                    signal: ac.signal,
                });
                if (d.ok) {
                    const dj = await d.json();
                    setDocumentos(Array.isArray(dj.documentos) ? dj.documentos : []);
                }
            } catch (e: any) {
                if (e?.name !== 'AbortError') console.error(e);
            } finally {
                setLoading(false);
            }
        })();
        return () => ac.abort();
    }, [proyectoId]);

    const canEvaluate = !!proyectoId && !!tdr && tomos.length > 0 && !evaluating;

    const empezarEvaluacion = async () => {
        if (!canEvaluate || !proyectoId || !tdr) return;
        setEvaluating(true);
        setResultado(null);
        setStorage(null);
        try {
            const form = new FormData();
            form.append('proyecto_id', proyectoId);
            form.append('tdr_id', tdr.id);
            tomos.forEach((t) => form.append('tomo_ids[]', t.id)); // forma estándar
            form.append('tomo_ids_csv', tomos.map((t) => t.id).join(',')); // fallback
            if (force) form.append('force', 'true');

            // Depuración opcional:
            // for (const [k, v] of form.entries()) console.log('FD:', k, v);

            const resp = await fetch(`${API_BASE}/api/expedientes_tecnicos/evaluar-contenido-minimo`, {
                method: 'POST',
                body: form,
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) {
                console.error('Backend payload:', data);
                alert(data.message || 'Error al evaluar contenido mínimo');
                return;
            }
            setResultado(data.evaluacion as ResultadoContenidoMinimo);
            setStorage(data.storage as StorageInfo);
        } catch (e) {
            console.error(e);
            alert('Error de conexión al servidor');
        } finally {
            setEvaluating(false);
        }
    };

    if (!proyectoId) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-700" />
                    <div>
                        <p className="text-sm text-yellow-800">No se encontró el ID del proyecto.</p>
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
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Evaluación de Contenido Mínimo</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Proyecto: <strong>{proyecto?.nombre || proyecto?.codigo_proyecto || proyectoId}</strong>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Se comparará el TDR vs todos los tomos del expediente técnico. Prioridad: memoria descriptiva.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Toggle force */}
                        <label className="flex items-center gap-2 text-xs text-gray-600">
                            <input
                                type="checkbox"
                                checked={force}
                                onChange={(e) => setForce(e.target.checked)}
                                disabled={evaluating}
                            />
                            Reprocesar (force)
                        </label>

                        <button
                            onClick={empezarEvaluacion}
                            disabled={!canEvaluate}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium ${canEvaluate ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                }`}
                            title={!tdr ? 'Falta TDR' : tomos.length === 0 ? 'Faltan tomos' : 'Iniciar evaluación'}
                            aria-busy={evaluating}
                        >
                            {evaluating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Evaluando…
                                </>
                            ) : (
                                <>
                                    <Brain className="h-4 w-4" />
                                    Empezar evaluación
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Fuentes requeridas */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Documentos detectados</h2>
                {loading ? (
                    <div className="flex items-center gap-2 text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando…
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-start gap-3">
                                <FileText className="h-5 w-5 text-gray-700 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">TDR del proyecto</p>
                                    {tdr ? (
                                        <div className="mt-1 flex items-center gap-2 text-sm">
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            <span className="text-gray-800">{tdr.nombre || tdr.nombre_archivo || tdr.id}</span>
                                        </div>
                                    ) : (
                                        <div className="mt-1 flex items-center gap-2 text-sm">
                                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                                            <span className="text-gray-700">
                                                No se encontró TDR.{' '}
                                                <Link to="/proyectos" className="underline text-blue-700">
                                                    Cargar
                                                </Link>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border rounded-lg">
                            <div className="flex items-start gap-3">
                                <Images className="h-5 w-5 text-gray-700 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Tomos del expediente</p>
                                    {tomos.length > 0 ? (
                                        <div className="mt-1 text-sm text-gray-800">
                                            <CheckCircle2 className="inline h-4 w-4 text-green-600 mr-1" />
                                            {tomos.length} tomo(s) detectado(s)
                                            <ul className="mt-2 list-disc pl-5 text-xs text-gray-600 space-y-1">
                                                {tomos.slice(0, 5).map((t) => (
                                                    <li key={t.id}>
                                                        {t.orden ? `Tomo ${t.orden}: ` : ''}
                                                        {t.nombre || t.nombre_archivo || t.id}
                                                    </li>
                                                ))}
                                                {tomos.length > 5 && <li>… y {tomos.length - 5} más</li>}
                                            </ul>
                                        </div>
                                    ) : (
                                        <div className="mt-1 flex items-center gap-2 text-sm">
                                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                                            <span className="text-gray-700">
                                                No hay tomos.{' '}
                                                <Link to="/proyectos" className="underline text-blue-700">
                                                    Cargar
                                                </Link>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {evaluating && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                        <p className="font-medium">Procesando:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                            <li>Extrayendo texto del TDR</li>
                            <li>Convirtiendo todos los tomos a imágenes de alta resolución</li>
                            <li>Priorizando análisis de memoria descriptiva</li>
                            <li>Comparando con el TDR y verificando contenido mínimo</li>
                        </ul>
                    </div>
                )}
            </div>

            {/* Resultados */}
            {resultado && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Resultado de evaluación</h2>
                        <button
                            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                            onClick={() => {
                                const blob = new Blob([JSON.stringify({ proyecto, resultado, storage }, null, 2)], {
                                    type: 'application/json',
                                });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `contenido_minimo_${proyecto?.codigo_proyecto || proyecto?.id || 'proyecto'}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            <Download className="h-3 w-3 inline mr-1" />
                            Exportar JSON
                        </button>
                    </div>

                    <div
                        className={`p-4 rounded-lg mb-6 ${resultado.cumplimiento_general === 'CUMPLE'
                            ? 'bg-green-50 border border-green-200'
                            : resultado.cumplimiento_general === 'INCOMPLETO'
                                ? 'bg-yellow-50 border border-yellow-200'
                                : resultado.cumplimiento_general === 'ERROR'
                                    ? 'bg-gray-50 border border-gray-200'
                                    : 'bg-red-50 border border-red-200'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-semibold">{resultado.cumplimiento_general}</p>
                                <p className="text-sm opacity-75">Puntaje total: {resultado.puntaje_total}/100</p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                                {resultado.paginas_analizadas} páginas analizadas
                            </span>
                        </div>
                    </div>

                    {/* Mostrar error_detalle si el modelo no envió JSON válido */}
                    {resultado.cumplimiento_general === 'ERROR' && resultado.error_detalle && (
                        <div className="mt-4 p-3 bg-gray-50 border rounded text-xs text-gray-700">
                            <div className="font-medium mb-1">Detalle de error (modelo):</div>
                            <pre className="whitespace-pre-wrap break-words">{resultado.error_detalle}</pre>
                        </div>
                    )}

                    {/* Faltantes globales */}
                    {resultado.items_obligatorios_faltantes?.length > 0 && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
                            <h3 className="font-medium text-red-900 mb-2">Obligatorios faltantes</h3>
                            <ul className="text-sm text-red-800 list-disc pl-5 space-y-1">
                                {resultado.items_obligatorios_faltantes.map((i, idx) => (
                                    <li key={idx}>{i}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Secciones */}
                    {resultado.secciones && (
                        <div className="space-y-4">
                            {Object.entries(resultado.secciones).map(([nombre, sec]) => (
                                <div key={nombre} className="border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-medium capitalize">{nombre.replace(/_/g, ' ')}</h4>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`px-2 py-0.5 rounded text-xs font-medium ${sec.cumple ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {sec.cumple ? 'CUMPLE' : 'NO CUMPLE'}
                                            </span>
                                            <span className="text-sm font-semibold">{sec.puntaje}/100</span>
                                        </div>
                                    </div>
                                    {sec.observaciones && <p className="text-sm text-gray-600 mb-2">{sec.observaciones}</p>}
                                    {sec.faltantes && sec.faltantes.length > 0 && (
                                        <div className="text-sm">
                                            <p className="font-medium text-gray-800">Faltantes:</p>
                                            <ul className="list-disc pl-5 text-red-700 space-y-1">
                                                {sec.faltantes.map((f, i) => (
                                                    <li key={i}>{f}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {sec.evidencias && sec.evidencias.length > 0 && (
                                        <div className="text-xs text-gray-600 mt-2">
                                            <p className="font-medium">Evidencias detectadas:</p>
                                            <ul className="list-disc pl-5 space-y-1">
                                                {sec.evidencias.map((e, i) => (
                                                    <li key={i}>• {e}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Recomendaciones */}
                    {resultado.recomendaciones && resultado.recomendaciones.length > 0 && (
                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
                            <h3 className="font-medium text-blue-900 mb-2">Recomendaciones</h3>
                            <ul className="text-sm text-blue-800 list-disc pl-5 space-y-1">
                                {resultado.recomendaciones.map((r, i) => (
                                    <li key={i}>{r}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Trazabilidad de derivados (carpetas/archivos) */}
                    {storage && (
                        <div className="mt-6 p-4 bg-gray-50 border rounded text-xs text-gray-700">
                            <div className="font-medium mb-1">Derivados generados</div>
                            <div className="break-all">Base: {storage.base}</div>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                {storage.tomos?.map((t) => (
                                    <li key={t.id}>
                                        {t.nombre || `Tomo ${t.id}`} — {t.paginas} pág. → {t.dir}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Ayuda */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 flex gap-2">
                <ClipboardList className="h-4 w-4 mt-0.5" />
                <div>
                    La evaluación analiza la memoria descriptiva y verifica el contenido mínimo del expediente técnico,
                    comparando el TDR con la evidencia presente en todos los tomos (convertidos a imágenes para análisis visual).
                </div>
            </div>
        </div>
    );
}
