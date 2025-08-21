// src/components/layout/AppSidebar.tsx
import {
    BarChart3,
    FileText,
    Upload,
    Settings,
    Home,
    TrendingUp,
    Database,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useSidebar } from "@/contexts/SidebarContext";
import logoRegionalLight from "@/assets/logo-region-light.png";
import logoRegionalDark from "@/assets/logo-region-dark.png";

const mainItems = [
    { title: "Dashboard", url: "/", icon: Home },
    { title: "Costos y presupuestos", url: "/costos-presupuestos", icon: FileText },
    { title: "Subir Archivos", url: "/upload", icon: Upload },
    { title: "Análisis", url: "/analytics", icon: BarChart3 },
];

const managementItems = [
    { title: "Reportes", url: "/reports", icon: TrendingUp },
    { title: "Base de Datos", url: "/database", icon: Database },
    { title: "Configuración", url: "/settings", icon: Settings },
];

export function AppSidebar() {
    const location = useLocation();
    const { isOpen } = useSidebar();
    const isActive = (path: string) => location.pathname === path;

    // Si el sidebar está cerrado, no renderizamos nada
    if (!isOpen) return null;

    return (
        <div className="flex flex-col h-full w-64 overflow-hidden">
            {/* Cabecera */}
            <div className="p-3 flex justify-center items-center">
                <div className="flex items-center justify-center gap-3">
                    <img
                        src={logoRegionalLight}
                        alt="Logo"
                        className="h-14 w-auto dark:hidden" // Logo más grande
                    />
                    <img
                        src={logoRegionalDark}
                        alt="Logo"
                        className="h-14 w-auto hidden dark:block" // Logo más grande
                    />
                </div>
            </div>

            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto py-6">
                {/* Sección Principal */}
                <div className="mb-4">
                    <div className="px-3 py-1">
                        <h3 className="text-xs font-medium text-muted-foreground">Principal</h3>
                    </div>
                    <div>
                        {mainItems.map((item) => (
                            <NavLink
                                key={item.title}
                                to={item.url}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm mx-1 my-0.5 transition-all ${isActive
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                                    }`
                                }
                            >
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>

                {/* Sección Gestión */}
                <div>
                    <div className="px-3 py-1">
                        <h3 className="text-xs font-medium text-muted-foreground">Gestión</h3>
                    </div>
                    <div>
                        {managementItems.map((item) => (
                            <NavLink
                                key={item.title}
                                to={item.url}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm mx-1 my-0.5 transition-all ${isActive
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                                    }`
                                }
                            >
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}