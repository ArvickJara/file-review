import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, Plus, FolderOpen, Calendar, Building } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const SELECTED_PROYECTO_KEY = 'selectedProyectoId'; // clave de localStorage

interface Proyecto {
    id: string;
    nombre: string;
    codigo_proyecto?: string;
    entidad_ejecutora?: string;
    monto_referencial?: number;
    estado: string;
    datos_extraidos: boolean;
    fecha_creacion: string;
}

interface TDR {
    id: string;
    nombre: string;
    fecha_creacion: string;
    estado: string;
    proyecto_id: string;
    orden?: number;
}

interface UploadResult {
    success: boolean;
    message: string;
    tdrId?: string;
    expedienteId?: string;
    proyectoId?: string;
    file?: { name: string; path: string };
    extractedTextLength?: number;
    projectDataExtracted?: {
        nombre_proyecto?: string;
        cui?: string;
        entidad_ejecutora?: string;
        numero_entregables?: number;
        monto_referencial?: number;
        descripcion?: string;
        ubicacion?: string;
        plazo_ejecucion?: string;
        modalidad_ejecucion?: string;
        tipo_proceso?: string;
        codigo_proyecto?: string;
        objetivos_generales?: string;
        objetivos_especificos?: string;
        alcance_servicios?: string;
        productos_esperados?: string;
        perfil_consultor?: string;
        experiencia_requerida?: string;
        requisitos_tecnicos?: string;
    };
    resumen?: { total_tomos: number; tomos_procesados_exitosamente: number; tomos_con_errores: number };
    resultados?: Array<{ tomo: number; archivo: string; analisis?: string; error?: string }>;
}

// Tarjeta de proyecto
const ProjectCard: React.FC<{
    proyecto: Proyecto;
    isSelected: boolean;
    onClick: () => void;
}> = ({ proyecto, isSelected, onClick }) => {
    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div
            onClick={onClick}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${isSelected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                        <FolderOpen className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                        <h3 className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {proyecto.codigo_proyecto || 'Nuevo Proyecto'}
                        </h3>
                        {!proyecto.datos_extraidos && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Pendiente
                            </span>
                        )}
                    </div>

                    <p className={`text-xs mb-2 ${isSelected ? 'text-blue-800' : 'text-gray-600'}`}>
                        {proyecto.nombre || 'Sin nombre definido'}
                    </p>

                    {proyecto.entidad_ejecutora && (
                        <div className="flex items-center space-x-1 mb-1">
                            <Building className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{proyecto.entidad_ejecutora}</span>
                        </div>
                    )}

                    <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">Creado {formatDate(proyecto.fecha_creacion)}</span>
                    </div>
                </div>

                {isSelected && <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />}
            </div>
        </div>
    );
};

// Tarjeta para crear nuevo proyecto
const NewProjectCard: React.FC<{
    onClick: () => void;
    isCreating: boolean;
}> = ({ onClick, isCreating }) => {
    return (
        <div
            onClick={isCreating ? undefined : onClick}
            className={`p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition-all hover:border-gray-400 hover:shadow-md bg-gray-50 ${isCreating ? 'opacity-50 cursor-not-allowed' : ''
                }`}
        >
            <div className="flex flex-col items-center justify-center text-center py-8">
                {isCreating ? (
                    <>
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-2" />
                        <p className="text-sm font-medium text-blue-900">Analizando TDR...</p>
                        <p className="text-xs text-blue-700">Extrayendo datos del proyecto automáticamente</p>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                            <Plus className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">Nuevo Proyecto</p>
                        <p className="text-xs text-gray-600">Sube un TDR para crear automáticamente</p>
                    </>
                )}
            </div>
        </div>
    );
};

