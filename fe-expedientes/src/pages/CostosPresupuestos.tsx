import { useState, useCallback } from "react";
import { Upload, File, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ResultadosCostos from "@/components/ResultadosCostos";

interface ProcessingResult {
    total_observations: number;
}

interface UploadedFile {
    id: string;
    name: string;
    size: number;
    type: string;
    file: File;
    status: 'waiting' | 'uploading' | 'processing' | 'completed' | 'error';
    progress: number;
    result?: ProcessingResult;
    error?: string;
}

type Props = {
    /** Endpoint del backend (mismo origen). Default: /api/expedientes/evaluar-costos-presupuestos */
    apiUrl?: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const FileUpload = ({ apiUrl = `${API_BASE}/api/expedientes/evaluar-costos-presupuestos` }: Props) => {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    // 🔁 key para forzar que <ResultadosCostos /> se remonte y vuelva a pedir datos
    const [reloadKey, setReloadKey] = useState(0);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        addFiles(droppedFiles);
    }, []);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            addFiles(selectedFiles);
        }
    }, []);

    const addFiles = (fileList: File[]) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const validFiles = fileList.filter(file => allowedTypes.includes(file.type));
        if (validFiles.length !== fileList.length) {
            alert("Algunos archivos no son válidos. Solo se permiten PDF, DOC y DOCX.");
        }
        const newFiles: UploadedFile[] = validFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            type: file.type,
            file,
            status: 'waiting',
            progress: 0
        }));
        setFiles(prev => [...prev, ...newFiles]);
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(file => file.id !== id));
    };

    const processFile = async (fileData: UploadedFile) => {
        try {
            // a) uploading
            setFiles(prev => prev.map(f => (f.id === fileData.id ? { ...f, status: 'uploading', progress: 0 } : f)));

            const formData = new FormData();
            formData.append('file', fileData.file);

            // Simulación de progreso (fetch no da progreso nativo)
            const uploadInterval = setInterval(() => {
                setFiles(prev => prev.map(f =>
                    f.id === fileData.id && f.progress < 50 ? { ...f, progress: f.progress + 10 } : f
                ));
            }, 200);

            // b) llamada al backend (MISMO ORIGEN)
            const response = await fetch(apiUrl, { method: 'POST', body: formData });

            clearInterval(uploadInterval);

            if (!response.ok) {
                let detail = 'Error procesando documento';
                try {
                    const errJson = await response.json();
                    detail = errJson?.message || errJson?.detail || detail;
                } catch { /* ignore */ }
                throw new Error(detail);
            }

            const result = await response.json();

            // Normaliza # de observaciones: result.summary.total_observations (según tu API)
            const totalObs =
                result?.summary?.total_observations ??
                result?.total_observations ??
                0;

            // c) completed
            setFiles(prev => prev.map(f =>
                f.id === fileData.id
                    ? { ...f, status: 'completed', progress: 100, result: { total_observations: Number(totalObs) || 0 } }
                    : f
            ));
        } catch (error) {
            setFiles(prev => prev.map(f =>
                f.id === fileData.id
                    ? {
                        ...f,
                        status: 'error',
                        progress: 0,
                        error: error instanceof Error ? error.message : 'Error desconocido'
                    }
                    : f
            ));
        }
    };

    const processAllFiles = async () => {
        setIsProcessing(true);
        const waitingFiles = files.filter(f => f.status === 'waiting');
        for (const file of waitingFiles) {
            await processFile(file);
        }
        setIsProcessing(false);
        // 🔁 luego de procesar, refrescamos la lista de resultados
        setReloadKey(k => k + 1);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusIcon = (status: UploadedFile['status']) => {
        switch (status) {
            case 'waiting': return <File className="h-4 w-4 text-muted-foreground" />;
            case 'uploading':
            case 'processing': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
            case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
            default: return <File className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getStatusBadge = (status: UploadedFile['status']) => {
        switch (status) {
            case 'waiting': return <Badge variant="secondary">Esperando</Badge>;
            case 'uploading': return <Badge variant="outline">Subiendo...</Badge>;
            case 'processing': return <Badge variant="outline">Procesando...</Badge>;
            case 'completed': return <Badge variant="default" className="bg-green-500">Completado</Badge>;
            case 'error': return <Badge variant="destructive">Error</Badge>;
            default: return <Badge variant="secondary">Desconocido</Badge>;
        }
    };

    const waitingFilesCount = files.filter(f => f.status === 'waiting').length;
    const completedFilesCount = files.filter(f => f.status === 'completed').length;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Upload className="h-5 w-5 text-primary" />
                        <span>Subir Expedientes</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-primary bg-accent' : 'border-border bg-muted/30'
                            }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-2">Arrastra y suelta archivos aquí, o haz clic para seleccionar</p>
                        <p className="text-xs text-muted-foreground">Formatos soportados: PDF, DOC, DOCX</p>
                        <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileInput}
                            className="hidden"
                            id="file-input"
                        />
                        <label htmlFor="file-input">
                            <Button variant="outline" className="mt-4" asChild>
                                <span>Seleccionar archivos</span>
                            </Button>
                        </label>
                    </div>

                    {files.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">
                                Archivos ({files.length}) - Completados: {completedFilesCount}
                            </h4>
                            {files.map((file) => (
                                <div key={file.id} className="space-y-2 p-3 bg-muted/50 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            {getStatusIcon(file.status)}
                                            <div>
                                                <p className="text-sm font-medium">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {getStatusBadge(file.status)}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeFile(file.id)}
                                                disabled={file.status === 'uploading' || file.status === 'processing'}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {(file.status === 'uploading' || file.status === 'processing') && (
                                        <Progress value={file.progress} className="w-full" />
                                    )}

                                    {file.status === 'error' && file.error && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{file.error}</AlertDescription>
                                        </Alert>
                                    )}

                                    {file.status === 'completed' && file.result && (
                                        <div className="text-xs text-green-600">
                                            ✓ Procesado: {file.result.total_observations} observaciones encontradas
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {waitingFilesCount > 0 && (
                        <Button className="w-full" onClick={processAllFiles} disabled={isProcessing}>
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                `Evaluar Expedientes (${waitingFilesCount})`
                            )}
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Listado de resultados debajo del uploader */}
            <div className="mt-6">
                <ResultadosCostos key={reloadKey} />
            </div>
        </>
    );
};

export default FileUpload;
