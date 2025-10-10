import {
    BarChart3,
    FileText,
    Upload,
    Settings,
    Home,
    TrendingUp,
    Database,
    Layers,
    ChevronDown,
    ListCheck
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useSidebar } from "@/contexts/SidebarContext";
import logoRegionalLight from "@/assets/logo-region-light.png";
import logoRegionalDark from "@/assets/logo-region-dark.png";
import { useState } from "react";

const mainItems = [
    { title: "Dashboard", url: "/", icon: Home },
    { title: "Costos y presupuestos", url: "/costos-presupuestos", icon: FileText },
    {
        title: "Estudios básicos",
        icon: Layers,
        children: [
            { title: "Estudio topográfico", url: "/estudios/topografico" },
            { title: "Estudio de demolición", url: "/estudios/demolicion" },
            { title: "Estudio de mecánica de suelos", url: "/estudios/mecanica-suelos" },
            { title: "Estudio de canteras y fuentes de agua", url: "/estudios/canteras" },
            { title: "Estudio de impacto ambiental", url: "/estudios/impacto-ambiental" },
        ],
    },
    { title: "Contenido Minimo", url: "/contenido-minimo", icon: ListCheck },
    { title: "Subir Archivos", url: "/upload", icon: Upload },

];

const managementItems = [
    { title: "Reportes", url: "/reports", icon: TrendingUp },
    { title: "Base de Datos", url: "/database", icon: Database },
    { title: "Configuración", url: "/settings", icon: Settings },
];

export function AppSidebar() {
    const location = useLocation();
    const { isOpen } = useSidebar();

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

    const toggleSection = (title: string) => {
        setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
    };

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
                        className="h-14 w-auto dark:hidden"
                    />
                    <img
                        src={logoRegionalDark}
                        alt="Logo"
                        className="h-14 w-auto hidden dark:block"
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
                        {mainItems.map((item) =>
                            item.children ? (
                                <div key={item.title} className="mx-1 my-0.5">
                                    <button
                                        onClick={() => toggleSection(item.title)}
                                        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-accent/50 hover:text-accent-foreground"
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.title}</span>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 transition-transform ${openSections[item.title] ? "rotate-180" : ""}`} />
                                    </button>
                                    {openSections[item.title] && (
                                        <div className="pl-6 pt-1">
                                            {item.children.map((child) => (
                                                <NavLink
                                                    key={child.title}
                                                    to={child.url}
                                                    className={({ isActive }) =>
                                                        `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all ${isActive
                                                            ? "bg-accent text-accent-foreground"
                                                            : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                                                        }`
                                                    }
                                                >
                                                    <span>{child.title}</span>
                                                </NavLink>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <NavLink
                                    key={item.title}
                                    to={item.url!}
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
                            )
                        )}
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