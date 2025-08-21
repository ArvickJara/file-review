import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Button } from "@/components/ui/button";
import { CalendarIcon, Download, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Importaciones condicionales para componentes que podrían no estar instalados
// Si necesitas estos componentes, ejecuta:
// npx shadcn-ui@latest add tabs select popover calendar

// Datos simulados para gráficos
const monthlyCostData = [
    { name: 'Ene', costo: 4000 },
    { name: 'Feb', costo: 3000 },
    { name: 'Mar', costo: 2000 },
    { name: 'Abr', costo: 2780 },
    { name: 'May', costo: 1890 },
    { name: 'Jun', costo: 2390 },
    { name: 'Jul', costo: 3490 },
    { name: 'Ago', costo: 2800 },
    { name: 'Sep', costo: 3200 },
    { name: 'Oct', costo: 2500 },
    { name: 'Nov', costo: 3700 },
    { name: 'Dic', costo: 4100 },
];

const categoryData = [
    { name: 'Administrativos', value: 400 },
    { name: 'Legales', value: 300 },
    { name: 'Técnicos', value: 300 },
    { name: 'Financieros', value: 200 },
    { name: 'Otros', value: 100 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const CostosPresupuestos = () => {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [period, setPeriod] = useState('year');
    const [activeTab, setActiveTab] = useState('overview');

    // Función para renderizar los selectores cuando estén disponibles
    const renderPeriodSelector = () => {
        try {
            // Intenta importar dinámicamente si existe
            const { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } = require("@/components/ui/select");

            return (
                <Select defaultValue="year" onValueChange={(value: string) => setPeriod(value)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Seleccionar período" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="month">Este mes</SelectItem>
                        <SelectItem value="quarter">Este trimestre</SelectItem>
                        <SelectItem value="year">Este año</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                </Select>
            );
        } catch (e) {
            // Si no está disponible, muestra un selector básico
            return (
                <select
                    className="px-3 py-2 border rounded-md"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                >
                    <option value="month">Este mes</option>
                    <option value="quarter">Este trimestre</option>
                    <option value="year">Este año</option>
                    <option value="custom">Personalizado</option>
                </select>
            );
        }
    };

    // Función para renderizar el calendario cuando esté disponible
    const renderCalendar = () => {
        try {
            // Intenta importar dinámicamente si existe
            const { Popover, PopoverContent, PopoverTrigger } = require("@/components/ui/popover");
            const { Calendar } = require("@/components/ui/calendar");

            return (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "w-[240px] justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            );
        } catch (e) {
            // Si no está disponible, muestra un selector de fecha básico
            return (
                <input
                    type="date"
                    className="px-3 py-2 border rounded-md"
                    value={date ? format(date, "yyyy-MM-dd") : ''}
                    onChange={(e) => setDate(e.target.value ? new Date(e.target.value) : undefined)}
                />
            );
        }
    };

    // Función para renderizar pestañas cuando estén disponibles
    const renderTabs = () => {
        try {
            // Intenta importar dinámicamente si existe
            const { Tabs, TabsContent, TabsList, TabsTrigger } = require("@/components/ui/tabs");

            return (
                <Tabs defaultValue="overview" className="space-y-4" value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="overview">Vista General</TabsTrigger>
                        <TabsTrigger value="departments">Por Departamentos</TabsTrigger>
                        <TabsTrigger value="categories">Por Categorías</TabsTrigger>
                        <TabsTrigger value="details">Detalles</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        {renderOverviewTab()}
                    </TabsContent>

                    <TabsContent value="departments">
                        {renderDepartmentsTab()}
                    </TabsContent>

                    <TabsContent value="categories">
                        <Card>
                            <CardHeader>
                                <CardTitle>Análisis por Categorías</CardTitle>
                                <CardDescription>
                                    Desglose detallado por categoría y subcategoría.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-center text-muted-foreground py-20">
                                    Contenido de análisis por categorías en desarrollo...
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="details">
                        <Card>
                            <CardHeader>
                                <CardTitle>Detalles de Costos</CardTitle>
                                <CardDescription>
                                    Vista detallada de todos los costos asociados a los expedientes.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-center text-muted-foreground py-20">
                                    Vista detallada en desarrollo...
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            );
        } catch (e) {
            // Si no están disponibles las pestañas, muestra una versión simplificada
            return (
                <div className="space-y-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            {['overview', 'departments', 'categories', 'details'].map((tab) => (
                                <button
                                    key={tab}
                                    className={`
                    py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab === 'overview' && 'Vista General'}
                                    {tab === 'departments' && 'Por Departamentos'}
                                    {tab === 'categories' && 'Por Categorías'}
                                    {tab === 'details' && 'Detalles'}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="mt-6">
                        {activeTab === 'overview' && renderOverviewTab()}
                        {activeTab === 'departments' && renderDepartmentsTab()}
                        {activeTab === 'categories' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Análisis por Categorías</CardTitle>
                                    <CardDescription>
                                        Desglose detallado por categoría y subcategoría.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-center text-muted-foreground py-20">
                                        Contenido de análisis por categorías en desarrollo...
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                        {activeTab === 'details' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Detalles de Costos</CardTitle>
                                    <CardDescription>
                                        Vista detallada de todos los costos asociados a los expedientes.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-center text-muted-foreground py-20">
                                        Vista detallada en desarrollo...
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            );
        }
    };

    // Renderizar la pestaña de vista general
    const renderOverviewTab = () => (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Tendencia de Costos</CardTitle>
                    <CardDescription>
                        Análisis de costos mensuales a lo largo del período seleccionado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart
                            data={monthlyCostData}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            <Line type="monotone" dataKey="costo" stroke="#8884d8" activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Distribución por Categoría</CardTitle>
                        <CardDescription>
                            Distribución de costos por categoría de expediente.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Costos por Tipo de Expediente</CardTitle>
                        <CardDescription>
                            Comparativa de costos según el tipo de expediente.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={[
                                    { name: 'Tipo A', costo: 4000 },
                                    { name: 'Tipo B', costo: 3000 },
                                    { name: 'Tipo C', costo: 2000 },
                                    { name: 'Tipo D', costo: 1000 },
                                    { name: 'Tipo E', costo: 1500 },
                                ]}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <RechartsTooltip />
                                <Legend />
                                <Bar dataKey="costo" fill="#82ca9d" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </>
    );

    // Renderizar la pestaña de departamentos
    const renderDepartmentsTab = () => (
        <Card>
            <CardHeader>
                <CardTitle>Análisis por Departamentos</CardTitle>
                <CardDescription>
                    Desglose de costos por departamento responsable.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-6">
                    El siguiente gráfico muestra la distribución de costos entre los diferentes departamentos
                    durante el período seleccionado.
                </p>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={[
                            { name: 'Legal', costo: 12400 },
                            { name: 'Administrativo', costo: 8700 },
                            { name: 'Técnico', costo: 15600 },
                            { name: 'Finanzas', costo: 5400 },
                            { name: 'Recursos Humanos', costo: 3200 },
                            { name: 'Operaciones', costo: 9800 },
                        ]}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="costo" fill="#0088FE" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Costos y Presupuestos</h1>

                <div className="flex items-center gap-4">
                    {renderPeriodSelector()}
                    {renderCalendar()}

                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Exportar
                    </Button>
                </div>
            </div>

            {/* Tarjetas de resumen */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Costo Total
                        </CardTitle>
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">S/. 145,231.89</div>
                        <p className="text-xs text-muted-foreground">
                            +20.1% desde el último período
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Costo Promedio por Expediente
                        </CardTitle>
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">S/. 1,245.67</div>
                        <p className="text-xs text-muted-foreground">
                            -3.2% desde el último período
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Expedientes Evaluados
                        </CardTitle>
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1,247</div>
                        <p className="text-xs text-muted-foreground">
                            +12% desde el último período
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Eficiencia de Costos
                        </CardTitle>
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">87.5%</div>
                        <p className="text-xs text-muted-foreground">
                            +5.1% desde el último período
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Pestañas de análisis */}
            {renderTabs()}
        </div>
    );
};

export default CostosPresupuestos;