const ExpedientesTecnicosUpload: React.FC = () => {
    // Proyectos
    const [selectedProyecto, setSelectedProyecto] = useState<string>('');
    const [availableProyectos, setAvailableProyectos] = useState<Proyecto[]>([]);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [showNewProjectForm, setShowNewProjectForm] = useState(false);

    // Estados de TDR/Tomos
    const [selectedTdr, setSelectedTdr] = useState<string>('');
    const [availableTdrs, setAvailableTdrs] = useState<TDR[]>([]);
    const [availableTomos, setAvailableTomos] = useState<TDR[]>([]);
    const [tdrFile, setTdrFile] = useState<File | null>(null);
    const [tomoFiles, setTomoFiles] = useState<File[]>([]);
    const [isUploadingTdr, setIsUploadingTdr] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [tdrResult, setTdrResult] = useState<UploadResult | null>(null);
    const [evaluationResult, setEvaluationResult] = useState<UploadResult | null>(null);
    const [activeTab, setActiveTab] = useState<'tdr' | 'expediente'>('tdr');

    // Restaurar selección desde localStorage y cargar proyectos
    useEffect(() => {
        const saved = localStorage.getItem(SELECTED_PROYECTO_KEY) || '';
        if (saved) setSelectedProyecto(saved);
        loadAvailableProyectos();
    }, []);

    // Persistir selección en localStorage
    useEffect(() => {
        if (selectedProyecto) localStorage.setItem(SELECTED_PROYECTO_KEY, selectedProyecto);
        else localStorage.removeItem(SELECTED_PROYECTO_KEY);
    }, [selectedProyecto]);

    // Validar que el proyecto seleccionado exista; si no, limpiar selección
    useEffect(() => {
        if (!availableProyectos.length) return;
        if (selectedProyecto && !availableProyectos.some((p) => p.id === selectedProyecto)) {
            setSelectedProyecto('');
        }
    }, [availableProyectos]); // eslint-disable-line react-hooks/exhaustive-deps

    // Al cambiar de proyecto, cargar TDRs y Tomos
    useEffect(() => {
        if (selectedProyecto && !showNewProjectForm) {
            loadAvailableTdrs();
            loadAvailableTomos();
            setSelectedTdr('');
        } else {
            setAvailableTdrs([]);
            setAvailableTomos([]);
        }
    }, [selectedProyecto, showNewProjectForm]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadAvailableProyectos = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/proyectos`);
            if (response.ok) {
                const data = await response.json();
                setAvailableProyectos(data.proyectos || []);
            }
        } catch (error) {
            console.error('Error cargando proyectos:', error);
        }
    };

    // Solo tomos (orden > 0)
    const loadAvailableTomos = async () => {
        if (!selectedProyecto) return;
        try {
            const response = await fetch(`${API_BASE}/api/expedientes_tecnicos/documentos/${selectedProyecto}`);
            if (response.ok) {
                const data = await response.json();
                const tomos: TDR[] = (data.documentos || []).filter((d: TDR) => (d.orden ?? 0) > 0);
                setAvailableTomos(tomos);
            }
        } catch (error) {
            console.error('Error cargando tomos:', error);
        }
    };

    // Solo TDRs (orden = 0)
    const loadAvailableTdrs = async () => {
        if (!selectedProyecto) return;
        try {
            const response = await fetch(`${API_BASE}/api/expedientes_tecnicos/tdrs/${selectedProyecto}`);
            if (response.ok) {
                const data = await response.json();
                const tdrs: TDR[] = data.tdrs || [];
                setAvailableTdrs(tdrs);
                if (!selectedTdr && tdrs.length > 0) setSelectedTdr(tdrs[0].id);
            }
        } catch (error) {
            console.error('Error cargando TDRs:', error);
        }
    };

    // Crear nuevo proyecto subiendo TDR
    const handleCreateNewProject = () => {
        setShowNewProjectForm(true);
        setActiveTab('tdr');
        setSelectedProyecto(''); // limpiar selección y localStorage
    };

    // Validar archivo TDR
    const isValidTdrFile = (file: File) => {
        const validTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        return validTypes.includes(file.type);
    };

    // Subir TDR (crea o adjunta al proyecto) - ACTUALIZADO PARA OPENAI
    const handleTdrUpload = async () => {
        if (!tdrFile) return;

        if (!isValidTdrFile(tdrFile)) {
            setTdrResult({ success: false, message: 'Solo se permiten archivos PDF, DOC y DOCX para TDR' });
            return;
        }

        setIsUploadingTdr(true);
        setTdrResult(null);

        if (showNewProjectForm) setIsCreatingProject(true);

        try {
            const formData = new FormData();
            formData.append('tdr', tdrFile);

            // Si hay proyecto seleccionado, enviarlo; si no, se creará uno nuevo
            if (selectedProyecto) {
                formData.append('proyecto_id', selectedProyecto);
            } else {
                formData.append('crear_proyecto', 'true');
            }

            // Usar el nuevo endpoint que incluye análisis con OpenAI
            const resp = await fetch(`${API_BASE}/api/tdr/upload-and-analyze`, {
                method: 'POST',
                body: formData
            });

            const result = await resp.json();

            // Mostrar respuesta de OpenAI en la consola del navegador
            try {
                const analisis = result?.data?.analisis;
                // Usar console.group para agrupar y mejorar lectura
                console.group('%cOpenAI TDR Análisis', 'color: #10b981; font-weight: bold;');
                console.log('Modelo:', analisis?.modelo_usado);
                if (analisis?.raw_preview) {
                    console.log('Raw preview (hasta 4000 chars):');
                    console.log(analisis.raw_preview);
                }
                if (analisis?.campos_extraidos) {
                    console.log('Campos extraídos:');
                    console.dir(analisis.campos_extraidos, { depth: null });
                    const texto = analisis.campos_extraidos.texto_entregables_completo;
                    if (texto) {
                        console.log('texto_entregables_completo (longitud):', texto.length);
                    }
                }
                console.groupEnd();
            } catch (e) {
                console.warn('No se pudo imprimir el análisis de OpenAI en consola:', e);
            }

            // Actualizar interfaz con resultado más detallado
            if (result.success) {
                setTdrResult({
                    success: true,
                    message: result.message,
                    proyectoId: result.data.proyecto_id,
                    tdrId: result.data.documento_id,
                    projectDataExtracted: result.data.analisis?.campos_extraidos,
                    file: {
                        name: result.data.archivo.nombre,
                        path: result.data.archivo.ruta
                    }
                });

                // Seleccionar el proyecto (nuevo o existente)
                const proyectoId = result.data.proyecto_id;
                if (proyectoId) setSelectedProyecto(proyectoId);

                // Recargar datos
                await loadAvailableProyectos();
                await loadAvailableTdrs();
                await loadAvailableTomos();

                if (result.data.documento_id) setSelectedTdr(result.data.documento_id);

                // Limpiar y cambiar de pestaña
                setTdrFile(null);
                setShowNewProjectForm(false);
                setActiveTab('expediente');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                setTdrResult({
                    success: false,
                    message: result.message || 'Error procesando TDR con OpenAI'
                });
            }

        } catch (error) {
            console.error('Error en upload TDR:', error);
            setTdrResult({
                success: false,
                message: 'Error de conexión al procesar TDR. Verifica que el servidor esté funcionando.'
            });
        } finally {
            setIsUploadingTdr(false);
            setIsCreatingProject(false);
        }
    };

    // Agregar tomos (solo PDF)
    const handleAddTomo = (files: FileList | null) => {
        if (!files) return;
        const validFiles = Array.from(files).filter((f) => f.type === 'application/pdf');
        const invalidFiles = Array.from(files).filter((f) => f.type !== 'application/pdf');

        if (invalidFiles.length > 0) {
            alert(`Se omitieron ${invalidFiles.length} archivo(s) que no son PDF. Los tomos deben ser archivos PDF escaneados.`);
        }

        if (validFiles.length > 0) {
            setTomoFiles((prev) => [...prev, ...validFiles]);
        }
    };

    const handleRemoveTomo = (index: number) => {
        setTomoFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // Evaluar expediente (subir tomos)
    const handleEvaluateExpediente = async () => {
        if (!selectedTdr || !selectedProyecto || tomoFiles.length === 0) return;

        setIsEvaluating(true);
        setEvaluationResult(null);

        try {
            const formData = new FormData();
            formData.append('tdrId', selectedTdr);
            formData.append('proyecto_id', selectedProyecto);
            tomoFiles.forEach((file) => formData.append('tomos', file));

            const resp = await fetch(`${API_BASE}/api/expedientes_tecnicos/evaluar-expediente`, { method: 'POST', body: formData });
            const result: UploadResult = await resp.json();
            setEvaluationResult(result);

            if (result.success) {
                setTomoFiles([]);
                await loadAvailableTomos(); // refrescar lista de tomos existentes
            }
        } catch (error) {
            setEvaluationResult({ success: false, message: 'Error de conexión al evaluar expediente' });
        } finally {
            setIsEvaluating(false);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Evaluación de Expedientes Técnicos</h1>
                <p className="text-gray-600">Selecciona un proyecto existente o crea uno nuevo subiendo un TDR</p>
            </div>

            {/* Lista de proyectos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Proyectos</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableProyectos.map((proyecto) => (
                        <ProjectCard
                            key={proyecto.id}
                            proyecto={proyecto}
                            isSelected={selectedProyecto === proyecto.id && !showNewProjectForm}
                            onClick={() => {
                                setSelectedProyecto(proyecto.id); // se persiste por useEffect
                                setShowNewProjectForm(false);
                                setActiveTab('tdr'); // volver a TDR al cambiar de proyecto
                            }}
                        />
                    ))}

                    <NewProjectCard onClick={handleCreateNewProject} isCreating={isCreatingProject} />
                </div>
            </div>

            {/* Formulario de TDR para nuevo proyecto */}
            {showNewProjectForm && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium text-gray-900">Crear Nuevo Proyecto</h2>
                        <button onClick={() => setShowNewProjectForm(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start space-x-3">
                            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div>
                                <p className="text-sm text-blue-800 font-medium">Creación automática de proyecto</p>
                                <p className="text-xs text-blue-700 mt-1">
                                    Sube el TDR y se creará automáticamente un nuevo proyecto con todos los datos de este.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Archivo TDR (PDF, DOC, DOCX):</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="mt-4">
                                <label htmlFor="new-tdr-file" className="cursor-pointer">
                                    <span className="mt-2 block text-sm font-medium text-gray-900">Haz clic para seleccionar el archivo TDR</span>
                                    <span className="mt-1 block text-xs text-gray-500">Este TDR creará automáticamente un nuevo proyecto</span>
                                </label>
                                <input
                                    id="new-tdr-file"
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={(e) => setTdrFile(e.target.files?.[0] || null)}
                                />
                            </div>
                        </div>

                        {tdrFile && (
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <FileText className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <p className="text-sm font-medium text-blue-900">{tdrFile.name}</p>
                                            <p className="text-xs text-blue-600">
                                                {formatFileSize(tdrFile.size)} • {tdrFile.type.includes('pdf') ? 'PDF' : 'Word'}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => setTdrFile(null)} className="text-blue-600 hover:text-blue-800">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {tdrFile && (
                            <button
                                onClick={handleTdrUpload}
                                disabled={isUploadingTdr}
                                className="mt-4 w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                                {isUploadingTdr ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Analizando TDR y creando proyecto...</span>
                                    </>
                                ) : (
                                    <span>Crear Proyecto con TDR</span>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Resultado del TDR */}
                    {tdrResult && (
                        <div className={`mt-6 p-4 rounded-lg ${tdrResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                            <div className="flex items-start space-x-3">
                                {tdrResult.success ? (
                                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className={`text-sm font-medium ${tdrResult.success ? 'text-green-900' : 'text-red-900'}`}>
                                        {tdrResult.message}
                                    </p>

                                    {tdrResult.success && tdrResult.projectDataExtracted && (
                                        <div className="mt-3 p-4 bg-green-100 rounded-lg">
                                            <h4 className="text-sm font-medium text-green-900 mb-3 flex items-center">
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Datos extraídos con OpenAI
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                {tdrResult.projectDataExtracted.nombre_proyecto && (
                                                    <div className="bg-white p-2 rounded">
                                                        <span className="font-medium text-green-900">Nombre del Proyecto:</span>
                                                        <p className="text-green-800 mt-1">{tdrResult.projectDataExtracted.nombre_proyecto}</p>
                                                    </div>
                                                )}
                                                {tdrResult.projectDataExtracted.cui && (
                                                    <div className="bg-white p-2 rounded">
                                                        <span className="font-medium text-green-900">CUI:</span>
                                                        <p className="text-green-800 mt-1">{tdrResult.projectDataExtracted.cui}</p>
                                                    </div>
                                                )}
                                                {tdrResult.projectDataExtracted.entidad_ejecutora && (
                                                    <div className="bg-white p-2 rounded">
                                                        <span className="font-medium text-green-900">Entidad Ejecutora:</span>
                                                        <p className="text-green-800 mt-1">{tdrResult.projectDataExtracted.entidad_ejecutora}</p>
                                                    </div>
                                                )}
                                                {tdrResult.projectDataExtracted.monto_referencial && (
                                                    <div className="bg-white p-2 rounded">
                                                        <span className="font-medium text-green-900">Monto Referencial:</span>
                                                        <p className="text-green-800 mt-1">S/ {tdrResult.projectDataExtracted.monto_referencial.toLocaleString()}</p>
                                                    </div>
                                                )}
                                                {tdrResult.projectDataExtracted.ubicacion && (
                                                    <div className="bg-white p-2 rounded">
                                                        <span className="font-medium text-green-900">Ubicación:</span>
                                                        <p className="text-green-800 mt-1">{tdrResult.projectDataExtracted.ubicacion}</p>
                                                    </div>
                                                )}
                                                {tdrResult.projectDataExtracted.plazo_ejecucion && (
                                                    <div className="bg-white p-2 rounded">
                                                        <span className="font-medium text-green-900">Plazo de Ejecución:</span>
                                                        <p className="text-green-800 mt-1">{tdrResult.projectDataExtracted.plazo_ejecucion}</p>
                                                    </div>
                                                )}
                                                {tdrResult.projectDataExtracted.numero_entregables && (
                                                    <div className="bg-white p-2 rounded">
                                                        <span className="font-medium text-green-900">Número de Entregables:</span>
                                                        <p className="text-green-800 mt-1">{tdrResult.projectDataExtracted.numero_entregables}</p>
                                                    </div>
                                                )}
                                                {tdrResult.projectDataExtracted.modalidad_ejecucion && (
                                                    <div className="bg-white p-2 rounded">
                                                        <span className="font-medium text-green-900">Modalidad:</span>
                                                        <p className="text-green-800 mt-1">{tdrResult.projectDataExtracted.modalidad_ejecucion}</p>
                                                    </div>
                                                )}
                                            </div>
                                            {tdrResult.projectDataExtracted.descripcion && (
                                                <div className="mt-3 bg-white p-3 rounded">
                                                    <span className="font-medium text-green-900">Descripción:</span>
                                                    <p className="text-green-800 mt-1 text-sm">{tdrResult.projectDataExtracted.descripcion}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Formulario principal para proyecto seleccionado */}
            {selectedProyecto && !showNewProjectForm && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-6 py-4" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTab('tdr')}
                                className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'tdr'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                TDR del Proyecto
                            </button>
                            <button
                                onClick={() => setActiveTab('expediente')}
                                className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'expediente'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Evaluar Expediente
                            </button>
                        </nav>
                    </div>

                    <div className="p-6">
                        {/* Tab TDR: solo TDRs */}
                        {activeTab === 'tdr' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-medium text-gray-900">TDRs del Proyecto</h3>

                                {/* Lista de TDRs */}
                                {availableTdrs.length > 0 ? (
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-medium text-gray-700">TDRs disponibles:</h4>
                                        {availableTdrs.map((tdr) => (
                                            <div
                                                key={tdr.id}
                                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedTdr === tdr.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                onClick={() => setSelectedTdr(tdr.id)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <FileText className="h-4 w-4 text-gray-600" />
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{tdr.nombre}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {new Date(tdr.fecha_creacion).toLocaleDateString('es-ES')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {selectedTdr === tdr.id && <CheckCircle className="h-4 w-4 text-blue-600" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
                                        No hay TDRs para este proyecto. Agrega uno a continuación.
                                    </div>
                                )}

                                {/* Subir TDR adicional */}
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Agregar nuevo TDR:</h4>
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                                        <Upload className="mx-auto h-8 w-8 text-gray-400" />
                                        <div className="mt-2">
                                            <label htmlFor="additional-tdr-file" className="cursor-pointer">
                                                <span className="block text-sm font-medium text-gray-900">Agregar TDR adicional</span>
                                                <span className="block text-xs text-gray-500">PDF, DOC, DOCX</span>
                                            </label>
                                            <input
                                                id="additional-tdr-file"
                                                type="file"
                                                className="hidden"
                                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                                onChange={(e) => setTdrFile(e.target.files?.[0] || null)}
                                            />
                                        </div>
                                    </div>

                                    {tdrFile && (
                                        <>
                                            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <FileText className="h-4 w-4 text-gray-600" />
                                                        <span className="text-sm text-gray-900">{tdrFile.name}</span>
                                                    </div>
                                                    <button onClick={() => setTdrFile(null)} className="text-gray-400 hover:text-gray-600">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleTdrUpload}
                                                disabled={isUploadingTdr}
                                                className="mt-3 w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {isUploadingTdr ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        Analizando con OpenAI...
                                                    </>
                                                ) : (
                                                    'Agregar TDR'
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tab Expediente: muestra tomos existentes + upload y evaluación */}
                        {activeTab === 'expediente' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-medium text-gray-900">Evaluar Expediente Técnico</h3>

                                {!selectedTdr ? (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                        <div className="flex items-center space-x-3">
                                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                                            <p className="text-sm text-yellow-800">
                                                Primero selecciona un TDR de referencia en la pestaña anterior
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <div className="flex items-center space-x-3">
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                                <p className="text-sm text-green-800">
                                                    TDR de referencia: {availableTdrs.find((t) => t.id === selectedTdr)?.nombre}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Tomos ya cargados (orden > 0) */}
                                        {availableTomos.length > 0 && (
                                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                <h4 className="text-sm font-medium text-gray-900 mb-2">
                                                    Tomos ya cargados ({availableTomos.length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {availableTomos.map((t) => (
                                                        <div key={t.id} className="p-2 bg-gray-50 rounded flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <FileText className="h-4 w-4 text-gray-600" />
                                                                <span className="text-sm text-gray-900">{t.nombre}</span>
                                                            </div>
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(t.fecha_creacion).toLocaleDateString('es-ES')}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Subir tomos */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Tomos del expediente (PDF escaneados):</label>

                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                                                <Plus className="mx-auto h-8 w-8 text-gray-400" />
                                                <div className="mt-2">
                                                    <label htmlFor="tomos-files" className="cursor-pointer">
                                                        <span className="block text-sm font-medium text-gray-900">Agregar tomos</span>
                                                        <span className="block text-xs text-gray-500">Solo PDF • OCR automático</span>
                                                    </label>
                                                    <input
                                                        id="tomos-files"
                                                        type="file"
                                                        className="hidden"
                                                        accept=".pdf,application/pdf"
                                                        multiple
                                                        onChange={(e) => handleAddTomo(e.target.files)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Lista de tomos a subir */}
                                            {tomoFiles.length > 0 && (
                                                <div className="mt-4 space-y-2">
                                                    <h4 className="text-sm font-medium text-gray-900">Tomos seleccionados ({tomoFiles.length}):</h4>
                                                    {tomoFiles.map((file, index) => (
                                                        <div key={`${file.name}-${index}`} className="p-3 bg-gray-50 rounded-lg">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center space-x-2">
                                                                    <FileText className="h-4 w-4 text-gray-600" />
                                                                    <div>
                                                                        <p className="text-sm font-medium text-gray-900">
                                                                            Tomo {index + 1}: {file.name}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handleRemoveTomo(index)} className="text-red-600 hover:text-red-800">
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <button
                                                        onClick={handleEvaluateExpediente}
                                                        disabled={isEvaluating}
                                                        className="w-full mt-4 bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                                                    >
                                                        {isEvaluating ? (
                                                            <>
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                <span>Evaluando con OCR...</span>
                                                            </>
                                                        ) : (
                                                            <span>Evaluar Expediente ({tomoFiles.length} tomos)</span>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Resultado de la evaluación */}
                                        {evaluationResult && (
                                            <div className={`p-4 rounded-lg ${evaluationResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                                                <div className="flex items-start space-x-3">
                                                    {evaluationResult.success ? (
                                                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                                    ) : (
                                                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className={`text-sm font-medium ${evaluationResult.success ? 'text-green-900' : 'text-red-900'}`}>
                                                            {evaluationResult.message}
                                                        </p>

                                                        {evaluationResult.success && evaluationResult.resumen && (
                                                            <div className="mt-3 text-xs text-green-800">
                                                                <p>
                                                                    Total: {evaluationResult.resumen.total_tomos} | Exitosos:{' '}
                                                                    {evaluationResult.resumen.tomos_procesados_exitosamente} | Errores:{' '}
                                                                    {evaluationResult.resumen.tomos_con_errores}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpedientesTecnicosUpload;