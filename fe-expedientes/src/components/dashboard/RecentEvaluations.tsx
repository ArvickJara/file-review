import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle, XCircle, AlertTriangle, Eye } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Evaluation {
    id: string;
    fileName: string;
    date: string;
    status: 'completed' | 'in-progress' | 'failed';
    score: number;
    issues: {
        format: number;
        spelling: number;
        content: number;
    };
}

const mockEvaluations: Evaluation[] = [
    {
        id: '1',
        fileName: 'Expediente_Largo_Nombre_Proyecto_A.pdf',
        date: 'Hace 2 horas',
        status: 'completed',
        score: 85,
        issues: { format: 2, spelling: 5, content: 1 }
    },
    {
        id: '2',
        fileName: 'Informe_Tecnico_B.docx',
        date: 'Hace 1 día',
        status: 'in-progress',
        score: 0,
        issues: { format: 0, spelling: 0, content: 0 }
    },
    {
        id: '3',
        fileName: 'Propuesta_C.pdf',
        date: 'Hace 2 días',
        status: 'completed',
        score: 92,
        issues: { format: 1, spelling: 2, content: 0 }
    },
    {
        id: '4',
        fileName: 'Especificaciones_D.doc',
        date: 'Hace 3 días',
        status: 'failed',
        score: 0,
        issues: { format: 0, spelling: 0, content: 0 }
    }
];

const RecentEvaluations = () => {
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-5 w-5 text-success" />;
            case 'in-progress':
                return <Clock className="h-5 w-5 text-warning animate-pulse" />;
            case 'failed':
                return <XCircle className="h-5 w-5 text-destructive" />;
            default:
                return <Clock className="h-5 w-5 text-muted-foreground" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Completado</Badge>;
            case 'in-progress':
                return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">En proceso</Badge>;
            case 'failed':
                return <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">Fallido</Badge>;
            default:
                return <Badge variant="secondary">Desconocido</Badge>;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-success';
        if (score >= 70) return 'text-warning';
        return 'text-destructive';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span>Evaluaciones Recientes</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {mockEvaluations.map((evaluation) => {
                        const totalIssues = evaluation.issues.format + evaluation.issues.spelling + evaluation.issues.content;
                        return (
                            <div
                                key={evaluation.id}
                                className="flex flex-col items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between"
                            >
                                {/* --- Parte Izquierda: Información del Archivo --- */}
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    {getStatusIcon(evaluation.status)}
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate font-medium text-sm">{evaluation.fileName}</p>
                                        <p className="text-xs text-muted-foreground">{evaluation.date}</p>
                                    </div>
                                </div>

                                {/* --- Parte Derecha: Estado y Acciones --- */}
                                <div className="flex w-full items-center justify-between sm:w-auto sm:justify-end sm:gap-4">
                                    {evaluation.status === 'completed' && (
                                        <div className="flex items-center gap-2 text-right">
                                            {totalIssues > 0 && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="flex cursor-pointer items-center text-xs text-muted-foreground">
                                                                <AlertTriangle className="mr-1 h-4 w-4 text-warning" />
                                                                {totalIssues}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Formato: {evaluation.issues.format}</p>
                                                            <p>Ortografía: {evaluation.issues.spelling}</p>
                                                            <p>Contenido: {evaluation.issues.content}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                            <p className={`text-lg font-bold ${getScoreColor(evaluation.score)}`}>
                                                {evaluation.score}%
                                            </p>
                                        </div>
                                    )}

                                    {/* Spacer para alinear en móvil */}
                                    {evaluation.status !== 'completed' && <div className="flex-1 sm:hidden"></div>}

                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(evaluation.status)}
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default RecentEvaluations;