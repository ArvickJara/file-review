import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, FileText, ChevronRight, ChevronDown, Upload } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

interface Producto {
    id: number;
    entregable_id: number;
    nombre_producto: string;
    descripcion?: string;
    orden: number;
    created_at?: string;
}

interface Archivo {
    id: number;
    producto_id: number;
    nombre_archivo: string;
    ruta_archivo: string;
    tipo_documento?: string;
    fecha_subida?: string;
}

interface Entregable {
    id: number;
    proyecto_id: string;
    nombre_entregable: string;
    porcentaje_pago?: number;
    plazo_dias?: number;
    created_at?: string;
    productos?: Producto[];
}

interface EntregablesProductosManagerProps {
    proyectoId: string;
    onProductoSelected?: (productoId: number) => void;
}

export const EntregablesProductosManager: React.FC<EntregablesProductosManagerProps> = ({
    proyectoId,
    onProductoSelected
}) => {
    const [entregables, setEntregables] = useState<Entregable[]>([]);
    const [expandedEntregables, setExpandedEntregables] = useState<Set<number>>(new Set());
    const [expandedProductos, setExpandedProductos] = useState<Set<number>>(new Set());
    const [nuevoProducto, setNuevoProducto] = useState<{ entregable_id: number | null; nombre: string }>({
        entregable_id: null,
        nombre: ''
    });
    const [loading, setLoading] = useState(false);
    const [selectedProducto, setSelectedProducto] = useState<number | null>(null);
    const [archivosProducto, setArchivosProducto] = useState<{ [key: number]: Archivo[] }>({});
    const [uploadingFiles, setUploadingFiles] = useState<{ [key: number]: boolean }>({});

    useEffect(() => {
        if (proyectoId) {
            cargarEntregables();
        }
    }, [proyectoId]);

    const cargarEntregables = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/expedientes_tecnicos/tdrs/${proyectoId}`);
            const data = await response.json();

            if (data.success && data.entregables) {
                const entregablesConProductos = await Promise.all(
                    data.entregables.map(async (entregable: Entregable) => {
                        try {
                            const prodResponse = await fetch(
                                `${API_BASE}/api/entregable/${entregable.id}/productos`
                            );
                            const prodData = await prodResponse.json();
                            return {
                                ...entregable,
                                productos: prodData.success ? prodData.productos : []
                            };
                        } catch (error) {
                            console.error(`Error cargando productos del entregable ${entregable.id}:`, error);
                            return { ...entregable, productos: [] };
                        }
                    })
                );
                setEntregables(entregablesConProductos);
            }
        } catch (error) {
            console.error('Error cargando entregables:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleEntregable = (id: number) => {
        const newExpanded = new Set(expandedEntregables);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedEntregables(newExpanded);
    };

    const toggleProducto = async (productoId: number) => {
        const newExpanded = new Set(expandedProductos);
        if (newExpanded.has(productoId)) {
            newExpanded.delete(productoId);
        } else {
            newExpanded.add(productoId);
            if (!archivosProducto[productoId]) {
                await cargarArchivosProducto(productoId);
            }
        }
        setExpandedProductos(newExpanded);
    };

    const cargarArchivosProducto = async (productoId: number) => {
        try {
            const response = await fetch(`${API_BASE}/api/productos/${productoId}/archivos`);
            const data = await response.json();
            if (data.success && data.archivos) {
                setArchivosProducto(prev => ({ ...prev, [productoId]: data.archivos }));
            }
        } catch (error) {
            console.error('Error cargando archivos:', error);
        }
    };

    const crearProducto = async (entregableId: number) => {
        if (!nuevoProducto.nombre.trim()) {
            alert('El nombre del producto es requerido');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/entregable/${entregableId}/productos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre_producto: nuevoProducto.nombre,
                    orden: 999
                })
            });

            const data = await response.json();
            if (data.success) {
                setNuevoProducto({ entregable_id: null, nombre: '' });
                await cargarEntregables();
            } else {
                alert(data.message || 'Error creando producto');
            }
        } catch (error) {
            console.error('Error creando producto:', error);
            alert('Error creando producto');
        }
    };

    const eliminarProducto = async (productoId: number) => {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;

        try {
            const response = await fetch(`${API_BASE}/api/productos/${productoId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.success) {
                await cargarEntregables();
            } else {
                alert(data.message || 'Error eliminando producto. Es posible que tenga archivos asociados.');
            }
        } catch (error) {
            console.error('Error eliminando producto:', error);
            alert('Error eliminando producto');
        }
    };

    const handleFileUpload = async (productoId: number, files: FileList | null) => {
        if (!files || files.length === 0) return;

        setUploadingFiles(prev => ({ ...prev, [productoId]: true }));

        try {
            const formData = new FormData();
            Array.from(files).forEach(file => {
                formData.append('archivos', file);
            });
            formData.append('producto_id', productoId.toString());
            formData.append('proyecto_id', proyectoId);

            const response = await fetch(`${API_BASE}/api/productos/${productoId}/archivos`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                await cargarArchivosProducto(productoId);
                await cargarEntregables();
            } else {
                alert(data.message || 'Error subiendo archivos');
            }
        } catch (error) {
            console.error('Error subiendo archivos:', error);
            alert('Error subiendo archivos');
        } finally {
            setUploadingFiles(prev => ({ ...prev, [productoId]: false }));
        }
    };

    const eliminarArchivo = async (archivoId: number, productoId: number) => {
        if (!confirm('¿Estás seguro de eliminar este archivo?')) return;

        try {
            const response = await fetch(`${API_BASE}/api/documentos/${archivoId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.success) {
                await cargarArchivosProducto(productoId);
                await cargarEntregables();
            } else {
                alert(data.message || 'Error eliminando archivo');
            }
        } catch (error) {
            console.error('Error eliminando archivo:', error);
            alert('Error eliminando archivo');
        }
    };

    const seleccionarProducto = (productoId: number) => {
        setSelectedProducto(productoId);
        if (onProductoSelected) {
            onProductoSelected(productoId);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Cargando entregables...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Entregables y Productos</h3>
                <span className="text-sm text-gray-500">{entregables.length} entregable(s)</span>
            </div>

            {/* Lista de entregables */}
            {entregables.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-600">No hay entregables definidos.</p>
                    <p className="text-sm text-gray-500 mt-1">
                        Crea un proyecto con TDR para generar automáticamente los entregables y sus productos.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {entregables.map((entregable) => (
                        <div key={entregable.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* Entregable header */}
                            <div
                                onClick={() => toggleEntregable(entregable.id)}
                                className="flex items-center justify-between p-4 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center space-x-3 flex-1">
                                    <button className="text-gray-500">
                                        {expandedEntregables.has(entregable.id) ? (
                                            <ChevronDown className="h-5 w-5" />
                                        ) : (
                                            <ChevronRight className="h-5 w-5" />
                                        )}
                                    </button>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-gray-900">{entregable.nombre_entregable}</h4>
                                        <div className="flex items-center space-x-4 mt-1">
                                            {entregable.porcentaje_pago && (
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                                    {entregable.porcentaje_pago}% pago
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-500">
                                                {entregable.productos?.length || 0} producto(s)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Productos expandidos */}
                            {expandedEntregables.has(entregable.id) && (
                                <div className="border-t bg-gray-50 p-4">
                                    <div className="space-y-2">
                                        {entregable.productos && entregable.productos.length > 0 ? (
                                            entregable.productos.map((producto) => (
                                                <div key={producto.id} className="space-y-2">
                                                    {/* Producto card */}
                                                    <div
                                                        onClick={() => seleccionarProducto(producto.id)}
                                                        className={`flex items-center justify-between p-3 bg-white rounded border cursor-pointer transition-colors ${selectedProducto === producto.id
                                                                ? 'border-blue-500 bg-blue-50'
                                                                : 'border-gray-200 hover:border-gray-300'
                                                            }`}
                                                    >
                                                        <div className="flex items-center space-x-2 flex-1">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleProducto(producto.id);
                                                                }}
                                                                className="text-gray-500"
                                                            >
                                                                {expandedProductos.has(producto.id) ? (
                                                                    <ChevronDown className="h-4 w-4" />
                                                                ) : (
                                                                    <ChevronRight className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                            <div className="flex-1">
                                                                <p className="font-medium text-sm text-gray-900">
                                                                    {producto.nombre_producto}
                                                                </p>
                                                                {archivosProducto[producto.id] && (
                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        {archivosProducto[producto.id].length} archivo(s)
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                eliminarProducto(producto.id);
                                                            }}
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                            title="Eliminar producto"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>

                                                    {/* Archivos del producto */}
                                                    {expandedProductos.has(producto.id) && (
                                                        <div className="ml-6 p-3 bg-gray-100 rounded space-y-2">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-medium text-gray-700">
                                                                    Archivos del producto
                                                                </span>
                                                                <label className="cursor-pointer px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 flex items-center space-x-1">
                                                                    <Upload className="h-3 w-3" />
                                                                    <span>Subir archivos</span>
                                                                    <input
                                                                        type="file"
                                                                        multiple
                                                                        className="hidden"
                                                                        accept=".pdf,.doc,.docx"
                                                                        onChange={(e) => handleFileUpload(producto.id, e.target.files)}
                                                                        disabled={uploadingFiles[producto.id]}
                                                                    />
                                                                </label>
                                                            </div>
                                                            {uploadingFiles[producto.id] && (
                                                                <div className="text-xs text-gray-500 text-center py-2">
                                                                    Subiendo archivos...
                                                                </div>
                                                            )}
                                                            {archivosProducto[producto.id] && archivosProducto[producto.id].length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {archivosProducto[producto.id].map((archivo) => (
                                                                        <div
                                                                            key={archivo.id}
                                                                            className="flex items-center justify-between p-2 bg-white rounded text-xs"
                                                                        >
                                                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                                                <FileText className="h-3 w-3 text-gray-600 flex-shrink-0" />
                                                                                <span className="text-gray-900 truncate">
                                                                                    {archivo.nombre_archivo}
                                                                                </span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => eliminarArchivo(archivo.id, producto.id)}
                                                                                className="p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0 ml-2"
                                                                                title="Eliminar archivo"
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                !uploadingFiles[producto.id] && (
                                                                    <p className="text-xs text-gray-500 text-center py-2">
                                                                        No hay archivos. Sube archivos para este producto.
                                                                    </p>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 text-center py-2">
                                                No hay productos. Agrega uno nuevo.
                                            </p>
                                        )}

                                        {/* Formulario para nuevo producto */}
                                        {nuevoProducto.entregable_id === entregable.id ? (
                                            <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                                                <input
                                                    type="text"
                                                    placeholder="Nombre del producto *"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded mb-2 text-sm"
                                                    value={nuevoProducto.nombre}
                                                    onChange={(e) =>
                                                        setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })
                                                    }
                                                />
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => crearProducto(entregable.id)}
                                                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                                    >
                                                        <Save className="h-4 w-4" />
                                                        <span>Guardar</span>
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setNuevoProducto({ entregable_id: null, nombre: '' })
                                                        }
                                                        className="flex items-center space-x-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                                                    >
                                                        <X className="h-4 w-4" />
                                                        <span>Cancelar</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() =>
                                                    setNuevoProducto({ entregable_id: entregable.id, nombre: '' })
                                                }
                                                className="w-full mt-2 flex items-center justify-center space-x-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                                            >
                                                <Plus className="h-4 w-4" />
                                                <span className="text-sm">Agregar Producto</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
