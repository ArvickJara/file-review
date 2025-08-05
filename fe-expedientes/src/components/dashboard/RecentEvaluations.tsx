import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle, XCircle, AlertTriangle, Eye } from "lucide-react";

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
        fileName: 'Expediente_Proyecto_A.pdf',
        date: '2024-01-15',
        status: 'completed',
        score: 85,
        issues: { format: 2, spelling: 5, content: 1 }
    },
    {
        id: '2',
        fileName: 'Informe_Tecnico_B.docx',
        date: '2024-01-15',
        status: 'in-progress',
        score: 0,
        issues: { format: 0, spelling: 0, content: 0 }
    },
    {
        id: '3',
        fileName: 'Propuesta_C.pdf',
        date: '2024-01-14',
        status: 'completed',
        score: 92,
        issues: { format: 1, spelling: 2, content: 0 }
    },
    {
        id: '4',
        fileName: 'Especificaciones_D.doc',
        date: '2024-01-14',
        status: 'failed',
        score: 0,
        issues: { format: 0, spelling: 0, content: 0 }
    }
];

const RecentEvaluations = () => {
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-success" />;
            case 'in-progress':
                return <Clock className="h-4 w-4 text-warning" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-error" />;
            default:
                return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Completado</Badge>;
            case 'in-progress':
                return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">En proceso</Badge>;
            case 'failed':
                return <Badge variant="secondary" className="bg-error/10 text-error border-error/20">Fallido</Badge>;
            default:
                return <Badge variant="secondary">Desconocido</Badge>;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-success';
        if (score >= 70) return 'text-warning';
        return 'text-error';
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
                <div className="space-y-4">
                    {mockEvaluations.map((evaluation) => (
                        <div
                            key={evaluation.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    {getStatusIcon(evaluation.status)}
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{evaluation.fileName}</p>
                                    <p className="text-xs text-muted-foreground">{evaluation.date}</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-4">
                                {evaluation.status === 'completed' && (
                                    <>
                                        <div className="text-right">
                                            <p className={`text-sm font-bold ${getScoreColor(evaluation.score)}`}>
                                                {evaluation.score}%
                                            </p>
                                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                                {evaluation.issues.format > 0 && (
                                                    <span className="flex items-center">
                                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                                        {evaluation.issues.format + evaluation.issues.spelling + evaluation.issues.content}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="flex items-center space-x-2">
                                    {getStatusBadge(evaluation.status)}
                                    <Button variant="ghost" size="icon">
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default RecentEvaluations;