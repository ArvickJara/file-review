import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, FileText, Search, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    return (
        <SidebarProvider>
            <div className="min-h-screen w-full bg-muted/40">
                <AppSidebar />
                <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
                    {/* --- Header Unificado y Responsivo --- */}
                    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                        {/* --- Logo y Título (visible en pantallas grandes) --- */}
                        <div className="hidden items-center gap-2 md:flex">
                            <FileText className="h-6 w-6 text-primary" />
                            <h1 className="text-xl font-bold">Eval-Expedientes</h1>
                        </div>

                        {/* --- Botón de Menú para Móvil --- */}
                        <SidebarTrigger className="sm:hidden" />

                        {/* --- Barra de Búsqueda (se expande) --- */}
                        <div className="relative ml-auto flex-1 md:grow-0">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Buscar expedientes..."
                                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                            />
                        </div>

                        {/* --- Acciones del Usuario --- */}
                        <ThemeToggle />
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <Bell className="h-5 w-5" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <User className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Perfil</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Configuración</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </header>

                    {/* --- Contenido Principal --- */}
                    <main className="flex-1 p-4 sm:px-6 sm:py-0">
                        {children}
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}