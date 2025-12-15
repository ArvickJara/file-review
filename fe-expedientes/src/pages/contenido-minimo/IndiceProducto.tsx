import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, FileText, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProyectoIdFromRoute } from '@/hooks/useProyectoId';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

interface AnalisisResult {
    producto: {
        id: number;
        nombre: string;
    };
    archivo: {
        id: number;
        nombre: string;
    };
    indiceExplicito: {
        encontrado: boolean;
        items: any[];
        total: number;
    };
    indiceAutomatico: {
        items: any[];
        total: number;
    };
    comparacionInterna: {
        coincidencias: number;
        faltantes: number;
        extras: number;
        consistencia: string;
        detalles: any;
    };
    cumplimientoTdr: {
        requisitosEncontrados: number;
        requisitosFaltantes: number;
        obligatoriosFaltantes: number;
        porcentajeCumplimiento: string;
        detalles: any;
    };
}

export default function IndiceProducto() {
    const proyectoId = useProyectoIdFromRoute();
    const [searchParams] = useSearchParams();
    const productoId = searchParams.get('productoId');

    const [loading, setLoading] = useState(false);
    const [analisis, setAnalisis] = useState<AnalisisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const analizarIndice = async () => {
        if (!productoId) {
            setError('No se ha seleccionado un producto');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/productos/${productoId}/analizar-indice`, {
                method: 'POST'
            });

            const data = await response.json();
            if (data.success) {
                setAnalisis(data);
            } else {
                setError(data.message || 'Error al analizar el índice');
            }
        } catch (err: any) {
            setError('Error de conexión: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">Contenidos mínimos</p>
                <h1 className="text-2xl font-bold text-gray-900">Índice del producto</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Proyecto activo: <strong>{proyectoId || 'sin seleccionar'}</strong>
                </p>
                {productoId && (
                    <p className="text-sm text-gray-600">
                        Producto ID: <strong>{productoId}</strong>
                    </p>
                )}
            </div>

            {!productoId && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-sm text-yellow-900">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        <p>No se ha seleccionado un producto. Por favor, selecciona un producto desde la sección de Productos.</p>
                    </div>
                </div>
            )}

            {productoId && !analisis && !loading && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <p className="text-gray-700 mb-4">
                        Haz clic en el botón para analizar el índice del producto y verificar el cumplimiento con el TDR.
                    </p>
                    <button
                        onClick={analizarIndice}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                        <FileText className="h-5 w-5" />
                        <span>Analizar Índice del Producto</span>
                    </button>
                </div>
            )}

            {loading && (
                <div className="bg-white border border-gray-200 rounded-lg p-12 flex flex-col items-center justify-center">
                    <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                    <p className="text-gray-700 font-medium">Analizando documento...</p>
                    <p className="text-sm text-gray-500 mt-2">Esto puede tomar unos momentos</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-sm text-red-900">
                    <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5" />
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {analisis && (
                <div className="space-y-6">
                    {/* Información del Archivo */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-blue-900 mb-2">Archivo Analizado</h2>
                        <p className="text-sm text-blue-800">
                            <strong>Producto:</strong> {analisis.producto.nombre}
                        </p>
                        <p className="text-sm text-blue-800">
                            <strong>Archivo:</strong> {analisis.archivo.nombre}
                        </p>
                    </div>

                    {/* Resumen de Resultados */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-gray-700">Índice Explícito</h3>
                                {analisis.indiceExplicito.encontrado ? (
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-red-600" />
                                )}
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{analisis.indiceExplicito.total}</p>
                            <p className="text-xs text-gray-500">items encontrados</p>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Consistencia Interna</h3>
                            <p className="text-2xl font-bold text-gray-900">{analisis.comparacionInterna.consistencia}</p>
                            <p className="text-xs text-gray-500">índice vs contenido</p>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Cumplimiento TDR</h3>
                            <p className="text-2xl font-bold text-gray-900">{analisis.cumplimientoTdr.porcentajeCumplimiento}</p>
                            <p className="text-xs text-gray-500">requisitos cumplidos</p>
                        </div>
                    </div>

                    {/* Índice Explícito */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Índice Explícito del Documento
                        </h2>
                        {analisis.indiceExplicito.encontrado ? (
                            <div className="space-y-2">
                                <p className="text-sm text-green-700 mb-3">
                                    ✓ Se encontró un índice explícito con {analisis.indiceExplicito.total} items
                                </p>
                                <div className="max-h-64 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                                    {analisis.indiceExplicito.items.map((item: any, idx: number) => (
                                        <div key={idx} className="text-sm text-gray-700 py-1 border-b border-gray-200 last:border-0">
                                            <span className="font-mono text-xs text-gray-500 mr-2">{item.number}</span>
                                            <span>{item.title}</span>
                                            {item.page && <span className="text-gray-400 ml-2">pág. {item.page}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-red-600">
                                ✗ No se encontró un índice explícito en el documento
                            </p>
                        )}
                    </div>

                    {/* Índice Automático */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Índice Generado Automáticamente
                        </h2>
                        <p className="text-sm text-gray-600 mb-3">
                            Se detectaron {analisis.indiceAutomatico.total} títulos en el contenido del documento
                        </p>
                        <div className="max-h-64 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                            {analisis.indiceAutomatico.items.map((item: any, idx: number) => (
                                <div key={idx} className="text-sm text-gray-700 py-1 border-b border-gray-200 last:border-0">
                                    {item.number && <span className="font-mono text-xs text-gray-500 mr-2">{item.number}</span>}
                                    <span className={item.level > 1 ? 'ml-' + (item.level * 2) : ''}>{item.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Comparación Interna */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Comparación Interna (Índice vs Contenido)
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <p className="text-xs text-green-700 font-medium mb-1">Coincidencias</p>
                                <p className="text-3xl font-bold text-green-600">{analisis.comparacionInterna.coincidencias}</p>
                            </div>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-xs text-yellow-700 font-medium mb-1">Faltantes en Contenido</p>
                                <p className="text-3xl font-bold text-yellow-600">{analisis.comparacionInterna.faltantes}</p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-xs text-blue-700 font-medium mb-1">No Declarados en Índice</p>
                                <p className="text-3xl font-bold text-blue-600">{analisis.comparacionInterna.extras}</p>
                            </div>
                        </div>
                        {analisis.comparacionInterna.detalles.faltantesEnContenido?.length > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                                <p className="text-sm font-medium text-yellow-800 mb-2">
                                    Items declarados en el índice pero no encontrados en el contenido:
                                </p>
                                <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                                    {analisis.comparacionInterna.detalles.faltantesEnContenido.map((item: any, idx: number) => (
                                        <li key={idx}>{item.title}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Cumplimiento TDR */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Cumplimiento con Requisitos del TDR
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <p className="text-xs text-green-700 font-medium mb-1">Requisitos Encontrados</p>
                                <p className="text-3xl font-bold text-green-600">{analisis.cumplimientoTdr.requisitosEncontrados}</p>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-xs text-red-700 font-medium mb-1">Obligatorios Faltantes</p>
                                <p className="text-3xl font-bold text-red-600">{analisis.cumplimientoTdr.obligatoriosFaltantes}</p>
                            </div>
                        </div>

                        {analisis.cumplimientoTdr.detalles.faltantes?.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-sm font-medium text-red-800 mb-3">
                                    Requisitos Faltantes del TDR:
                                </p>
                                <div className="space-y-2">
                                    {analisis.cumplimientoTdr.detalles.faltantes.map((item: any, idx: number) => (
                                        <div key={idx} className="bg-white rounded p-3 border border-red-200">
                                            <p className="text-sm font-medium text-red-900">
                                                {item.requirement}
                                                {item.isObligatory && <span className="ml-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded">OBLIGATORIO</span>}
                                            </p>
                                            {item.description && (
                                                <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {analisis.cumplimientoTdr.detalles.cumplimiento?.length > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                                <p className="text-sm font-medium text-green-800 mb-2">
                                    Requisitos Cumplidos ({analisis.cumplimientoTdr.detalles.cumplimiento.length}):
                                </p>
                                <div className="max-h-48 overflow-y-auto">
                                    <ul className="text-xs text-green-700 space-y-1">
                                        {analisis.cumplimientoTdr.detalles.cumplimiento.map((item: any, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                                <span>{item.requirement}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Botón para Volver a Analizar */}
                    <div className="flex justify-center">
                        <button
                            onClick={analizarIndice}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                        >
                            <FileText className="h-5 w-5" />
                            <span>Volver a Analizar</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
