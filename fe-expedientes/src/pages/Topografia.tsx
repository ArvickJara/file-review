import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
    AlertCircle,
    CheckCircle,
    FileText,
    Loader2,
    MapPin,
    Ruler,
    Save,
    Upload as UploadIcon,
    Building2,
    Compass,
    Route,
    BadgeCheck,
    Download,
    RefreshCw,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const SELECTED_PROYECTO_KEY = 'selectedProyectoId';

type Documento = {
    id: string;
    nombre: string;
    fecha_creacion: string;
    estado: string;
    proyecto_id: string;
    orden?: number; // 0 = TDR, 1..n = Tomos
};

type AreaInputs = {
    aSunarp?: number | '';
    aLevantamiento?: number | '';
    entorno: 'urbano' | 'rural' | 'custom';
    toleranciaCustom?: number | '';
};

type EvalTopografia = {
    // 1) Alcance y fundamentación
    objetivos?: string;
    alcance?: string;
    fechaCampo?: string; // ISO
    responsables?: string;
    marcoNormativo?: string;
    zona: 'urbana' | 'rural';
    // 2) Control geodésico
    datum: 'WGS84' | 'PSAD56' | 'ETRS89' | 'Otro';
    proyeccion: 'UTM' | 'PLANO' | 'Otro';
    huso?: string;
    puntosControl?: string;
    bancosNivel?: string;
    instrumentos: ('Estación total' | 'GNSS RTK' | 'GNSS estático' | 'Nivel óptico' | 'Otro')[];
    archivosCrudos: boolean; // libreta / RINEX/.job disponibles
    // 3) Levantamiento
    coberturaOK: boolean;
    escalaPlano?: string;
    intervaloCurvas?: string;
    densidadNotas?: string;
    // 4) Consistencia planialtimétrica
    ajusteRedOK: boolean;
    cierreError?: string;
    datumVertical?: string;
    metodoNivelacion?: string;
    // 5) Vinculación catastral
    areas: AreaInputs;
    cuadroCoordenadasOK: boolean;
    colindanciasOK: boolean;
    notasCatastro?: string;
};

type PersistedDraft = {
    proyectoId: string;
    tdrId?: string;
    tomo1Id?: string;
    lastUpdated: string;
    evaluation: EvalTopografia;
};

function useProyectoIdFromRoute() {
    const params = useParams<{ proyectoId?: string }>();
    const [search] = useSearchParams();
    const fromRoute = params.proyectoId || search.get('proyectoId') || '';
    if (fromRoute) return fromRoute;
    // Fallback: usar el proyecto seleccionado en Upload, guardado en localStorage
    try {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(SELECTED_PROYECTO_KEY) || '';
        }
    } catch (_) { /* ignore */ }
    return '';
}

function percentDiff(a?: number, b?: number) {
    if (!a || !b || a <= 0 || b <= 0) return { pct: NaN, bigger: NaN };
    const bigger = Math.max(a, b);
    const diff = Math.abs(a - b);
    return { pct: (diff * 100) / bigger, bigger };
}

function formatPct(n: number) {
    if (Number.isNaN(n)) return '—';
    return `${n.toFixed(2)} %`;
}

const defaultEval: EvalTopografia = {
    zona: 'urbana',
    datum: 'WGS84',
    proyeccion: 'UTM',
    huso: '18S',
    instrumentos: [],
    archivosCrudos: false,
    coberturaOK: false,
    ajusteRedOK: false,
    areas: { entorno: 'urbano' },
    cuadroCoordenadasOK: false,
    colindanciasOK: false,
};

