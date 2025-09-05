import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCcw, FileDown, Eye, EyeOff } from "lucide-react";

type Expediente = {
    id: string;
    nombre: string;
    ruta_archivo: string;
    tipo: "costos_presupuestos" | "expediente_tecnico";
    fecha_creacion: string;
    estado: "pendiente" | "evaluado" | "archivado";
};

type ExpedienteDetailResp = {
    success: boolean;
    expediente: Expediente;
    analisis: string | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

// helper simple para contar observaciones numeradas (1., 2., 3., ...)
const countObservations = (text: string) => {
    return (
        (text.match(/^\s*\d+\./gm) || []).length ||
        (text.match(/\d\./g) || []).length ||
        0
    );
};

export default function ResultadosCostos() {
    const [items, setItems] = useState<Expediente[]>([]);
    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState<Record<string, string>>({}); // id -> análisis (markdown)
    const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // id -> open/close
    const [error, setError] = useState<string | null>(null);

    const fetchList = async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await fetch(`${API_BASE}/api/expedientes`);
            if (!r.ok) throw new Error(`Error listando expedientes (${r.status})`);
            const j = await r.json();
            const all: Expediente[] = j?.expedientes || [];
            // filtra solo costos_presupuestos
            setItems(all.filter((e) => e.tipo === "costos_presupuestos"));
        } catch (e: unknown) {
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError("Error desconocido");
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (id: string) => {
        // si ya lo tenemos, solo toggle
        if (detail[id]) {
            setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
            return;
        }
        setExpanded((prev) => ({ ...prev, [id]: true }));
        try {
            const r = await fetch(`${API_BASE}/api/expedientes/${id}`);
            if (!r.ok) throw new Error(`Error obteniendo análisis (${r.status})`);
            const j: ExpedienteDetailResp = await r.json();
            setDetail((prev) => ({ ...prev, [id]: j?.analisis || "" }));
        } catch (e) {
            setDetail((prev) => ({ ...prev, [id]: "No se pudo cargar el análisis." }));
        }
    };

    useEffect(() => {
        fetchList();
    }, []);

    const nothingToShow = useMemo(
        () => !loading && !error && items.length === 0,
        [loading, error, items.length]
    );

    return (
        <Card>
            <CardHeader className="flex items-center justify-between">
                <CardTitle>Resultados recientes (Costos y Presupuestos)</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchList}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                    </div>
                )}

                {error && (
                    <div className="text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {nothingToShow && (
                    <div className="text-sm text-muted-foreground">
                        Aún no hay expedientes evaluados de costos/presupuestos.
                    </div>
                )}

                {items.map((e) => {
                    const analisis = detail[e.id];
                    const isOpen = !!expanded[e.id];
                    const totalObs = analisis ? countObservations(analisis) : null;
                    const fileUrl = `${API_BASE}/public/uploads/${encodeURIComponent(e.ruta_archivo)}`;

                    return (
                        <div key={e.id} className="p-4 rounded-lg border bg-muted/40 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="font-medium truncate">{e.nombre}</div>
                                    <div className="text-xs text-muted-foreground">
                                        ID: {e.id} • Fecha: {new Date(e.fecha_creacion).toLocaleString()} • Tipo: {e.tipo}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant={e.estado === "evaluado" ? "default" : e.estado === "pendiente" ? "secondary" : "outline"}
                                    >
                                        {e.estado}
                                    </Badge>
                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" size="sm" title="Descargar/abrir archivo">
                                            <FileDown className="h-4 w-4 mr-2" />
                                            Archivo
                                        </Button>
                                    </a>
                                    <Button
                                        size="sm"
                                        onClick={() => fetchDetail(e.id)}
                                        variant={isOpen ? "secondary" : "default"}
                                    >
                                        {isOpen ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                                        {isOpen ? "Ocultar" : "Ver análisis"}
                                    </Button>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="rounded-md border bg-background p-3">
                                    {analisis ? (
                                        <>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-sm font-semibold">Análisis</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {typeof totalObs === "number" ? `Observaciones: ${totalObs}` : "Cargando…"}
                                                </div>
                                            </div>
                                            {/* Mostramos el texto tal cual (markdown-like) */}
                                            <pre className="whitespace-pre-wrap text-sm leading-6">{analisis}</pre>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Cargando análisis…
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
