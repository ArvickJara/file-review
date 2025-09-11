// src/pages/Upload.tsx
import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, Plus } from 'lucide-react';

interface TDR {
    id: string;
    nombre: string;
    fecha_creacion: string;
    estado: string;
}

interface UploadResult {
    success: boolean;
    message: string;
    tdrId?: string;
    expedienteId?: string;
    file?: {
        name: string;
        path: string;
    };
    extractedTextLength?: number;
    resumen?: {
        total_tomos: number;
        tomos_procesados_exitosamente: number;
        tomos_con_errores: number;
    };
    resultados?: Array<{
        tomo: number;
        archivo: string;
        analisis?: string;
        error?: string;
    }>;
}

const ExpedientesTecnicosUpload: React.FC = () => {
    // Estados
    const [selectedTdr, setSelectedTdr] = useState<string>('');
    const [availableTdrs, setAvailableTdrs] = useState<TDR[]>([]);
    const [tdrFile, setTdrFile] = useState<File | null>(null);
    const [tomoFiles, setTomoFiles] = useState<File[]>([]);
    const [isUploadingTdr, setIsUploadingTdr] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [tdrResult, setTdrResult] = useState<UploadResult | null>(null);
    const [evaluationResult, setEvaluationResult] = useState<UploadResult | null>(null);
    const [activeTab, setActiveTab] = useState<'tdr' | 'expediente'>('tdr');

    // Cargar TDRs disponibles al montar el componente
    useEffect(() => {
        loadAvailableTdrs();
    }, []);

    const loadAvailableTdrs = async () => {
        try {
            const response = await fetch('/api/expedientes-tecnicos/tdrs');
            if (response.ok) {
                const data = await response.json();
                setAvailableTdrs(data.tdrs || []);
            }
        } catch (error) {
            console.error('Error cargando TDRs:', error);
        }
    };

    // Validar tipo de archivo TDR
    const isValidTdrFile = (file: File) => {
        const validTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        return validTypes.includes(file.type);
    };

    // Subir TDR
    const handleTdrUpload = async () => {
        if (!tdrFile) return;

        if (!isValidTdrFile(tdrFile)) {
            setTdrResult({
                success: false,
                message: 'Solo se permiten archivos PDF, DOC y DOCX para TDR'
            });
            return;
        }

        setIsUploadingTdr(true);
        setTdrResult(null);

        try {
            const formData = new FormData();
            formData.append('tdr', tdrFile);

            const response = await fetch('/api/expedientes-tecnicos/subir-tdr', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            setTdrResult(result);

            if (result.success) {
                // Recargar lista de TDRs y seleccionar el nuevo
                await loadAvailableTdrs();
                setSelectedTdr(result.tdrId);
                setTdrFile(null);
                // Cambiar a la pestaña de expediente
                setActiveTab('expediente');
            }
        } catch (error) {
            setTdrResult({
                success: false,
                message: 'Error de conexión al subir TDR'
            });
        } finally {
            setIsUploadingTdr(false);
        }
    };

    // Agregar tomo (solo PDF para OCR)
    const handleAddTomo = (files: FileList | null) => {
        if (files) {
            const validFiles = Array.from(files).filter(file => file.type === 'application/pdf');
            const invalidFiles = Array.from(files).filter(file => file.type !== 'application/pdf');

            if (invalidFiles.length > 0) {
                alert(`Se omitieron ${invalidFiles.length} archivo(s) que no son PDF. Los tomos deben ser archivos PDF escaneados.`);
            }

            if (validFiles.length > 0) {
                setTomoFiles(prev => [...prev, ...validFiles]);
            }
        }
    };

    // Remover tomo
    const handleRemoveTomo = (index: number) => {
        setTomoFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Evaluar expediente
    const handleEvaluateExpediente = async () => {
        if (!selectedTdr || tomoFiles.length === 0) return;

        setIsEvaluating(true);
        setEvaluationResult(null);

        try {
            const formData = new FormData();
            formData.append('tdrId', selectedTdr);

            tomoFiles.forEach((file) => {
                formData.append('tomos', file);
            });

            const response = await fetch('/api/expedientes-tecnicos/evaluar-expediente', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            setEvaluationResult(result);

            if (result.success) {
                setTomoFiles([]);
            }
        } catch (error) {
            setEvaluationResult({
                success: false,
                message: 'Error de conexión al evaluar expediente'
            });
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
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Evaluación de Expedientes Técnicos
                </h1>
                <p className="text-gray-600">
                    Sube el TDR de referencia y los tomos del expediente técnico para realizar la evaluación
                </p>
            </div>

            {/* Tabs */}
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
                            1. Subir TDR
                        </button>
                        <button
                            onClick={() => setActiveTab('expediente')}
                            className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'expediente'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            2. Evaluar Expediente
                        </button>
                    </nav>
                </div>

                <div className="p-6">
                    {/* Tab TDR */}
                    {activeTab === 'tdr' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">
                                    Términos de Referencia (TDR)
                                </h3>

                                {/* TDRs disponibles */}
                                {availableTdrs.length > 0 && (
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            TDRs disponibles:
                                        </label>
                                        <select
                                            value={selectedTdr}
                                            onChange={(e) => setSelectedTdr(e.target.value)}
                                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">Seleccionar TDR existente...</option>
                                            {availableTdrs.map((tdr) => (
                                                <option key={tdr.id} value={tdr.id}>
                                                    {tdr.nombre} - {new Date(tdr.fecha_creacion).toLocaleDateString()}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="text-center text-gray-500 mb-4">O</div>

                                {/* Subir nuevo TDR */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Subir nuevo TDR (PDF, DOC, DOCX):
                                    </label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                        <div className="mt-4">
                                            <label htmlFor="tdr-file" className="cursor-pointer">
                                                <span className="mt-2 block text-sm font-medium text-gray-900">
                                                    Haz clic para seleccionar el archivo TDR
                                                </span>
                                                <span className="mt-1 block text-xs text-gray-500">
                                                    Archivos PDF, DOC y DOCX permitidos
                                                </span>
                                            </label>
                                            <input
                                                id="tdr-file"
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
                                                <button
                                                    onClick={() => setTdrFile(null)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
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
                                                    <span>Procesando TDR...</span>
                                                </>
                                            ) : (
                                                <span>Subir TDR</span>
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
                                            <div>
                                                <p className={`text-sm font-medium ${tdrResult.success ? 'text-green-900' : 'text-red-900'}`}>
                                                    {tdrResult.message}
                                                </p>
                                                {tdrResult.success && tdrResult.extractedTextLength && (
                                                    <p className="text-xs text-green-700 mt-1">
                                                        Texto extraído: {tdrResult.extractedTextLength.toLocaleString()} caracteres
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tab Expediente */}
                    {activeTab === 'expediente' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">
                                    Tomos del Expediente Técnico
                                </h3>

                                {!selectedTdr && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                        <div className="flex items-center space-x-3">
                                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                                            <p className="text-sm text-yellow-800">
                                                Primero debes seleccionar o subir un TDR de referencia
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {selectedTdr && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                                        <div className="flex items-center space-x-3">
                                            <CheckCircle className="h-5 w-5 text-green-600" />
                                            <p className="text-sm text-green-800">
                                                TDR seleccionado: {availableTdrs.find(t => t.id === selectedTdr)?.nombre || selectedTdr}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Subir tomos */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Agregar tomos escaneados (solo PDF):
                                    </label>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                        <div className="flex items-start space-x-3">
                                            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm text-blue-800 font-medium">
                                                    Procesamiento OCR automático
                                                </p>
                                                <p className="text-xs text-blue-700 mt-1">
                                                    Los tomos se procesarán con OCR para extraer texto de documentos escaneados
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                                        <Plus className="mx-auto h-12 w-12 text-gray-400" />
                                        <div className="mt-4">
                                            <label htmlFor="tomos-files" className="cursor-pointer">
                                                <span className="mt-2 block text-sm font-medium text-gray-900">
                                                    Haz clic para agregar tomos
                                                </span>
                                                <span className="mt-1 block text-xs text-gray-500">
                                                    Solo archivos PDF • Múltiples archivos permitidos
                                                </span>
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

                                    {/* Lista de tomos */}
                                    {tomoFiles.length > 0 && (
                                        <div className="mt-6 space-y-3">
                                            <h4 className="text-sm font-medium text-gray-900">
                                                Tomos seleccionados ({tomoFiles.length}):
                                            </h4>
                                            {tomoFiles.map((file, index) => (
                                                <div key={`${file.name}-${index}`} className="p-4 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-3">
                                                            <FileText className="h-5 w-5 text-gray-600" />
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900">
                                                                    Tomo {index + 1}: {file.name}
                                                                </p>
                                                                <p className="text-xs text-gray-600">
                                                                    {formatFileSize(file.size)} • PDF • OCR automático
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveTomo(index)}
                                                            className="text-red-600 hover:text-red-800"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Botón evaluar */}
                                    {selectedTdr && tomoFiles.length > 0 && (
                                        <button
                                            onClick={handleEvaluateExpediente}
                                            disabled={isEvaluating}
                                            className="mt-6 w-full bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                        >
                                            {isEvaluating ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>Procesando con OCR y evaluando...</span>
                                                </>
                                            ) : (
                                                <span>Evaluar Expediente ({tomoFiles.length} tomos)</span>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Resultado de la evaluación */}
                                {evaluationResult && (
                                    <div className={`mt-6 p-6 rounded-lg ${evaluationResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
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
                                                    <div className="mt-4 space-y-2">
                                                        <h4 className="text-sm font-medium text-green-900">Resumen:</h4>
                                                        <div className="grid grid-cols-3 gap-4 text-xs text-green-800">
                                                            <div>
                                                                <span className="font-medium">Total:</span> {evaluationResult.resumen.total_tomos}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Exitosos:</span> {evaluationResult.resumen.tomos_procesados_exitosamente}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Errores:</span> {evaluationResult.resumen.tomos_con_errores}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {evaluationResult.resultados && evaluationResult.resultados.length > 0 && (
                                                    <div className="mt-4">
                                                        <h4 className="text-sm font-medium text-green-900 mb-2">Resultados por tomo:</h4>
                                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                                            {evaluationResult.resultados.map((resultado, index) => (
                                                                <div key={index} className="p-3 bg-white rounded border">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-xs font-medium text-gray-900">
                                                                            Tomo {resultado.tomo}: {resultado.archivo}
                                                                        </span>
                                                                        {resultado.error ? (
                                                                            <span className="text-xs text-red-600">Error OCR</span>
                                                                        ) : (
                                                                            <span className="text-xs text-green-600">OCR Procesado</span>
                                                                        )}
                                                                    </div>
                                                                    {resultado.error && (
                                                                        <p className="text-xs text-red-600">{resultado.error}</p>
                                                                    )}
                                                                    {resultado.analisis && (
                                                                        <p className="text-xs text-gray-600 line-clamp-3">
                                                                            {resultado.analisis.substring(0, 200)}...
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExpedientesTecnicosUpload;