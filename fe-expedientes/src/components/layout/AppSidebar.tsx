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

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarHeader,
} from "@/components/ui/sidebar";

const mainItems = [
    { title: "Dashboard", url: "/", icon: Home },
    { title: "Expedientes", url: "/expedientes", icon: FileText },
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
    const currentPath = location.pathname;

    const isActive = (path: string) => currentPath === path;

    return (
        <Sidebar
            collapsible="offcanvas"
            className="fixed left-0 top-0 h-screen z-30 transition-all duration-300 ease-in-out"
        >
            <SidebarHeader className="border-b border-border/50 bg-sidebar sticky top-0 z-10">
                <div className="flex items-center space-x-2 p-3">
                    <FileText className="h-6 w-6 text-primary" />
                    <div>
                        <h2 className="text-sm font-bold">Menú Principal</h2>
                        <p className="text-xs text-muted-foreground">Navegación</p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="flex-1 overflow-y-auto">
                <SidebarGroup>
                    <SidebarGroupLabel>Principal</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {mainItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.url)}
                                        className="transition-all duration-200 ease-in-out hover:bg-accent/80"
                                    >
                                        <NavLink to={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel>Gestión</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {managementItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.url)}
                                        className="transition-all duration-200 ease-in-out hover:bg-accent/80"
                                    >
                                        <NavLink to={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}