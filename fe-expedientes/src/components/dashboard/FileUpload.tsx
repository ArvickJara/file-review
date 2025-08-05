import { useState, useCallback } from "react";
import { Upload, File, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UploadedFile {
    id: string;
    name: string;
    size: number;
    type: string;
}

const FileUpload = () => {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);

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
        const newFiles: UploadedFile[] = droppedFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            type: file.type,
        }));

        setFiles(prev => [...prev, ...newFiles]);
    }, []);

    const removeFile = (id: string) => {
        setFiles(files.filter(file => file.id !== id));
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Upload className="h-5 w-5 text-primary" />
                    <span>Subir Expedientes</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                            ? 'border-primary bg-accent'
                            : 'border-border bg-muted/30'
                        }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">
                        Arrastra y suelta archivos aquí, o haz clic para seleccionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Formatos soportados: PDF, DOC, DOCX
                    </p>
                    <Button variant="outline" className="mt-4">
                        Seleccionar archivos
                    </Button>
                </div>

                {files.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Archivos subidos:</h4>
                        {files.map((file) => (
                            <div
                                key={file.id}
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                            >
                                <div className="flex items-center space-x-3">
                                    <File className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Badge variant="secondary">Listo</Badge>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeFile(file.id)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {files.length > 0 && (
                    <Button className="w-full">
                        Evaluar Expedientes ({files.length})
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};

export default FileUpload;