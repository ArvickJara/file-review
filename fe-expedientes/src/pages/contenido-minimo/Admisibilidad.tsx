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
    ShieldCheck
} from 'lucide-react';
import { useProyectoIdFromRoute } from '@/hooks/useProyectoId';

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
                        <button
                            onClick={guardarEnLocal}
                            disabled={saving || !tomos.length}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${tomos.length ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Guardar progreso
                        </button>
                        <button
                            onClick={limpiarEvaluacion}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                            Resetear
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                    Esta vista verifica tres aspectos exigidos en la etapa de admisibilidad: (1) ausencia de hojas en blanco, (2) foliación completa y consecutiva, y (3) legibilidad del texto, del número de folio y de las imágenes.
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
        </div>
    );
}