export default function Topografia() {
    const proyectoId = useProyectoIdFromRoute();
    const [loading, setLoading] = useState(false);
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [evaluation, setEvaluation] = useState<EvalTopografia>(defaultEval);

    const tdr = useMemo(() => documentos.find((d) => (d.orden ?? 0) === 0), [documentos]);
    const tomo1 = useMemo(() => documentos.find((d) => (d.orden ?? 0) === 1), [documentos]);

    const draftKey = useMemo(() => (proyectoId ? `topografia_eval_${proyectoId}` : ''), [proyectoId]);

    // Cargar documentos del proyecto
    useEffect(() => {
        async function loadDocs() {
            if (!proyectoId) return;
            setLoading(true);
            try {
                const resp = await fetch(`${API_BASE}/api/expedientes_tecnicos/documentos/${proyectoId}`);
                if (resp.ok) {
                    const data = await resp.json();
                    setDocumentos(Array.isArray(data.documentos) ? data.documentos : []);
                }
            } catch (e) {
                console.error('Error cargando documentos:', e);
            } finally {
                setLoading(false);
            }
        }
        loadDocs();
    }, [proyectoId]);

    // Cargar borrador si existe
    useEffect(() => {
        if (!draftKey) return;
        try {
            const saved = localStorage.getItem(draftKey);
            if (saved) {
                const parsed: PersistedDraft = JSON.parse(saved);
                if (parsed?.evaluation) setEvaluation({ ...defaultEval, ...parsed.evaluation });
            }
        } catch {
            /* noop */
        }
    }, [draftKey]);

    const saveDraft = () => {
        if (!draftKey) return;
        const data: PersistedDraft = {
            proyectoId,
            tdrId: tdr?.id,
            tomo1Id: tomo1?.id,
            lastUpdated: new Date().toISOString(),
            evaluation,
        };
        localStorage.setItem(draftKey, JSON.stringify(data));
    };

    const clearDraft = () => {
        if (!draftKey) return;
        localStorage.removeItem(draftKey);
        setEvaluation(defaultEval);
    };

    const exportJson = () => {
        const payload = {
            proyectoId,
            referencias: {
                tdr: tdr ? { id: tdr.id, nombre: tdr.nombre } : null,
                tomo1: tomo1 ? { id: tomo1.id, nombre: tomo1.nombre } : null,
            },
            evaluacion: evaluation,
            calculos: {
                diferencia_areas_pct: diffPct,
                tolerancia_aplicable_pct: tolerancePct,
                cumple_vinculacion: cumpleAreas,
            },
            fecha_exportacion: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evaluacion_topografica_${proyectoId}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    // Cálculos de áreas
    const { pct: diffPct } = percentDiff(
        typeof evaluation.areas.aSunarp === 'number' ? evaluation.areas.aSunarp : undefined,
        typeof evaluation.areas.aLevantamiento === 'number' ? evaluation.areas.aLevantamiento : undefined
    );

    const tolerancePct = useMemo(() => {
        if (evaluation.areas.entorno === 'urbano') return 1;
        if (evaluation.areas.entorno === 'rural') return 2;
        const v = evaluation.areas.toleranciaCustom;
        return typeof v === 'number' && v > 0 ? v : NaN;
    }, [evaluation.areas.entorno, evaluation.areas.toleranciaCustom]);

    const cumpleAreas =
        !Number.isNaN(diffPct) &&
        !Number.isNaN(tolerancePct) &&
        diffPct <= tolerancePct;

    // Resumen por secciones (simple: check de cumplimiento)
    const sectionStatus = useMemo(() => {
        const s1 =
            !!evaluation.objetivos &&
            !!evaluation.alcance &&
            !!evaluation.fechaCampo &&
            !!evaluation.responsables &&
            !!evaluation.marcoNormativo;

        const s2 =
            !!evaluation.datum &&
            !!evaluation.proyeccion &&
            !!evaluation.huso &&
            !!evaluation.puntosControl &&
            !!evaluation.bancosNivel &&
            evaluation.instrumentos.length > 0;

        const s3 = evaluation.coberturaOK && !!evaluation.escalaPlano && !!evaluation.intervaloCurvas;

        const s4 = evaluation.ajusteRedOK && (!!evaluation.datumVertical || true);

        const s5 = evaluation.cuadroCoordenadasOK && evaluation.colindanciasOK && cumpleAreas;

        const total = [s1, s2, s3, s4, s5].filter(Boolean).length;
        return { s1, s2, s3, s4, s5, total, aprobado: total >= 4 && cumpleAreas };
    }, [evaluation, cumpleAreas]);

    if (!proyectoId) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center space-x-3">
                    <AlertCircle className="h-5 w-5 text-yellow-700" />
                    <div>
                        <p className="text-sm text-yellow-800">
                            No se encontró el ID del proyecto. Abre esta vista con la ruta /topografia/:proyectoId o ?proyectoId=.
                        </p>
                        <Link to="/upload" className="text-sm text-blue-700 underline">
                            Ir a gestión de expedientes
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Encabezado */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Evaluación Topográfica</h1>
                        <p className="text-sm text-gray-600">Proyecto: {proyectoId} • La evaluación se basa en el Tomo 1 del Expediente</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={saveDraft}
                            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm px-3 py-2 rounded-md hover:bg-blue-700"
                            title="Guardar borrador en este equipo"
                        >
                            <Save className="h-4 w-4" /> Guardar borrador
                        </button>
                        <button
                            onClick={exportJson}
                            className="inline-flex items-center gap-2 bg-emerald-600 text-white text-sm px-3 py-2 rounded-md hover:bg-emerald-700"
                            title="Exportar evaluación a JSON"
                        >
                            <Download className="h-4 w-4" /> Exportar JSON
                        </button>
                        <button
                            onClick={clearDraft}
                            className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 text-sm px-3 py-2 rounded-md hover:bg-gray-200"
                            title="Limpiar formulario"
                        >
                            <RefreshCw className="h-4 w-4" /> Limpiar
                        </button>
                    </div>
                </div>
            </div>

            {/* Referencias requeridas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Referencias del expediente</h2>
                {loading ? (
                    <div className="flex items-center gap-2 text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando documentos...
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-3 border rounded-lg">
                            <div className="flex items-start gap-3">
                                <FileText className="h-5 w-5 text-gray-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">TDR del Proyecto (orden 0)</p>
                                    {tdr ? (
                                        <div className="mt-1 flex items-center gap-2 text-sm">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <span className="text-gray-800">{tdr.nombre}</span>
                                        </div>
                                    ) : (
                                        <div className="mt-1 flex items-center gap-2 text-sm">
                                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                                            <span className="text-gray-700">
                                                Falta el TDR. Cárgalo en <Link className="text-blue-700 underline" to="/upload">“Subir Archivos”</Link>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-3 border rounded-lg">
                            <div className="flex items-start gap-3">
                                <FileText className="h-5 w-5 text-gray-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">Tomo 1 (Topografía) requerido</p>
                                    {tomo1 ? (
                                        <div className="mt-1 flex items-center gap-2 text-sm">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <span className="text-gray-800">{tomo1.nombre}</span>
                                        </div>
                                    ) : (
                                        <div className="mt-1 flex items-center gap-2 text-sm">
                                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                                            <span className="text-gray-700">
                                                No se encontró el Tomo 1. Súbelo en{' '}
                                                <Link className="text-blue-700 underline" to="/upload">“Evaluar Expediente”</Link>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 1) Alcance y fundamentación */}
            <Section title="1) Alcance y fundamentación" icon={<MapPin className="h-4 w-4" />}>
                <div className="grid md:grid-cols-2 gap-4">
                    <TextArea
                        label="Memoria del estudio (objetivos, alcance/área de intervención)"
                        value={evaluation.objetivos || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, objetivos: v }))}
                    />
                    <TextArea
                        label="Alcance detallado (frentes, accesos, obras exteriores)"
                        value={evaluation.alcance || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, alcance: v }))}
                    />
                    <Input
                        label="Fecha de trabajo de campo"
                        type="date"
                        value={evaluation.fechaCampo || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, fechaCampo: v }))}
                    />
                    <TextArea
                        label="Responsables (firma/colegiatura)"
                        value={evaluation.responsables || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, responsables: v }))}
                    />
                    <TextArea
                        label="Marco normativo y estándares (RNE/IGN/SUNARP)"
                        value={evaluation.marcoNormativo || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, marcoNormativo: v }))}
                    />
                    <Select
                        label="Zona y extensión"
                        value={evaluation.zona}
                        options={[
                            { label: 'Urbana', value: 'urbana' },
                            { label: 'Rural', value: 'rural' },
                        ]}
                        onChange={(v) => setEvaluation((e) => ({ ...e, zona: v as 'urbana' | 'rural' }))}
                    />
                </div>
            </Section>

            {/* 2) Control geodésico y referencias */}
            <Section title="2) Control geodésico y referencias" icon={<Compass className="h-4 w-4" />}>
                <div className="grid md:grid-cols-3 gap-4">
                    <Select
                        label="Datum"
                        value={evaluation.datum}
                        options={[
                            { label: 'WGS84', value: 'WGS84' },
                            { label: 'PSAD56', value: 'PSAD56' },
                            { label: 'ETRS89', value: 'ETRS89' },
                            { label: 'Otro', value: 'Otro' },
                        ]}
                        onChange={(v) => setEvaluation((e) => ({ ...e, datum: v as EvalTopografia['datum'] }))}
                    />
                    <Select
                        label="Proyección"
                        value={evaluation.proyeccion}
                        options={[
                            { label: 'UTM', value: 'UTM' },
                            { label: 'PLANO', value: 'PLANO' },
                            { label: 'Otro', value: 'Otro' },
                        ]}
                        onChange={(v) => setEvaluation((e) => ({ ...e, proyeccion: v as EvalTopografia['proyeccion'] }))}
                    />
                    <Input
                        label="Huso (ej. 18S)"
                        value={evaluation.huso || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, huso: v }))}
                    />
                    <TextArea
                        label="Puntos de control y bancos de nivel (coordenadas/cotas, croquis)"
                        value={evaluation.puntosControl || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, puntosControl: v }))}
                    />
                    <TextArea
                        label="Bancos de nivel / método y precisión alcanzada"
                        value={evaluation.bancosNivel || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, bancosNivel: v }))}
                    />
                    <CheckboxGroup
                        label="Instrumentación y métodos"
                        options={['Estación total', 'GNSS RTK', 'GNSS estático', 'Nivel óptico', 'Otro']}
                        values={evaluation.instrumentos}
                        onChange={(vals) => setEvaluation((e) => ({ ...e, instrumentos: vals as EvalTopografia['instrumentos'] }))}
                    />
                    <Toggle
                        label="Libretas/archivos crudos disponibles (RINEX/.job)"
                        checked={evaluation.archivosCrudos}
                        onChange={(v) => setEvaluation((e) => ({ ...e, archivosCrudos: v }))}
                    />
                </div>
            </Section>

            {/* 3) Levantamiento y densidad */}
            <Section title="3) Levantamiento y densidad de datos" icon={<Route className="h-4 w-4" />}>
                <div className="grid md:grid-cols-3 gap-4">
                    <Toggle
                        label="Cobertura abarca todo el polígono e influencias"
                        checked={evaluation.coberturaOK}
                        onChange={(v) => setEvaluation((e) => ({ ...e, coberturaOK: v }))}
                    />
                    <Input
                        label="Escala del plano (ej. 1:500)"
                        value={evaluation.escalaPlano || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, escalaPlano: v }))}
                    />
                    <Input
                        label="Intervalo de curvas (ej. 0.5 m)"
                        value={evaluation.intervaloCurvas || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, intervaloCurvas: v }))}
                    />
                    <TextArea
                        label="Notas sobre densidad/resolución (secciones, perfiles)"
                        value={evaluation.densidadNotas || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, densidadNotas: v }))}
                    />
                </div>
            </Section>

            {/* 4) Georreferenciación y consistencia */}
            <Section title="4) Georreferenciación y consistencia planialtimétrica" icon={<Ruler className="h-4 w-4" />}>
                <div className="grid md:grid-cols-3 gap-4">
                    <Toggle
                        label="Ajuste de redes y consistencia XY/Z verificados"
                        checked={evaluation.ajusteRedOK}
                        onChange={(v) => setEvaluation((e) => ({ ...e, ajusteRedOK: v }))}
                    />
                    <Input
                        label="Errores / cierres (describe y cuantifica)"
                        value={evaluation.cierreError || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, cierreError: v }))}
                    />
                    <Input
                        label="Datum vertical / referencia de cotas (si aplica)"
                        value={evaluation.datumVertical || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, datumVertical: v }))}
                    />
                    <Input
                        label="Método de nivelación y control de errores"
                        value={evaluation.metodoNivelacion || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, metodoNivelacion: v }))}
                    />
                </div>
            </Section>

            {/* 5) Vinculación catastral/registral */}
            <Section title="5) Vinculación catastral / registral" icon={<Building2 className="h-4 w-4" />}>
                <div className="grid md:grid-cols-3 gap-4">
                    <InputNumber
                        label="Área SUNARP (m²)"
                        value={evaluation.areas.aSunarp ?? ''}
                        onChange={(n) => setEvaluation((e) => ({ ...e, areas: { ...e.areas, aSunarp: n } }))}
                    />
                    <InputNumber
                        label="Área Levantamiento (m²)"
                        value={evaluation.areas.aLevantamiento ?? ''}
                        onChange={(n) => setEvaluation((e) => ({ ...e, areas: { ...e.areas, aLevantamiento: n } }))}
                    />
                    <Select
                        label="Entorno"
                        value={evaluation.areas.entorno}
                        options={[
                            { label: 'Urbano (≤ 1%)', value: 'urbano' },
                            { label: 'Rural (≤ 2%)', value: 'rural' },
                            { label: 'Personalizado', value: 'custom' },
                        ]}
                        onChange={(v) => setEvaluation((e) => ({ ...e, areas: { ...e.areas, entorno: v as AreaInputs['entorno'] } }))}
                    />
                    {evaluation.areas.entorno === 'custom' && (
                        <InputNumber
                            label="Tolerancia personalizada (%)"
                            value={evaluation.areas.toleranciaCustom ?? ''}
                            onChange={(n) => setEvaluation((e) => ({ ...e, areas: { ...e.areas, toleranciaCustom: n } }))}
                        />
                    )}
                    <div className="md:col-span-3 p-3 rounded-lg border bg-gray-50 text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BadgeCheck className={`h-4 w-4 ${cumpleAreas ? 'text-green-600' : 'text-red-600'}`} />
                            <span>
                                Diferencia porcentual: <strong>{formatPct(diffPct)}</strong> • Tolerancia aplicable:{' '}
                                <strong>{Number.isNaN(tolerancePct) ? '—' : `${tolerancePct}%`}</strong>
                            </span>
                        </div>
                        <div>
                            {cumpleAreas ? (
                                <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-medium">OK</span>
                            ) : (
                                <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-medium">OBSERVADO</span>
                            )}
                        </div>
                    </div>

                    <Toggle
                        label="Cuadro de coordenadas del perímetro levantado presente"
                        checked={evaluation.cuadroCoordenadasOK}
                        onChange={(v) => setEvaluation((e) => ({ ...e, cuadroCoordenadasOK: v }))}
                    />
                    <Toggle
                        label="Respeta linderos/colindancias o documenta diferencias"
                        checked={evaluation.colindanciasOK}
                        onChange={(v) => setEvaluation((e) => ({ ...e, colindanciasOK: v }))}
                    />
                    <TextArea
                        label="Notas de vinculación catastral/registral"
                        value={evaluation.notasCatastro || ''}
                        onChange={(v) => setEvaluation((e) => ({ ...e, notasCatastro: v }))}
                    />
                </div>
            </Section>

            {/* Resumen final */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Resumen de cumplimiento</h3>
                <div className="grid md:grid-cols-5 gap-2 text-sm">
                    <StatusPill ok={sectionStatus.s1} label="Alcance" />
                    <StatusPill ok={sectionStatus.s2} label="Control geodésico" />
                    <StatusPill ok={sectionStatus.s3} label="Levantamiento" />
                    <StatusPill ok={sectionStatus.s4} label="Consistencia" />
                    <StatusPill ok={sectionStatus.s5} label="Vinculación" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                        Secciones cumplidas: <strong>{sectionStatus.total}/5</strong>
                    </div>
                    <div>
                        {sectionStatus.aprobado ? (
                            <span className="px-3 py-1 rounded bg-green-100 text-green-800 text-sm font-medium">APROBADO</span>
                        ) : (
                            <span className="px-3 py-1 rounded bg-yellow-100 text-yellow-800 text-sm font-medium">
                                EN REVISIÓN / OBSERVADO
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Ayuda */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 flex gap-2">
                <UploadIcon className="h-4 w-4 mt-0.5" />
                <div>
                    La evaluación topográfica se basa en el Tomo 1. Si el Tomo 1 no aparece, súbelo desde la vista “Subir Archivos”
                    en la pestaña “Evaluar Expediente”.
                </div>
            </div>
        </div>
    );
}

/* ---------- Componentes UI simples ---------- */

function Section({
    title,
    children,
    icon,
}: {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-2">
                {icon}
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

function Input({
    label,
    value,
    onChange,
    type = 'text',
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
}) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
            />
        </div>
    );
}

function InputNumber({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number | '' | undefined;
    onChange: (n: number | '') => void;
}) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">{label}</label>
            <input
                type="number"
                inputMode="decimal"
                step="any"
                value={value === '' || value === undefined ? '' : value}
                onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') onChange('');
                    else onChange(Number(v));
                }}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
            />
        </div>
    );
}

function TextArea({
    label,
    value,
    onChange,
    rows = 4,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    rows?: number;
}) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">{label}</label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={rows}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
            />
        </div>
    );
}

function Select({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { label: string; value: string }[];
}) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 bg-white"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function CheckboxGroup({
    label,
    options,
    values,
    onChange,
}: {
    label: string;
    options: string[];
    values: string[];
    onChange: (vals: string[]) => void;
}) {
    return (
        <div className="space-y-2 md:col-span-3">
            <div className="text-xs font-medium text-gray-700">{label}</div>
            <div className="flex flex-wrap gap-3">
                {options.map((opt) => {
                    const checked = values.includes(opt);
                    return (
                        <label key={opt} className="inline-flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={checked}
                                onChange={(e) => {
                                    if (e.target.checked) onChange([...values, opt]);
                                    else onChange(values.filter((v) => v !== opt));
                                }}
                            />
                            <span>{opt}</span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

function Toggle({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label className="flex items-center gap-3">
            <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="text-sm text-gray-800">{label}</span>
        </label>
    );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
    return (
        <div
            className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${ok ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                }`}
        >
            {ok ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />} {label}
        </div>
    );
}