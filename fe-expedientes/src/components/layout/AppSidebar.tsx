import { useState } from "react";
import {
    BarChart3,
    FileText,
    Upload,
    Settings,
    Home,
    TrendingUp,
    Database,
    User
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
    SidebarTrigger,
    useSidebar,
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
    const { state } = useSidebar();
    const location = useLocation();
    const currentPath = location.pathname;

    const isActive = (path: string) => currentPath === path;
    const isMainGroupExpanded = mainItems.some((i) => isActive(i.url));
    const isManagementGroupExpanded = managementItems.some((i) => isActive(i.url));

    const getNavCls = ({ isActive }: { isActive: boolean }) =>
        isActive
            ? "bg-primary text-primary-foreground font-medium"
            : "hover:bg-accent hover:text-accent-foreground";

    return (
        <Sidebar
            collapsible="icon"
        >
            <SidebarContent>
                {/* Brand */}
                <div className="p-4 border-b">
                    {state === "expanded" ? (
                        <div className="flex items-center space-x-2">
                            <FileText className="h-6 w-6 text-primary" />
                            <div>
                                <h2 className="text-sm font-bold">Evaluador IA</h2>
                                <p className="text-xs text-muted-foreground">Expedientes Técnicos</p>
                            </div>
                        </div>
                    ) : (
                        <FileText className="h-6 w-6 text-primary mx-auto" />
                    )}
                </div>

                {/* Main Navigation */}
                <SidebarGroup>
                    <SidebarGroupLabel>Principal</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {mainItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <NavLink to={item.url} end className={getNavCls}>
                                            <item.icon className="h-4 w-4" />
                                            {state === "expanded" && <span>{item.title}</span>}
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Management */}
                <SidebarGroup>
                    <SidebarGroupLabel>Gestión</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {managementItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <NavLink to={item.url} end className={getNavCls}>
                                            <item.icon className="h-4 w-4" />
                                            {state === "expanded" && <span>{item.title}</span>}
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* User Section */}
                <div className="mt-auto p-4 border-t">
                    {state === "expanded" ? (
                        <div className="flex items-center space-x-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">Usuario Admin</p>
                                <p className="text-xs text-muted-foreground truncate">admin@sistema.com</p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                            <User className="h-4 w-4 text-primary" />
                        </div>
                    )}
                </div>
            </SidebarContent>
        </Sidebar>
    );
}