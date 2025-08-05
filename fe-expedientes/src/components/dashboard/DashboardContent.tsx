import FileUpload from "./FileUpload";
import RecentEvaluations from "./RecentEvaluations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    FileText,
    Download,
    Settings,
    Plus
} from "lucide-react";

const DashboardContent = () => {
    return (
        <div className="space-y-6">
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upload Section */}
                <div className="lg:col-span-1">
                    <FileUpload />
                </div>

                {/* Recent Evaluations */}
                <div className="lg:col-span-2">
                    <RecentEvaluations />
                </div>
            </div>

            {/* Quick Actions & Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <Plus className="h-5 w-5 text-primary" />
                            <span>Acciones Rápidas</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button variant="outline" className="w-full justify-start">
                            <FileText className="mr-2 h-4 w-4" />
                            Ver todos los expedientes
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                            <Settings className="mr-2 h-4 w-4" />
                            Configurar criterios de evaluación
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                            <Download className="mr-2 h-4 w-4" />
                            Exportar reportes
                        </Button>
                    </CardContent>
                </Card>

                {/* System Overview */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            <span>Estado del Sistema</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">IA Engine</span>
                            <div className="flex items-center space-x-2">
                                <div className="h-2 w-2 bg-success rounded-full"></div>
                                <span className="text-sm font-medium">Operativo</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Base de Datos</span>
                            <div className="flex items-center space-x-2">
                                <div className="h-2 w-2 bg-success rounded-full"></div>
                                <span className="text-sm font-medium">Conectado</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Almacenamiento</span>
                            <div className="flex items-center space-x-2">
                                <div className="h-2 w-2 bg-warning rounded-full"></div>
                                <span className="text-sm font-medium">78% usado</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Última evaluación</span>
                            <span className="text-sm font-medium">Hace 2 minutos</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default DashboardContent;