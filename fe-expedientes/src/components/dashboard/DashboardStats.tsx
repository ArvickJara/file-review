import StatsCard from "./StatsCard";
import {
    FileText,
    CheckCircle,
    AlertTriangle,
    Clock,
    TrendingUp,
    BarChart3
} from "lucide-react";

const DashboardStats = () => {
    return (
        <div className="space-y-6">
            {/* Primary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                    title="Total Expedientes"
                    value="1,247"
                    description="+12% vs mes anterior"
                    icon={FileText}
                />
                <StatsCard
                    title="Evaluaciones Completadas"
                    value="1,189"
                    description="95.3% de éxito"
                    icon={CheckCircle}
                    variant="success"
                />
                <StatsCard
                    title="Con Observaciones"
                    value="58"
                    description="4.7% del total"
                    icon={AlertTriangle}
                    variant="warning"
                />
                <StatsCard
                    title="En Proceso"
                    value="15"
                    description="Siendo evaluados"
                    icon={Clock}
                    variant="default"
                />
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                    title="Promedio de Calidad"
                    value="87.5%"
                    description="Calificación general"
                    icon={TrendingUp}
                    variant="success"
                />
                <StatsCard
                    title="Errores Ortográficos"
                    value="2.3"
                    description="Promedio por documento"
                    icon={BarChart3}
                    variant="warning"
                />
                <StatsCard
                    title="Errores de Formato"
                    value="1.8"
                    description="Promedio por documento"
                    icon={BarChart3}
                    variant="error"
                />
            </div>
        </div>
    );
};

export default DashboardStats;